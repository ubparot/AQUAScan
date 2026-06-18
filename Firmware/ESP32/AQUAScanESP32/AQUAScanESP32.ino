/*
  AQUAScan ESP32 boat gateway.

  Target board: ESP32 DevKit-style board
  USB Serial: 115200 debug monitor
  Local WebSocket fallback: ws://<esp32-ip>:81/
  Cloud relay WebSocket: wss://aquascan-relay.rocksparrot.workers.dev/boat
  Direct ESC PWM output: GPIO18 left, GPIO19 right
  Optional Serial2 bridge: 115200 link to the Arduino Mega ESC bridge

  WebSocket control messages accepted from the web app and Unity:
    {"type":"hello","client":"AQUAScan Web","version":"0.1.0"}
    {"type":"drive","seq":42,"armed":true,"estop":false,"x":0.2,"y":0.8,"left":1850,"right":1650}
    {"type":"estop","seq":43}

  Status message returned to the operator UI:
    {"type":"status","connected":true,"armed":false,"estop":false,"lastSeq":43,"left":1500,"right":1500,"rssi":-42}
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <WebSocketsServer.h>
#include <ctype.h>
#include <math.h>

#if __has_include(<esp_arduino_version.h>)
  #include <esp_arduino_version.h>
#endif

#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#include <TinyGPS++.h>
#define AQUASCAN_HAS_TINYGPS 1

namespace
{
  // Edit these before flashing if you want router/STATION mode.
  const char* kStaSsid = "SETUP-C4AF";
  const char* kStaPassword = "county5845drain";
  const unsigned long kStaConnectTimeoutMs = 15000;

  // Fallback access point. Connect the laptop/tablet to this SSID if router join fails.
  const char* kApSsid = "Aquascan";
  const char* kApPassword = "aquascan";

  const uint16_t kWebSocketPort = 81;
  const unsigned long kCommandTimeoutMs = 3500;
  const unsigned long kBridgeKeepaliveIntervalMs = 100;
  const unsigned long kStatusBroadcastIntervalMs = 250;
  const unsigned long kAutonomousControlIntervalMs = 250;
  const unsigned long kBatterySampleIntervalMs = 1000;
  const unsigned long kGpsFreshMs = 3000;
  const unsigned long kSensorFreshMs = 3000;

  const long kDebugBaudRate = 115200;
  const long kBridgeBaudRate = 115200;
  const int kBridgeRxPin = 16;
  const int kBridgeTxPin = 17;
  const bool kUseArduinoBridge = true;

  // Direct ESC PWM output. Use output-capable pins that are not RX0/TX0.
  const bool kUseDirectEscOutputs = false;
  const int kLeftEscPin = 18;
  const int kRightEscPin = 19;
  const int kLeftEscChannel = 0;
  const int kRightEscChannel = 1;
  const int kEscPwmHz = 50;
  const int kEscPwmResolutionBits = 16;
  const uint32_t kEscPwmPeriodUs = 20000;
  const uint32_t kEscPwmMaxDuty = (1UL << kEscPwmResolutionBits) - 1;

  // Optional boat GPS. Install TinyGPSPlus to enable parsing; otherwise it compiles out.
  const long kGpsBaudRate = 9600;
  const int kGpsRxPin = 25;
  const int kGpsTxPin = 26;

  // Optional battery telemetry. Leave disabled until the voltage divider is wired and calibrated.
  const int kBatterySensePin = -1; // Example: 35
  const float kAdcReferenceVoltage = 3.3f;
  const float kAdcMaxValue = 4095.0f;
  const float kBatteryDividerScale = 1.0f;
  const float kBatteryEmptyVoltage = 10.5f;
  const float kBatteryFullVoltage = 12.6f;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
  const int kAutonomousCruiseOffset = 120;
  const int kAutonomousMinForwardOffset = 70;
  const int kAutonomousMaxTurnOffset = 180;
  const float kAutonomousTurnGain = 3.0f;
  const float kAutonomousArrivalRadiusMeters = 3.0f;
  const float kAutonomousSlowRadiusMeters = 8.0f;
  const uint8_t kMaxMissionWaypoints = 64;
  const size_t kMaxBridgeCommandLength = 64;
  const size_t kMaxBridgeLineLength = 256;
  const size_t kBridgeReadBudget = 256;
  const size_t kGpsReadBudget = 128;
  const size_t kUsbReadBudget = 64;
  const uint8_t kTrackedSocketSlots = 8;
  const uint8_t kRelayClientNum = 255;

  const bool kUseCloudRelay = true;
  const char* kRelayHost = "aquascan-relay.rocksparrot.workers.dev";
  const uint16_t kRelayPort = 443;
  const char* kRelayPath = "/boat";
  const char* kRelayDeviceToken = "HmCZ8nlbq0EFrpXGSVaORkP2J5isDWdvTj73BuUf6NMKxoAt";
  const unsigned long kRelayReconnectIntervalMs = 5000;
}

struct MissionWaypoint
{
  double latitude;
  double longitude;
  float speedMps;
  bool received;
};

HardwareSerial BridgeSerial(2);
WebSocketsClient relaySocket;
WebSocketsServer webSocket(kWebSocketPort);

#if AQUASCAN_HAS_TINYGPS
HardwareSerial GpsSerial(1);
TinyGPSPlus gps;
#endif

char bridgeLine[kMaxBridgeLineLength];
size_t bridgeLineLength = 0;
String usbCommandLine;

bool socketSlots[kTrackedSocketSlots] = { false };
uint8_t connectedClientCount = 0;
bool relayConnected = false;
bool relayAuthenticated = false;

bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
String lastNeutralizeReason = "boot";
unsigned long neutralizeCount = 0;
bool bridgeArmed = false;
bool bridgeEstop = false;
int bridgeLastSeq = 0;
int bridgeLeftMicros = kNeutralMicros;
int bridgeRightMicros = kNeutralMicros;
int probeDirection = 0;
int probeSpeed = 0;
int bridgeProbeDirection = 0;
int bridgeProbeSpeed = 0;
unsigned long lastCommandAt = 0;
unsigned long lastBridgeCommandAt = 0;
unsigned long lastDriveLogAt = 0;
unsigned long lastProbeCommandAt = 0;
unsigned long lastProbeBridgeCommandAt = 0;
unsigned long lastStatusBroadcastAt = 0;
unsigned long lastBatterySampleAt = 0;

bool gpsFix = false;
double latitude = 0.0;
double longitude = 0.0;
double altitudeMeters = 0.0;
double headingDeg = 0.0;
double speedMps = 0.0;
unsigned long lastGpsFixAt = 0;

float batteryVoltage = NAN;
float batteryPercent = NAN;

bool sensorReceived = false;
unsigned long lastSensorAt = 0;
int sensorSeq = 0;
float sensorTemperatureC = NAN;
int sensorTempRawGpio = 0;
int sensorTurbidityRaw = 0;
float sensorTurbidityVoltage = NAN;
int sensorPhRaw = 0;
float sensorPhVoltage = NAN;
float sensorDistanceCm = NAN;
int sensorDissolvedOxygenRaw = 0;
float sensorDissolvedOxygenVoltage = NAN;
int sensorTdsRaw = 0;
float sensorTdsVoltage = NAN;
int sensorUvRaw = 0;
float sensorUvVoltage = NAN;
int sensorLightRaw = 0;
float sensorLightVoltage = NAN;

bool missionUploadActive = false;
String uploadMissionId;
String uploadChecksum;
int uploadWaypointCount = 0;
int uploadReceivedWaypoints = 0;
MissionWaypoint missionWaypoints[kMaxMissionWaypoints];
int missionWaypointCount = 0;
bool missionReady = false;

bool autonomousActive = false;
bool autonomousPaused = false;
int autonomousWaypointIndex = 0;
float autonomousTargetDistanceMeters = NAN;
float autonomousTargetBearingDeg = NAN;
String autonomousState = "idle";
String autonomousLastReason = "not_started";
unsigned long lastAutonomousControlAt = 0;

void startNetwork();
bool connectToRouter();
void startFallbackAccessPoint();
void startRelayClient();
void handleSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length);
void handleRelayEvent(WStype_t type, uint8_t* payload, size_t length);
void handleTextMessage(uint8_t clientNum, const char* payload, size_t length);
void handleDriveMessage(uint8_t clientNum, const String& message);
void handleEstopMessage(uint8_t clientNum, const String& message);
void handleProbeControlMessage(uint8_t clientNum, const String& message);
void handleMissionUploadMessage(uint8_t clientNum, const String& type, const String& message);
void handleMissionControlMessage(uint8_t clientNum, const String& message);
void resetMissionStorage();
void stopAutonomous(const char* reason, bool disarm);
void updateAutonomousControl();
float distanceMeters(double latA, double lonA, double latB, double lonB);
float bearingDeg(double latA, double lonA, double latB, double lonB);
float wrapDegrees180(float value);
void readUsbSerialCommands();
void handleUsbSerialCommand(String command);
void printUsbHelp();
void applyManualEscCommand(int left, int right);
void setupEscOutputs();
void applyEscOutputs(int left, int right);
void writeEscPulse(int pin, int channel, int micros);
void readBridgeStatus();
void applyBridgeStatus(const char* line);
void applyBridgeProbeStatus(const char* line);
void applyBridgeSensorStatus(const char* line);
bool writeBridgeLine(const char* line);
void sendBridgeCommand();
void sendBridgeProbeCommand();
void stopProbe(const char* reason);
void neutralize(const char* reason);
void updateTelemetry();
void updateGps();
void updateBattery();
void sendStatus(uint8_t clientNum);
void sendStatusBroadcast();
void sendSensorBroadcast();
String buildStatusJson();
String buildSensorJson();
void sendMissionAck(uint8_t clientNum, const String& missionId, int seq, bool accepted, const String& text);
void sendMissionProgress(uint8_t clientNum);
bool sendRelayText(const String& message);
bool hasSocketClient();
bool hasControlClient();
void markSocketConnected(uint8_t clientNum);
void markSocketDisconnected(uint8_t clientNum);
bool parseCsvIntegers(const char* line, int* values, int expectedCount);
bool parseCsvFloats(const char* line, float* values, int expectedCount);
int clampPulse(int value);
String socketPayloadToString(const char* payload, size_t length);
String readJsonString(const String& message, const char* key, const String& fallback);
bool readJsonBool(const String& message, const char* key, bool fallback);
int readJsonInt(const String& message, const char* key, int fallback);
float readJsonFloat(const String& message, const char* key, float fallback);
double readJsonDouble(const String& message, const char* key, double fallback);
int findJsonValueStart(const String& message, const char* key);
String escapeJson(const String& value);
void appendSensorJsonFields(String& message);
void appendJsonNumber(String& json, const char* key, double value, int decimals);

void setup()
{
  Serial.begin(kDebugBaudRate);
  delay(1500);
  Serial.println();
  Serial.println(F("BOOT: AQUAScan ESP32 boat gateway starting setup."));
  Serial.flush();

  setupEscOutputs();

  if (kUseArduinoBridge)
  {
    BridgeSerial.begin(kBridgeBaudRate, SERIAL_8N1, kBridgeRxPin, kBridgeTxPin);
    Serial.print(F("BOOT: Bridge UART started at "));
    Serial.print(kBridgeBaudRate);
    Serial.print(F(" 8N1, RX GPIO"));
    Serial.print(kBridgeRxPin);
    Serial.print(F(", TX GPIO"));
    Serial.println(kBridgeTxPin);
  }
  else
  {
    Serial.println(F("BOOT: Arduino bridge disabled; using direct ESC outputs."));
  }
  Serial.flush();

#if AQUASCAN_HAS_TINYGPS
  GpsSerial.begin(kGpsBaudRate, SERIAL_8N1, kGpsRxPin, kGpsTxPin);
  Serial.println(F("GPS telemetry: TinyGPSPlus enabled."));
#else
  Serial.println(F("GPS telemetry: TinyGPSPlus not installed; GPS fields are disabled."));
#endif

  if (kBatterySensePin >= 0)
  {
    analogReadResolution(12);
    analogSetPinAttenuation(kBatterySensePin, ADC_11db);
    Serial.println(F("Battery telemetry: enabled."));
  }
  else
  {
    Serial.println(F("Battery telemetry: disabled. Set kBatterySensePin after wiring a divider."));
  }

  startNetwork();
  startRelayClient();
  Serial.println(F("BOOT: Network setup complete."));
  Serial.flush();

  webSocket.begin();
  webSocket.onEvent(handleSocketEvent);
  Serial.println(F("BOOT: WebSocket server started."));
  Serial.flush();

  neutralize("boot");
  Serial.println(F("AQUAScan ESP32 bridge ready."));
  Serial.flush();
}

void loop()
{
  if (kUseCloudRelay && WiFi.status() == WL_CONNECTED)
    relaySocket.loop();

  webSocket.loop();
  readUsbSerialCommands();
  if (kUseArduinoBridge)
    readBridgeStatus();
  updateTelemetry();
  updateAutonomousControl();

  const unsigned long now = millis();

  if (hasControlClient() && now - lastStatusBroadcastAt >= kStatusBroadcastIntervalMs)
  {
    sendStatusBroadcast();
    lastStatusBroadcastAt = now;
  }

  if (kUseArduinoBridge && hasControlClient() && lastCommandAt > 0 && now - lastBridgeCommandAt >= kBridgeKeepaliveIntervalMs)
    sendBridgeCommand();

  if (kUseArduinoBridge && probeDirection != 0 && now - lastProbeBridgeCommandAt >= kBridgeKeepaliveIntervalMs)
    sendBridgeProbeCommand();

  if (armed && lastCommandAt > 0 && now - lastCommandAt > kCommandTimeoutMs)
    neutralize("command timeout");

  if (lastProbeCommandAt > 0 && now - lastProbeCommandAt > kCommandTimeoutMs)
    stopProbe("probe command timeout");
}

void handleSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length)
{
  switch (type)
  {
    case WStype_CONNECTED:
      markSocketConnected(clientNum);
      Serial.printf("WebSocket client connected: #%u\n", clientNum);
      sendStatus(clientNum);
      break;

    case WStype_DISCONNECTED:
      markSocketDisconnected(clientNum);
      Serial.printf("WebSocket client disconnected: #%u\n", clientNum);
      if (!hasControlClient())
        neutralize("all clients disconnected");
      break;

    case WStype_TEXT:
      handleTextMessage(clientNum, reinterpret_cast<const char*>(payload), length);
      break;

    default:
      break;
  }
}

void handleRelayEvent(WStype_t type, uint8_t* payload, size_t length)
{
  switch (type)
  {
    case WStype_CONNECTED:
      relayConnected = true;
      relayAuthenticated = false;
      Serial.println(F("Cloud relay connected. Authenticating boat."));
      sendRelayText(String(F("{\"type\":\"boat_auth\",\"token\":\"")) + escapeJson(kRelayDeviceToken) + F("\"}"));
      break;

    case WStype_DISCONNECTED:
      relayConnected = false;
      relayAuthenticated = false;
      Serial.println(F("Cloud relay disconnected."));
      if (!hasControlClient())
        neutralize("relay disconnected");
      break;

    case WStype_TEXT:
    {
      const String message = socketPayloadToString(reinterpret_cast<const char*>(payload), length);
      const String typeName = readJsonString(message, "type", "");
      if (!relayAuthenticated && typeName == "hello")
        return;
      if (typeName == "auth_ok")
      {
        relayAuthenticated = true;
        Serial.println(F("Cloud relay boat authentication accepted."));
        sendStatus(kRelayClientNum);
        return;
      }
      if (typeName == "error")
      {
        Serial.print(F("Cloud relay error: "));
        Serial.println(message);
        return;
      }
      handleTextMessage(kRelayClientNum, reinterpret_cast<const char*>(payload), length);
      break;
    }

    default:
      break;
  }
}

void handleTextMessage(uint8_t clientNum, const char* payload, size_t length)
{
  String message = socketPayloadToString(payload, length);
  message.trim();

  const String type = readJsonString(message, "type", "");

  if (type == "hello")
  {
    sendStatus(clientNum);
    return;
  }

  if (type == "drive")
  {
    handleDriveMessage(clientNum, message);
    return;
  }

  if (type == "estop")
  {
    handleEstopMessage(clientNum, message);
    return;
  }

  if (type == "neutralize")
  {
    const String reason = readJsonString(message, "reason", "remote neutralize");
    neutralize(reason.c_str());
    return;
  }

  if (type == "probe_control")
  {
    handleProbeControlMessage(clientNum, message);
    return;
  }

  if (type == "mission_control")
  {
    handleMissionControlMessage(clientNum, message);
    return;
  }

  if (type == "mission_upload_begin" || type == "mission_waypoint" || type == "mission_upload_commit" || type == "mission_upload_abort")
  {
    handleMissionUploadMessage(clientNum, type, message);
    return;
  }

  Serial.printf("Ignoring unknown WebSocket message type '%s'.\n", type.c_str());
  sendStatus(clientNum);
}

void handleDriveMessage(uint8_t clientNum, const String& message)
{
  if (findJsonValueStart(message, "seq") < 0 ||
      findJsonValueStart(message, "armed") < 0 ||
      findJsonValueStart(message, "estop") < 0 ||
      findJsonValueStart(message, "left") < 0 ||
      findJsonValueStart(message, "right") < 0)
  {
    Serial.printf("Ignoring malformed drive message from client #%u.\n", clientNum);
    sendStatus(clientNum);
    return;
  }

  const int nextSeq = readJsonInt(message, "seq", lastSeq);
  const bool nextArmed = readJsonBool(message, "armed", armed);
  const bool nextEstop = readJsonBool(message, "estop", estop);
  const int nextLeft = readJsonInt(message, "left", leftMicros);
  const int nextRight = readJsonInt(message, "right", rightMicros);

  if (autonomousActive || autonomousPaused)
    stopAutonomous("manual drive takeover", false);

  if (nextLeft < kMinMicros || nextLeft > kMaxMicros || nextRight < kMinMicros || nextRight > kMaxMicros)
  {
    neutralize("pulse out of range");
    sendStatus(clientNum);
    return;
  }

  lastSeq = nextSeq;
  estop = nextEstop;
  armed = nextArmed && !estop;
  if (!armed && !estop)
    lastNeutralizeReason = "";
  leftMicros = armed ? nextLeft : kNeutralMicros;
  rightMicros = armed ? nextRight : kNeutralMicros;
  lastCommandAt = millis();

  applyEscOutputs(leftMicros, rightMicros);

  const unsigned long now = millis();
  if (now - lastDriveLogAt >= 1000)
  {
    lastDriveLogAt = now;
    Serial.printf("Drive seq=%d armed=%d estop=%d left=%d right=%d\n", lastSeq, armed ? 1 : 0, estop ? 1 : 0, leftMicros, rightMicros);
  }
}

void handleEstopMessage(uint8_t clientNum, const String& message)
{
  lastSeq = readJsonInt(message, "seq", lastSeq);
  stopAutonomous("e-stop", true);
  estop = true;
  armed = false;
  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = millis();

  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();
  sendStatus(clientNum);
  Serial.printf("E-stop latched seq=%d\n", lastSeq);
}

void handleProbeControlMessage(uint8_t clientNum, const String& message)
{
  lastSeq = readJsonInt(message, "seq", lastSeq);
  const String direction = readJsonString(message, "direction", "stop");
  const int speed = constrain(readJsonInt(message, "speed", 0), 0, 255);

  if (estop)
  {
    probeDirection = 0;
    probeSpeed = 0;
  }
  else if (direction == "lower")
  {
    probeDirection = 1;
    probeSpeed = speed;
  }
  else if (direction == "raise")
  {
    probeDirection = -1;
    probeSpeed = speed;
  }
  else
  {
    probeDirection = 0;
    probeSpeed = 0;
  }

  lastProbeCommandAt = probeDirection == 0 ? 0 : millis();
  sendBridgeProbeCommand();
  sendStatus(clientNum);

  Serial.printf("Probe seq=%d direction=%d speed=%d\n", lastSeq, probeDirection, probeSpeed);
}

void handleMissionUploadMessage(uint8_t clientNum, const String& type, const String& message)
{
  const int seq = readJsonInt(message, "seq", lastSeq);
  const String missionId = readJsonString(message, "missionId", uploadMissionId);

  if (type == "mission_upload_begin")
  {
    stopAutonomous("mission upload", true);
    resetMissionStorage();
    missionUploadActive = true;
    uploadMissionId = missionId;
    uploadChecksum = readJsonString(message, "checksum", "");
    uploadWaypointCount = max(0, readJsonInt(message, "waypointCount", 0));
    uploadReceivedWaypoints = 0;
    lastSeq = seq;

    const bool accepted = uploadWaypointCount > 0 && uploadWaypointCount <= kMaxMissionWaypoints;
    if (!accepted)
      missionUploadActive = false;
    sendMissionAck(clientNum, uploadMissionId, seq, accepted, accepted ? "upload_started" : uploadWaypointCount <= 0 ? "empty_mission" : "too_many_waypoints");
    sendMissionProgress(clientNum);
    return;
  }

  if (type == "mission_waypoint")
  {
    const int index = readJsonInt(message, "index", -1);
    const double waypointLat = readJsonDouble(message, "latitude", NAN);
    const double waypointLon = readJsonDouble(message, "longitude", NAN);
    const float waypointSpeed = readJsonFloat(message, "speedMps", 0.5f);
    const bool validPosition = isfinite(waypointLat) && isfinite(waypointLon) && waypointLat >= -90.0 && waypointLat <= 90.0 && waypointLon >= -180.0 && waypointLon <= 180.0;
    const bool accepted = missionUploadActive && missionId == uploadMissionId && index >= 0 && index < uploadWaypointCount && index < kMaxMissionWaypoints && validPosition;
    if (accepted)
    {
      missionWaypoints[index] = { waypointLat, waypointLon, constrain(waypointSpeed, 0.2f, 2.0f), true };
      uploadReceivedWaypoints = max(uploadReceivedWaypoints, index + 1);
    }
    lastSeq = seq;

    sendMissionAck(clientNum, missionId, seq, accepted, accepted ? "waypoint_received" : "waypoint_rejected");
    sendMissionProgress(clientNum);
    return;
  }

  if (type == "mission_upload_commit")
  {
    const String checksum = readJsonString(message, "checksum", "");
    const bool accepted = missionUploadActive && missionId == uploadMissionId && checksum == uploadChecksum && uploadReceivedWaypoints == uploadWaypointCount;
    lastSeq = seq;

    sendMissionAck(clientNum, missionId, seq, accepted, accepted ? "upload_committed" : "upload_incomplete");
    sendMissionProgress(clientNum);
    if (accepted)
    {
      missionUploadActive = false;
      missionReady = true;
      missionWaypointCount = uploadWaypointCount;
      autonomousWaypointIndex = 0;
      autonomousState = "ready";
      autonomousLastReason = "route_committed";
    }
    return;
  }

  if (type == "mission_upload_abort")
  {
    missionUploadActive = false;
    resetMissionStorage();
    uploadMissionId = missionId;
    uploadReceivedWaypoints = 0;
    uploadWaypointCount = 0;
    lastSeq = seq;

    sendMissionAck(clientNum, missionId, seq, true, "upload_aborted");
  }
}

void handleMissionControlMessage(uint8_t clientNum, const String& message)
{
  const int seq = readJsonInt(message, "seq", lastSeq);
  const String action = readJsonString(message, "action", "");
  lastSeq = seq;

  if (action == "start" || action == "resume")
  {
    if (!missionReady || missionWaypointCount < 2)
    {
      autonomousState = "blocked";
      autonomousLastReason = "no_committed_route";
      sendMissionAck(clientNum, uploadMissionId, seq, false, "no_committed_route");
      sendStatus(clientNum);
      return;
    }

    if (!gpsFix)
    {
      autonomousState = "blocked";
      autonomousLastReason = "no_gps_fix";
      sendMissionAck(clientNum, uploadMissionId, seq, false, "no_gps_fix");
      sendStatus(clientNum);
      return;
    }

    if (estop)
    {
      autonomousState = "blocked";
      autonomousLastReason = "estop_latched";
      sendMissionAck(clientNum, uploadMissionId, seq, false, "estop_latched");
      sendStatus(clientNum);
      return;
    }

    autonomousActive = true;
    autonomousPaused = false;
    armed = true;
    lastCommandAt = millis();
    lastAutonomousControlAt = 0;
    autonomousState = "running";
    autonomousLastReason = action == "resume" ? "resumed" : "started";
    sendMissionAck(clientNum, uploadMissionId, seq, true, autonomousLastReason);
    sendStatus(clientNum);
    return;
  }

  if (action == "pause")
  {
    stopAutonomous("paused", false);
    autonomousPaused = missionReady;
    autonomousState = "paused";
    sendMissionAck(clientNum, uploadMissionId, seq, true, "paused");
    sendStatus(clientNum);
    return;
  }

  if (action == "stop" || action == "abort")
  {
    stopAutonomous(action == "abort" ? "aborted" : "stopped", true);
    sendMissionAck(clientNum, uploadMissionId, seq, true, action == "abort" ? "aborted" : "stopped");
    sendStatus(clientNum);
    return;
  }

  sendMissionAck(clientNum, uploadMissionId, seq, false, "unknown_mission_control_action");
  sendStatus(clientNum);
}

void resetMissionStorage()
{
  for (uint8_t i = 0; i < kMaxMissionWaypoints; i++)
    missionWaypoints[i] = { 0.0, 0.0, 0.5f, false };

  missionReady = false;
  missionWaypointCount = 0;
  uploadReceivedWaypoints = 0;
  autonomousWaypointIndex = 0;
  autonomousTargetDistanceMeters = NAN;
  autonomousTargetBearingDeg = NAN;
  autonomousState = "idle";
  autonomousLastReason = "route_cleared";
}

void stopAutonomous(const char* reason, bool disarm)
{
  const bool wasAutonomous = autonomousActive || autonomousPaused;
  autonomousActive = false;
  autonomousPaused = false;
  autonomousState = "idle";
  autonomousLastReason = reason;
  autonomousTargetDistanceMeters = NAN;
  autonomousTargetBearingDeg = NAN;

  if (disarm)
    armed = false;

  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  if (wasAutonomous || disarm)
  {
    applyEscOutputs(leftMicros, rightMicros);
    sendBridgeCommand();
  }
}

void updateAutonomousControl()
{
  if (!autonomousActive)
    return;

  const unsigned long now = millis();
  if (now - lastAutonomousControlAt < kAutonomousControlIntervalMs)
    return;
  lastAutonomousControlAt = now;

  if (estop)
  {
    stopAutonomous("estop_latched", true);
    return;
  }

  if (!gpsFix)
  {
    stopAutonomous("gps_lost", true);
    neutralize("autonomous gps lost");
    return;
  }

  if (!missionReady || missionWaypointCount < 2 || autonomousWaypointIndex >= missionWaypointCount)
  {
    stopAutonomous("route_complete", true);
    neutralize("autonomous route complete");
    return;
  }

  MissionWaypoint& target = missionWaypoints[autonomousWaypointIndex];
  if (!target.received)
  {
    stopAutonomous("missing_waypoint", true);
    neutralize("autonomous missing waypoint");
    return;
  }

  autonomousTargetDistanceMeters = distanceMeters(latitude, longitude, target.latitude, target.longitude);
  autonomousTargetBearingDeg = bearingDeg(latitude, longitude, target.latitude, target.longitude);

  if (autonomousTargetDistanceMeters <= kAutonomousArrivalRadiusMeters)
  {
    autonomousWaypointIndex++;
    if (autonomousWaypointIndex >= missionWaypointCount)
    {
      stopAutonomous("route_complete", true);
      neutralize("autonomous route complete");
      return;
    }
    return;
  }

  const float headingError = wrapDegrees180(autonomousTargetBearingDeg - static_cast<float>(headingDeg));
  const float slowScale = constrain(autonomousTargetDistanceMeters / kAutonomousSlowRadiusMeters, 0.35f, 1.0f);
  const int forwardOffset = max(kAutonomousMinForwardOffset, static_cast<int>(kAutonomousCruiseOffset * slowScale));
  const int turnOffset = constrain(static_cast<int>(headingError * kAutonomousTurnGain), -kAutonomousMaxTurnOffset, kAutonomousMaxTurnOffset);

  leftMicros = clampPulse(kNeutralMicros + forwardOffset + turnOffset);
  rightMicros = clampPulse(kNeutralMicros + forwardOffset - turnOffset);
  armed = true;
  lastCommandAt = now;
  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();
}

float distanceMeters(double latA, double lonA, double latB, double lonB)
{
  const double earthRadiusMeters = 6371000.0;
  const double phiA = latA * PI / 180.0;
  const double phiB = latB * PI / 180.0;
  const double dPhi = (latB - latA) * PI / 180.0;
  const double dLambda = (lonB - lonA) * PI / 180.0;
  const double sinDphi = sin(dPhi / 2.0);
  const double sinDlambda = sin(dLambda / 2.0);
  const double hav = sinDphi * sinDphi + cos(phiA) * cos(phiB) * sinDlambda * sinDlambda;
  const double inverseHav = 1.0 - hav;
  return static_cast<float>(earthRadiusMeters * 2.0 * atan2(sqrt(hav), sqrt(inverseHav > 0.0 ? inverseHav : 0.0)));
}

float bearingDeg(double latA, double lonA, double latB, double lonB)
{
  const double phiA = latA * PI / 180.0;
  const double phiB = latB * PI / 180.0;
  const double dLambda = (lonB - lonA) * PI / 180.0;
  const double y = sin(dLambda) * cos(phiB);
  const double x = cos(phiA) * sin(phiB) - sin(phiA) * cos(phiB) * cos(dLambda);
  float bearing = static_cast<float>(atan2(y, x) * 180.0 / PI);
  if (bearing < 0.0f)
    bearing += 360.0f;
  return bearing;
}

float wrapDegrees180(float value)
{
  while (value > 180.0f)
    value -= 360.0f;
  while (value < -180.0f)
    value += 360.0f;
  return value;
}

void readUsbSerialCommands()
{
  size_t processed = 0;
  while (Serial.available() > 0 && processed < kUsbReadBudget)
  {
    const char incoming = static_cast<char>(Serial.read());
    processed++;
    if (incoming == '\n' || incoming == '\r')
    {
      usbCommandLine.trim();
      if (usbCommandLine.length() > 0)
        handleUsbSerialCommand(usbCommandLine);
      usbCommandLine = "";
      continue;
    }

    if (usbCommandLine.length() < 96)
      usbCommandLine += incoming;
    else
      usbCommandLine = "";
  }
}

void handleUsbSerialCommand(String command)
{
  command.trim();
  command.toLowerCase();

  if (command == "help" || command == "?")
  {
    printUsbHelp();
    return;
  }

  if (command == "status")
  {
    Serial.println(buildStatusJson());
    return;
  }

  if (command == "arm")
  {
    estop = false;
    armed = true;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastSeq++;
    lastCommandAt = millis();
    applyEscOutputs(leftMicros, rightMicros);
    sendBridgeCommand();
    Serial.println(F("USB: armed at neutral."));
    return;
  }

  if (command == "disarm" || command == "stop" || command == "neutral")
  {
    armed = false;
    estop = false;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastSeq++;
    lastCommandAt = 0;
    applyEscOutputs(leftMicros, rightMicros);
    sendBridgeCommand();
    Serial.println(F("USB: neutral/disarmed."));
    return;
  }

  if (command == "estop")
  {
    armed = false;
    estop = true;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastSeq++;
    lastCommandAt = 0;
    applyEscOutputs(leftMicros, rightMicros);
    sendBridgeCommand();
    Serial.println(F("USB: e-stop latched."));
    return;
  }

  if (command == "clear")
  {
    armed = false;
    estop = false;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastSeq++;
    applyEscOutputs(leftMicros, rightMicros);
    sendBridgeCommand();
    Serial.println(F("USB: e-stop cleared; neutral/disarmed."));
    return;
  }

  if (command.startsWith("esc "))
  {
    const int separator = command.indexOf(' ', 4);
    if (separator < 0)
    {
      Serial.println(F("USB: expected 'esc <leftMicros> <rightMicros>'."));
      return;
    }

    const int nextLeft = command.substring(4, separator).toInt();
    const int nextRight = command.substring(separator + 1).toInt();
    applyManualEscCommand(nextLeft, nextRight);
    return;
  }

  if (command.startsWith("both "))
  {
    const int pulse = command.substring(5).toInt();
    applyManualEscCommand(pulse, pulse);
    return;
  }

  Serial.println(F("USB: unknown command. Type 'help'."));
}

void printUsbHelp()
{
  Serial.println(F("USB commands:"));
  Serial.println(F("  help              show this help"));
  Serial.println(F("  status            print current status JSON"));
  Serial.println(F("  arm               arm at neutral"));
  Serial.println(F("  disarm            neutral and disarm"));
  Serial.println(F("  stop              neutral and disarm"));
  Serial.println(F("  estop             latch e-stop at neutral"));
  Serial.println(F("  clear             clear e-stop and disarm"));
  Serial.println(F("  both 1500         set both ESC pulses; requires arm"));
  Serial.println(F("  esc 1500 1500     set left/right pulses; requires arm"));
  Serial.println(F("Pulse range is 1000-2000 us. Start with props removed."));
}

void applyManualEscCommand(int left, int right)
{
  if (estop)
  {
    Serial.println(F("USB: e-stop is latched. Type 'clear' first."));
    return;
  }

  if (!armed)
  {
    Serial.println(F("USB: not armed. Type 'arm' first."));
    return;
  }

  if (left < kMinMicros || left > kMaxMicros || right < kMinMicros || right > kMaxMicros)
  {
    Serial.println(F("USB: pulse out of range. Use 1000-2000."));
    return;
  }

  lastSeq++;
  leftMicros = left;
  rightMicros = right;
  lastCommandAt = millis();
  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();

  Serial.print(F("USB: applied left="));
  Serial.print(leftMicros);
  Serial.print(F(" right="));
  Serial.println(rightMicros);
}

void setupEscOutputs()
{
  if (!kUseDirectEscOutputs)
  {
    Serial.println(F("BOOT: Direct ESC outputs disabled."));
    return;
  }

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(kLeftEscPin, kEscPwmHz, kEscPwmResolutionBits);
  ledcAttach(kRightEscPin, kEscPwmHz, kEscPwmResolutionBits);
#else
  ledcSetup(kLeftEscChannel, kEscPwmHz, kEscPwmResolutionBits);
  ledcSetup(kRightEscChannel, kEscPwmHz, kEscPwmResolutionBits);
  ledcAttachPin(kLeftEscPin, kLeftEscChannel);
  ledcAttachPin(kRightEscPin, kRightEscChannel);
#endif

  applyEscOutputs(kNeutralMicros, kNeutralMicros);
  Serial.print(F("BOOT: Direct ESC outputs on GPIO "));
  Serial.print(kLeftEscPin);
  Serial.print(F(" and GPIO "));
  Serial.print(kRightEscPin);
  Serial.println(F("."));
}

void applyEscOutputs(int left, int right)
{
  if (!kUseDirectEscOutputs)
    return;

  writeEscPulse(kLeftEscPin, kLeftEscChannel, left);
  writeEscPulse(kRightEscPin, kRightEscChannel, right);
}

void writeEscPulse(int pin, int channel, int micros)
{
  const int clampedMicros = clampPulse(micros);
  const uint32_t duty = (static_cast<uint32_t>(clampedMicros) * kEscPwmMaxDuty + (kEscPwmPeriodUs / 2)) / kEscPwmPeriodUs;

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

void readBridgeStatus()
{
  size_t processed = 0;
  while (BridgeSerial.available() > 0 && processed < kBridgeReadBudget)
  {
    const char incoming = static_cast<char>(BridgeSerial.read());
    processed++;

    if (incoming == '\n' || incoming == '\r')
    {
      if (bridgeLineLength > 0)
      {
        bridgeLine[bridgeLineLength] = '\0';
        if (bridgeLine[0] == 'S')
          applyBridgeStatus(bridgeLine);
        else if (bridgeLine[0] == 'P')
          applyBridgeProbeStatus(bridgeLine);
        else if (bridgeLine[0] == 'R')
          applyBridgeSensorStatus(bridgeLine);
        bridgeLineLength = 0;
      }
      continue;
    }

    // Status frame markers are also boundaries. Recover on the next frame if
    // a newline is lost instead of letting telemetry overflow disarm the boat.
    if ((incoming == 'S' || incoming == 'P' || incoming == 'R') && bridgeLineLength > 0)
    {
      bridgeLine[bridgeLineLength] = '\0';
      if (bridgeLine[0] == 'S')
        applyBridgeStatus(bridgeLine);
      else if (bridgeLine[0] == 'P')
        applyBridgeProbeStatus(bridgeLine);
      else if (bridgeLine[0] == 'R')
        applyBridgeSensorStatus(bridgeLine);
      bridgeLineLength = 0;
    }

    if (bridgeLineLength < kMaxBridgeLineLength - 1)
    {
      bridgeLine[bridgeLineLength++] = incoming;
    }
    else
    {
      bridgeLineLength = 0;
      Serial.println(F("Dropped oversized bridge status line."));
    }
  }
}

void applyBridgeStatus(const char* line)
{
  if (line[0] != 'S' || line[1] != ',')
    return;

  const char* cursor = line + 2;
  long parsedIntegers[6] = { bridgeLastSeq, bridgeArmed ? 1 : 0, bridgeEstop ? 1 : 0, bridgeLeftMicros, bridgeRightMicros, gpsFix ? 1 : 0 };

  for (int i = 0; i < 5; i++)
  {
    char* endPointer = nullptr;
    const long parsed = strtol(cursor, &endPointer, 10);
    if (endPointer == cursor)
      return;

    parsedIntegers[i] = parsed;

    if (i < 4)
    {
      if (*endPointer != ',')
        return;
      cursor = endPointer + 1;
    }
    else
    {
      cursor = endPointer;
    }
  }

  bridgeLastSeq = static_cast<int>(parsedIntegers[0]);
  bridgeArmed = parsedIntegers[1] != 0;
  bridgeEstop = parsedIntegers[2] != 0;
  bridgeLeftMicros = clampPulse(static_cast<int>(parsedIntegers[3]));
  bridgeRightMicros = clampPulse(static_cast<int>(parsedIntegers[4]));

  if (*cursor == '\0')
    return;
  if (*cursor != ',')
    return;

  cursor++;
  char* endPointer = nullptr;
  const long bridgeGpsFix = strtol(cursor, &endPointer, 10);
  if (endPointer == cursor)
    return;
  cursor = endPointer;

  if (*cursor != ',')
  {
    gpsFix = bridgeGpsFix != 0;
    return;
  }

  double parsedGps[5] = { latitude, longitude, altitudeMeters, headingDeg, speedMps };
  cursor++;
  for (int i = 0; i < 5; i++)
  {
    endPointer = nullptr;
    const double parsed = strtod(cursor, &endPointer);
    if (endPointer == cursor)
      return;

    parsedGps[i] = parsed;

    if (i == 4)
    {
      if (*endPointer != '\0')
        return;
    }
    else
    {
      if (*endPointer != ',')
        return;
      cursor = endPointer + 1;
    }
  }

  gpsFix = bridgeGpsFix != 0;
  latitude = parsedGps[0];
  longitude = parsedGps[1];
  altitudeMeters = parsedGps[2];
  headingDeg = parsedGps[3];
  speedMps = parsedGps[4];
  if (gpsFix)
    lastGpsFixAt = millis();
}

void applyBridgeProbeStatus(const char* line)
{
  int values[3] = { bridgeLastSeq, bridgeProbeDirection, bridgeProbeSpeed };
  if (!parseCsvIntegers(line, values, 3))
    return;

  bridgeLastSeq = values[0];
  bridgeProbeDirection = constrain(values[1], -1, 1);
  bridgeProbeSpeed = constrain(values[2], 0, 255);
}

void applyBridgeSensorStatus(const char* line)
{
  if (line[0] != 'R' || line[1] != ',')
    return;

  const char* payload = line + 2;
  if (payload[0] == 'P' && payload[1] == ',')
    payload += 2;

  float values[16] = {};
  if (!parseCsvFloats(payload, values, 16))
  {
    Serial.print(F("Ignored malformed sensor line: "));
    Serial.println(line);
    return;
  }

  sensorReceived = true;
  lastSensorAt = millis();
  sensorSeq = static_cast<int>(values[0]);
  sensorTemperatureC = values[1];
  sensorTempRawGpio = static_cast<int>(values[2]);
  sensorTurbidityRaw = static_cast<int>(values[3]);
  sensorTurbidityVoltage = values[4];
  sensorPhRaw = static_cast<int>(values[5]);
  sensorPhVoltage = values[6];
  sensorDistanceCm = values[7];
  sensorDissolvedOxygenRaw = static_cast<int>(values[8]);
  sensorDissolvedOxygenVoltage = values[9];
  sensorTdsRaw = static_cast<int>(values[10]);
  sensorTdsVoltage = values[11];
  sensorUvRaw = static_cast<int>(values[12]);
  sensorUvVoltage = values[13];
  sensorLightRaw = static_cast<int>(values[14]);
  sensorLightVoltage = values[15];

  Serial.print(F("Sensor packet seq="));
  Serial.println(sensorSeq);

  if (hasControlClient())
    sendSensorBroadcast();
}

void sendBridgeCommand()
{
  if (!kUseArduinoBridge)
    return;

  char line[kMaxBridgeCommandLength];
  const int length = snprintf(
    line,
    sizeof(line),
    "D,%d,%d,%d,%d,%d\n",
    lastSeq,
    armed ? 1 : 0,
    estop ? 1 : 0,
    leftMicros,
    rightMicros);

  if (length > 0 && static_cast<size_t>(length) < sizeof(line) && writeBridgeLine(line))
    lastBridgeCommandAt = millis();
}

void sendBridgeProbeCommand()
{
  if (!kUseArduinoBridge)
    return;

  char line[kMaxBridgeCommandLength];
  const int length = snprintf(
    line,
    sizeof(line),
    "W,%d,%d,%d\n",
    lastSeq,
    probeDirection,
    probeSpeed);

  if (length > 0 && static_cast<size_t>(length) < sizeof(line) && writeBridgeLine(line))
    lastProbeBridgeCommandAt = millis();
}

bool writeBridgeLine(const char* line)
{
  const size_t length = strlen(line);
  const size_t written = BridgeSerial.write(
    reinterpret_cast<const uint8_t*>(line),
    length);
  BridgeSerial.flush();

  if (written == length)
    return true;

  Serial.print(F("Bridge UART short write. Expected="));
  Serial.print(length);
  Serial.print(F(" wrote="));
  Serial.println(written);
  return false;
}

void stopProbe(const char* reason)
{
  probeDirection = 0;
  probeSpeed = 0;
  lastProbeCommandAt = 0;
  sendBridgeProbeCommand();
  if (hasControlClient())
    sendStatusBroadcast();

  Serial.printf("Probe stopped: %s\n", reason);
}

void neutralize(const char* reason)
{
  autonomousActive = false;
  autonomousPaused = false;
  autonomousState = "idle";
  autonomousLastReason = reason;
  armed = false;
  lastNeutralizeReason = reason;
  neutralizeCount++;
  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  probeDirection = 0;
  probeSpeed = 0;
  lastCommandAt = 0;
  lastProbeCommandAt = 0;

  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();
  sendBridgeProbeCommand();
  if (hasControlClient())
    sendStatusBroadcast();

  Serial.printf("Neutralized: %s\n", reason);
}

void updateTelemetry()
{
  updateGps();
  updateBattery();
}

void updateGps()
{
#if AQUASCAN_HAS_TINYGPS
  size_t processed = 0;
  while (GpsSerial.available() > 0 && processed < kGpsReadBudget)
  {
    gps.encode(static_cast<char>(GpsSerial.read()));
    processed++;
  }

  if (gps.location.isValid() && gps.location.isUpdated())
  {
    gpsFix = true;
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    lastGpsFixAt = millis();
  }

  if (gps.altitude.isValid())
    altitudeMeters = gps.altitude.meters();
  if (gps.course.isValid())
    headingDeg = gps.course.deg();
  if (gps.speed.isValid())
    speedMps = gps.speed.mps();

  if (gpsFix && millis() - lastGpsFixAt > kGpsFreshMs)
    gpsFix = false;
#endif
}

void updateBattery()
{
  if (kBatterySensePin < 0)
    return;

  const unsigned long now = millis();
  if (now - lastBatterySampleAt < kBatterySampleIntervalMs)
    return;

  lastBatterySampleAt = now;
  const int raw = analogRead(kBatterySensePin);
  const float sensedVoltage = (static_cast<float>(raw) / kAdcMaxValue) * kAdcReferenceVoltage;
  batteryVoltage = sensedVoltage * kBatteryDividerScale;
  batteryPercent = constrain(((batteryVoltage - kBatteryEmptyVoltage) / (kBatteryFullVoltage - kBatteryEmptyVoltage)) * 100.0f, 0.0f, 100.0f);
}

void sendStatus(uint8_t clientNum)
{
  String message = buildStatusJson();
  if (clientNum == kRelayClientNum)
  {
    sendRelayText(message);
    return;
  }
  webSocket.sendTXT(clientNum, message);
}

void sendStatusBroadcast()
{
  String message = buildStatusJson();
  webSocket.broadcastTXT(message);
  sendRelayText(message);
}

void sendSensorBroadcast()
{
  String message = buildSensorJson();
  webSocket.broadcastTXT(message);
  sendRelayText(message);
}

String buildStatusJson()
{
  String message;
  message.reserve(640);
  message += F("{\"type\":\"status\"");
  message += F(",\"connected\":");
  message += (hasControlClient() ? F("true") : F("false"));
  message += F(",\"armed\":");
  message += (armed ? F("true") : F("false"));
  message += F(",\"estop\":");
  message += (estop ? F("true") : F("false"));
  message += F(",\"lastSeq\":");
  message += lastSeq;
  message += F(",\"left\":");
  message += leftMicros;
  message += F(",\"right\":");
  message += rightMicros;
  message += F(",\"lastNeutralizeReason\":\"");
  message += escapeJson(lastNeutralizeReason);
  message += F("\",\"neutralizeCount\":");
  message += neutralizeCount;
  message += F(",\"probeDirection\":\"");
  message += probeDirection > 0 ? F("lower") : probeDirection < 0 ? F("raise") : F("stop");
  message += F("\",\"probeSpeed\":");
  message += probeSpeed;
  message += F(",\"missionReady\":");
  message += (missionReady ? F("true") : F("false"));
  message += F(",\"missionWaypointCount\":");
  message += missionWaypointCount;
  message += F(",\"autonomousActive\":");
  message += (autonomousActive ? F("true") : F("false"));
  message += F(",\"autonomousPaused\":");
  message += (autonomousPaused ? F("true") : F("false"));
  message += F(",\"autonomousState\":\"");
  message += escapeJson(autonomousState);
  message += F("\",\"autonomousReason\":\"");
  message += escapeJson(autonomousLastReason);
  message += F("\",\"autonomousWaypointIndex\":");
  message += autonomousWaypointIndex;
  message += F(",\"rssi\":");
  message += (WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -1);

  if (!isnan(autonomousTargetDistanceMeters))
    appendJsonNumber(message, "autonomousTargetDistanceMeters", autonomousTargetDistanceMeters, 1);
  if (!isnan(autonomousTargetBearingDeg))
    appendJsonNumber(message, "autonomousTargetBearingDeg", autonomousTargetBearingDeg, 1);

  if (gpsFix)
  {
    appendJsonNumber(message, "latitude", latitude, 7);
    appendJsonNumber(message, "longitude", longitude, 7);
    appendJsonNumber(message, "altitude", altitudeMeters, 2);
    appendJsonNumber(message, "headingDeg", headingDeg, 1);
    appendJsonNumber(message, "speedMps", speedMps, 2);
  }

  if (!isnan(batteryPercent))
  {
    appendJsonNumber(message, "batteryPercent", batteryPercent, 1);
    appendJsonNumber(message, "batteryVoltage", batteryVoltage, 2);
  }

  if (sensorReceived)
    appendSensorJsonFields(message);

  message += '}';
  return message;
}

String buildSensorJson()
{
  String message;
  message.reserve(360);
  message += F("{\"type\":\"sensor\"");
  message += F(",\"connected\":");
  message += (hasControlClient() ? F("true") : F("false"));
  appendSensorJsonFields(message);
  message += '}';
  return message;
}

void sendMissionAck(uint8_t clientNum, const String& missionId, int seq, bool accepted, const String& text)
{
  String message;
  message.reserve(160);
  message += F("{\"type\":\"mission_upload_ack\",\"missionId\":\"");
  message += escapeJson(missionId);
  message += F("\",\"seq\":");
  message += seq;
  message += F(",\"accepted\":");
  message += (accepted ? F("true") : F("false"));
  message += F(",\"message\":\"");
  message += escapeJson(text);
  message += F("\"}");
  if (clientNum == kRelayClientNum)
  {
    sendRelayText(message);
    return;
  }
  webSocket.sendTXT(clientNum, message);
}

void sendMissionProgress(uint8_t clientNum)
{
  if (uploadMissionId.length() == 0)
    return;

  String message;
  message.reserve(180);
  message += F("{\"type\":\"mission_upload_progress\",\"missionId\":\"");
  message += escapeJson(uploadMissionId);
  message += F("\",\"receivedWaypoints\":");
  message += uploadReceivedWaypoints;
  message += F(",\"waypointCount\":");
  message += uploadWaypointCount;
  if (uploadChecksum.length() > 0)
  {
    message += F(",\"checksum\":\"");
    message += escapeJson(uploadChecksum);
    message += F("\"");
  }
  message += '}';
  if (clientNum == kRelayClientNum)
  {
    sendRelayText(message);
    return;
  }
  webSocket.sendTXT(clientNum, message);
}

bool sendRelayText(const String& message)
{
  if (!kUseCloudRelay || !relayConnected)
    return false;

  String mutableMessage = message;
  return relaySocket.sendTXT(mutableMessage);
}

bool hasSocketClient()
{
  return connectedClientCount > 0;
}

bool hasControlClient()
{
  return hasSocketClient() || relayAuthenticated;
}

void markSocketConnected(uint8_t clientNum)
{
  if (clientNum >= kTrackedSocketSlots)
  {
    if (connectedClientCount == 0)
      connectedClientCount = 1;
    return;
  }

  if (!socketSlots[clientNum])
  {
    socketSlots[clientNum] = true;
    connectedClientCount++;
  }
}

void markSocketDisconnected(uint8_t clientNum)
{
  if (clientNum >= kTrackedSocketSlots)
  {
    if (connectedClientCount > 0)
      connectedClientCount--;
    return;
  }

  if (socketSlots[clientNum])
  {
    socketSlots[clientNum] = false;
    if (connectedClientCount > 0)
      connectedClientCount--;
  }
}

bool parseCsvIntegers(const char* line, int* values, int expectedCount)
{
  if (line[1] != ',')
    return false;

  const char* cursor = line + 2;
  for (int i = 0; i < expectedCount; i++)
  {
    char* endPointer = nullptr;
    const long parsed = strtol(cursor, &endPointer, 10);

    if (endPointer == cursor)
      return false;

    values[i] = static_cast<int>(parsed);

    if (i == expectedCount - 1)
      return *endPointer == '\0';

    if (*endPointer != ',')
      return false;

    cursor = endPointer + 1;
  }

  return true;
}

bool parseCsvFloats(const char* line, float* values, int expectedCount)
{
  const char* cursor = line;

  for (int i = 0; i < expectedCount; i++)
  {
    char* endPointer = nullptr;
    const float parsed = strtof(cursor, &endPointer);

    if (endPointer == cursor)
      return false;

    values[i] = parsed;

    if (i == expectedCount - 1)
      return *endPointer == '\0';

    if (*endPointer != ',')
      return false;

    cursor = endPointer + 1;
  }

  return true;
}

int clampPulse(int value)
{
  if (value < kMinMicros)
    return kMinMicros;
  if (value > kMaxMicros)
    return kMaxMicros;
  return value;
}

String socketPayloadToString(const char* payload, size_t length)
{
  String message;
  message.reserve(length + 1);
  for (size_t i = 0; i < length; i++)
    message += payload[i];
  return message;
}

String readJsonString(const String& message, const char* key, const String& fallback)
{
  int index = findJsonValueStart(message, key);
  if (index < 0 || index >= static_cast<int>(message.length()) || message[index] != '"')
    return fallback;

  index++;
  String value;
  while (index < static_cast<int>(message.length()))
  {
    const char current = message[index++];
    if (current == '"')
      return value;
    if (current == '\\' && index < static_cast<int>(message.length()))
      value += message[index++];
    else
      value += current;
  }

  return fallback;
}

bool readJsonBool(const String& message, const char* key, bool fallback)
{
  const int index = findJsonValueStart(message, key);
  if (index < 0)
    return fallback;

  if (message.startsWith("true", index))
    return true;
  if (message.startsWith("false", index))
    return false;
  return fallback;
}

int readJsonInt(const String& message, const char* key, int fallback)
{
  const int index = findJsonValueStart(message, key);
  if (index < 0)
    return fallback;

  char* endPointer = nullptr;
  const char* start = message.c_str() + index;
  const long parsed = strtol(start, &endPointer, 10);
  if (endPointer == start)
    return fallback;

  return static_cast<int>(parsed);
}

float readJsonFloat(const String& message, const char* key, float fallback)
{
  const int index = findJsonValueStart(message, key);
  if (index < 0)
    return fallback;

  char* endPointer = nullptr;
  const char* start = message.c_str() + index;
  const float parsed = strtof(start, &endPointer);
  if (endPointer == start)
    return fallback;

  return parsed;
}

double readJsonDouble(const String& message, const char* key, double fallback)
{
  const int index = findJsonValueStart(message, key);
  if (index < 0)
    return fallback;

  char* endPointer = nullptr;
  const char* start = message.c_str() + index;
  const double parsed = strtod(start, &endPointer);
  if (endPointer == start)
    return fallback;

  return parsed;
}

int findJsonValueStart(const String& message, const char* key)
{
  String pattern = "\"";
  pattern += key;
  pattern += "\"";

  int index = message.indexOf(pattern);
  if (index < 0)
    return -1;

  index = message.indexOf(':', index + pattern.length());
  if (index < 0)
    return -1;

  index++;
  while (index < static_cast<int>(message.length()) && isspace(static_cast<unsigned char>(message[index])))
    index++;

  return index;
}

String escapeJson(const String& value)
{
  String escaped;
  escaped.reserve(value.length());
  for (int i = 0; i < static_cast<int>(value.length()); i++)
  {
    const char current = value[i];
    if (current == '"' || current == '\\')
      escaped += '\\';
    escaped += current;
  }
  return escaped;
}

void appendSensorJsonFields(String& message)
{
  if (!sensorReceived)
    return;

  const unsigned long sensorAgeMs = millis() - lastSensorAt;
  message += F(",\"sensorFresh\":");
  message += sensorAgeMs <= kSensorFreshMs ? F("true") : F("false");
  message += F(",\"sensorAgeMs\":");
  message += sensorAgeMs;
  message += F(",\"sensorSeq\":");
  message += sensorSeq;
  message += F(",\"tempRawGpio\":");
  message += sensorTempRawGpio;
  message += F(",\"turbidityRaw\":");
  message += sensorTurbidityRaw;
  message += F(",\"phRaw\":");
  message += sensorPhRaw;
  message += F(",\"dissolvedOxygenRaw\":");
  message += sensorDissolvedOxygenRaw;
  message += F(",\"tdsRaw\":");
  message += sensorTdsRaw;
  message += F(",\"uvRaw\":");
  message += sensorUvRaw;
  message += F(",\"lightRaw\":");
  message += sensorLightRaw;

  if (!isnan(sensorTemperatureC))
    appendJsonNumber(message, "temperatureC", sensorTemperatureC, 2);
  if (!isnan(sensorTurbidityVoltage))
    appendJsonNumber(message, "turbidityVoltage", sensorTurbidityVoltage, 3);
  if (!isnan(sensorPhVoltage))
    appendJsonNumber(message, "phVoltage", sensorPhVoltage, 3);
  if (!isnan(sensorDistanceCm))
    appendJsonNumber(message, "distanceCm", sensorDistanceCm, 1);
  if (!isnan(sensorDissolvedOxygenVoltage))
    appendJsonNumber(message, "dissolvedOxygenVoltage", sensorDissolvedOxygenVoltage, 3);
  if (!isnan(sensorTdsVoltage))
    appendJsonNumber(message, "tdsVoltage", sensorTdsVoltage, 3);
  if (!isnan(sensorUvVoltage))
    appendJsonNumber(message, "uvVoltage", sensorUvVoltage, 3);
  if (!isnan(sensorLightVoltage))
    appendJsonNumber(message, "lightVoltage", sensorLightVoltage, 3);
}

void appendJsonNumber(String& json, const char* key, double value, int decimals)
{
  json += F(",\"");
  json += key;
  json += F("\":");
  json += String(value, decimals);
}

void startNetwork()
{
  WiFi.persistent(false);
  WiFi.setSleep(false);

  if (!connectToRouter())
    startFallbackAccessPoint();
}

void startRelayClient()
{
  if (!kUseCloudRelay)
    return;

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println(F("Cloud relay disabled for this boot because router Wi-Fi is not connected."));
    return;
  }

  if (String(kRelayDeviceToken) == "PASTE_AQUASCAN_DEVICE_TOKEN_HERE" || strlen(kRelayDeviceToken) == 0)
  {
    Serial.println(F("Cloud relay device token is not configured. Paste AQUASCAN_DEVICE_TOKEN into kRelayDeviceToken before flashing."));
    return;
  }

  relaySocket.beginSSL(kRelayHost, kRelayPort, kRelayPath);
  relaySocket.onEvent(handleRelayEvent);
  relaySocket.setReconnectInterval(kRelayReconnectIntervalMs);
  relaySocket.enableHeartbeat(15000, 3000, 2);

  Serial.print(F("Cloud relay client starting: wss://"));
  Serial.print(kRelayHost);
  Serial.println(kRelayPath);
}

bool connectToRouter()
{
  if (String(kStaSsid) == "YOUR_ROUTER_SSID" || String(kStaPassword) == "YOUR_ROUTER_PASSWORD" || strlen(kStaSsid) == 0)
  {
    Serial.println(F("Router credentials not configured. Starting fallback AP."));
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(kStaSsid, kStaPassword);

  Serial.printf("Connecting to router SSID '%s'", kStaSsid);
  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < kStaConnectTimeoutMs)
  {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println(F("Router connection failed."));
    WiFi.disconnect(true, true);
    return false;
  }

  Serial.print(F("Router connected. ESP32 IP: "));
  Serial.println(WiFi.localIP());
  return true;
}

void startFallbackAccessPoint()
{
  WiFi.mode(WIFI_AP);
  WiFi.softAP(kApSsid, kApPassword);
  Serial.print(F("Fallback AP started. SSID: "));
  Serial.println(kApSsid);
  Serial.print(F("Fallback AP IP: "));
  Serial.println(WiFi.softAPIP());
}
