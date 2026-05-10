/*
  AQUAScan ESP32 boat gateway.

  Target board: ESP32 DevKit-style board
  USB Serial: 115200 debug monitor
  WebSocket: ws://<esp32-ip>:81/
  Direct ESC PWM output: GPIO18 left, GPIO19 right
  Optional Serial2 bridge: 19200 link to the Arduino Mega ESC bridge

  WebSocket control messages accepted from the web app and Unity:
    {"type":"hello","client":"AQUAScan Web","version":"0.1.0"}
    {"type":"drive","seq":42,"armed":true,"estop":false,"x":0.2,"y":0.8,"left":1850,"right":1650}
    {"type":"estop","seq":43}

  Status message returned to the operator UI:
    {"type":"status","connected":true,"armed":false,"estop":false,"lastSeq":43,"left":1500,"right":1500,"rssi":-42}
*/

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ctype.h>
#include <math.h>

#if __has_include(<esp_arduino_version.h>)
  #include <esp_arduino_version.h>
#endif

#ifndef ESP_ARDUINO_VERSION_MAJOR
  #define ESP_ARDUINO_VERSION_MAJOR 2
#endif

#if __has_include(<TinyGPSPlus.h>)
  #include <TinyGPSPlus.h>
  #define AQUASCAN_HAS_TINYGPS 1
#else
  #define AQUASCAN_HAS_TINYGPS 0
#endif

namespace
{
  // Edit these before flashing if you want router/STATION mode.
  const char* kStaSsid = "SETUP-C4AF";
  const char* kStaPassword = "county5845drain";
  const unsigned long kStaConnectTimeoutMs = 15000;

  // Fallback access point. Connect the laptop/tablet to this SSID if router join fails.
  const char* kApSsid = "Aquascan";
  const char* kApPassword = "idkbro";

  const uint16_t kWebSocketPort = 81;
  const unsigned long kCommandTimeoutMs = 15000;
  const unsigned long kBridgeKeepaliveIntervalMs = 100;
  const unsigned long kStatusBroadcastIntervalMs = 250;
  const unsigned long kBatterySampleIntervalMs = 1000;
  const unsigned long kGpsFreshMs = 3000;

  const long kDebugBaudRate = 115200;
  const long kBridgeBaudRate = 19200;
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
  const size_t kMaxBridgeLineLength = 96;
  const uint8_t kTrackedSocketSlots = 8;
}

HardwareSerial BridgeSerial(2);
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

bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
bool bridgeArmed = false;
bool bridgeEstop = false;
int bridgeLastSeq = 0;
int bridgeLeftMicros = kNeutralMicros;
int bridgeRightMicros = kNeutralMicros;
unsigned long lastCommandAt = 0;
unsigned long lastBridgeCommandAt = 0;
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

bool missionUploadActive = false;
String uploadMissionId;
String uploadChecksum;
int uploadWaypointCount = 0;
int uploadReceivedWaypoints = 0;

void startNetwork();
bool connectToRouter();
void startFallbackAccessPoint();
void handleSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length);
void handleTextMessage(uint8_t clientNum, const char* payload, size_t length);
void handleDriveMessage(uint8_t clientNum, const String& message);
void handleEstopMessage(uint8_t clientNum, const String& message);
void handleMissionUploadMessage(uint8_t clientNum, const String& type, const String& message);
void readUsbSerialCommands();
void handleUsbSerialCommand(String command);
void printUsbHelp();
void applyManualEscCommand(int left, int right);
void setupEscOutputs();
void applyEscOutputs(int left, int right);
void writeEscPulse(int pin, int channel, int micros);
void readBridgeStatus();
void applyBridgeStatus(const char* line);
void sendBridgeCommand();
void neutralize(const char* reason);
void updateTelemetry();
void updateGps();
void updateBattery();
void sendStatus(uint8_t clientNum);
void sendStatusBroadcast();
String buildStatusJson();
void sendMissionAck(uint8_t clientNum, const String& missionId, int seq, bool accepted, const String& text);
void sendMissionProgress(uint8_t clientNum);
bool hasSocketClient();
void markSocketConnected(uint8_t clientNum);
void markSocketDisconnected(uint8_t clientNum);
bool parseCsvIntegers(const char* line, int* values, int expectedCount);
int clampPulse(int value);
String socketPayloadToString(const char* payload, size_t length);
String readJsonString(const String& message, const char* key, const String& fallback);
bool readJsonBool(const String& message, const char* key, bool fallback);
int readJsonInt(const String& message, const char* key, int fallback);
float readJsonFloat(const String& message, const char* key, float fallback);
int findJsonValueStart(const String& message, const char* key);
String escapeJson(const String& value);
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
    Serial.println(F("BOOT: Bridge UART started."));
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
  const unsigned long now = millis();

  webSocket.loop();
  readUsbSerialCommands();
  if (kUseArduinoBridge)
    readBridgeStatus();
  updateTelemetry();

  if (hasSocketClient() && now - lastStatusBroadcastAt >= kStatusBroadcastIntervalMs)
  {
    sendStatusBroadcast();
    lastStatusBroadcastAt = now;
  }

  if (kUseArduinoBridge && hasSocketClient() && lastCommandAt > 0 && now - lastBridgeCommandAt >= kBridgeKeepaliveIntervalMs)
    sendBridgeCommand();

  if (lastCommandAt > 0 && now - lastCommandAt > kCommandTimeoutMs)
    neutralize("command timeout");
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
      if (!hasSocketClient())
        neutralize("all clients disconnected");
      break;

    case WStype_TEXT:
      handleTextMessage(clientNum, reinterpret_cast<const char*>(payload), length);
      break;

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

  if (type == "mission_upload_begin" || type == "mission_waypoint" || type == "mission_upload_commit" || type == "mission_upload_abort")
  {
    handleMissionUploadMessage(clientNum, type, message);
    return;
  }

  Serial.printf("Ignoring unknown WebSocket message type '%s'.\n", type.c_str());
  neutralize("unknown message");
  sendStatus(clientNum);
}

void handleDriveMessage(uint8_t clientNum, const String& message)
{
  const int nextSeq = readJsonInt(message, "seq", lastSeq);
  const bool nextArmed = readJsonBool(message, "armed", false);
  const bool nextEstop = readJsonBool(message, "estop", false);
  const int nextLeft = readJsonInt(message, "left", kNeutralMicros);
  const int nextRight = readJsonInt(message, "right", kNeutralMicros);

  if (nextLeft < kMinMicros || nextLeft > kMaxMicros || nextRight < kMinMicros || nextRight > kMaxMicros)
  {
    neutralize("pulse out of range");
    sendStatus(clientNum);
    return;
  }

  lastSeq = nextSeq;
  estop = nextEstop;
  armed = nextArmed && !estop;
  leftMicros = armed ? nextLeft : kNeutralMicros;
  rightMicros = armed ? nextRight : kNeutralMicros;
  lastCommandAt = millis();

  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();
  sendStatus(clientNum);

  Serial.printf("Drive seq=%d armed=%d estop=%d left=%d right=%d\n", lastSeq, armed ? 1 : 0, estop ? 1 : 0, leftMicros, rightMicros);
}

void handleEstopMessage(uint8_t clientNum, const String& message)
{
  lastSeq = readJsonInt(message, "seq", lastSeq);
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

void handleMissionUploadMessage(uint8_t clientNum, const String& type, const String& message)
{
  const int seq = readJsonInt(message, "seq", lastSeq);
  const String missionId = readJsonString(message, "missionId", uploadMissionId);

  if (type == "mission_upload_begin")
  {
    missionUploadActive = true;
    uploadMissionId = missionId;
    uploadChecksum = readJsonString(message, "checksum", "");
    uploadWaypointCount = max(0, readJsonInt(message, "waypointCount", 0));
    uploadReceivedWaypoints = 0;
    lastSeq = seq;

    sendMissionAck(clientNum, uploadMissionId, seq, uploadWaypointCount > 0, uploadWaypointCount > 0 ? "upload_started" : "empty_mission");
    sendMissionProgress(clientNum);
    return;
  }

  if (type == "mission_waypoint")
  {
    const int index = readJsonInt(message, "index", -1);
    const bool accepted = missionUploadActive && missionId == uploadMissionId && index >= 0 && index < uploadWaypointCount;
    if (accepted)
      uploadReceivedWaypoints = max(uploadReceivedWaypoints, index + 1);
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
      missionUploadActive = false;
    return;
  }

  if (type == "mission_upload_abort")
  {
    missionUploadActive = false;
    uploadMissionId = missionId;
    uploadReceivedWaypoints = 0;
    uploadWaypointCount = 0;
    lastSeq = seq;

    sendMissionAck(clientNum, missionId, seq, true, "upload_aborted");
  }
}

void readUsbSerialCommands()
{
  while (Serial.available() > 0)
  {
    const char incoming = static_cast<char>(Serial.read());
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
  while (BridgeSerial.available() > 0)
  {
    const char incoming = static_cast<char>(BridgeSerial.read());

    if (incoming == '\n' || incoming == '\r')
    {
      if (bridgeLineLength > 0)
      {
        bridgeLine[bridgeLineLength] = '\0';
        applyBridgeStatus(bridgeLine);
        bridgeLineLength = 0;
      }
      continue;
    }

    if (bridgeLineLength < kMaxBridgeLineLength - 1)
    {
      bridgeLine[bridgeLineLength++] = incoming;
    }
    else
    {
      bridgeLineLength = 0;
      neutralize("bridge line too long");
    }
  }
}

void applyBridgeStatus(const char* line)
{
  int values[5] = { bridgeLastSeq, bridgeArmed ? 1 : 0, bridgeEstop ? 1 : 0, bridgeLeftMicros, bridgeRightMicros };
  if (!parseCsvIntegers(line, values, 5))
    return;

  bridgeLastSeq = values[0];
  bridgeArmed = values[1] != 0;
  bridgeEstop = values[2] != 0;
  bridgeLeftMicros = clampPulse(values[3]);
  bridgeRightMicros = clampPulse(values[4]);

  if (hasSocketClient())
    sendStatusBroadcast();
}

void sendBridgeCommand()
{
  if (!kUseArduinoBridge)
    return;

  BridgeSerial.printf("D,%d,%d,%d,%d,%d\n", lastSeq, armed ? 1 : 0, estop ? 1 : 0, leftMicros, rightMicros);
  lastBridgeCommandAt = millis();
}

void neutralize(const char* reason)
{
  armed = false;
  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = 0;

  applyEscOutputs(leftMicros, rightMicros);
  sendBridgeCommand();
  if (hasSocketClient())
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
  while (GpsSerial.available() > 0)
    gps.encode(static_cast<char>(GpsSerial.read()));

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
  webSocket.sendTXT(clientNum, message);
}

void sendStatusBroadcast()
{
  String message = buildStatusJson();
  webSocket.broadcastTXT(message);
}

String buildStatusJson()
{
  String message;
  message.reserve(256);
  message += F("{\"type\":\"status\"");
  message += F(",\"connected\":");
  message += (hasSocketClient() ? F("true") : F("false"));
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
  message += F(",\"rssi\":");
  message += (WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -1);

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
  webSocket.sendTXT(clientNum, message);
}

bool hasSocketClient()
{
  return connectedClientCount > 0;
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
  if (line[0] != 'S' || line[1] != ',')
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
