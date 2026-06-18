/*
  AQUAScan Arduino boat ESC bridge.

  Target board: Arduino Mega 2560
  USB Serial: 115200 debug monitor
  Serial1: 9600 GPS receiver
  Serial2: 115200 link to the ESP32 boat gateway
  Serial3: 19200 receive-only RS-485 probe link

  ESP32 -> Arduino:
    D,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>
    W,<seq>,<direction>,<speed>

  Arduino -> ESP32:
    S,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>,<gpsFix>,<lat>,<lon>,<altM>,<headingDeg>,<speedMps>
    P,<seq>,<direction>,<speed>
    R,<original RS-485 probe line>

  GPS wiring:
    GPS TX -> RX1 pin 19
    GPS RX -> TX1 pin 18 (optional)
    GND    -> Arduino GND

  RS-485 wiring:
    RO     -> RX3 pin 15
    DI     -> TX3 pin 14
    RE/DE  -> pin 45
    GND    -> Arduino GND
*/

#include <Servo.h>
#include <TinyGPS++.h>

namespace
{
  const uint8_t kLeftEscPin = 8;
  const uint8_t kRightEscPin = 10;
  const uint8_t kWinchLowerPin = 7;
  const uint8_t kWinchRaisePin = 6;
  const uint8_t kRs485DirPin = 45;

  const unsigned long kBridgeBaudRate = 115200;
  const unsigned long kGpsBaudRate = 9600;
  const unsigned long kRs485BaudRate = 19200;
  const unsigned long kDebugBaudRate = 115200;
  const unsigned long kStartupNeutralDelayMs = 5000;
  const unsigned long kCommandTimeoutMs = 3500;
  const unsigned long kStatusIntervalMs = 1000;
  const unsigned long kRs485DiagnosticIntervalMs = 2000;
  const unsigned long kGpsFreshMs = 3000;
  const size_t kBridgeReadBudget = 48;
  const size_t kGpsReadBudget = 128;
  const size_t kRs485ReadBudget = 128;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
  const size_t kMaxLineLength = 96;
  const size_t kMaxRs485LineLength = 220;
}

Servo leftEsc;
Servo rightEsc;

TinyGPSPlus gps;

char serialLine[kMaxLineLength];
size_t serialLineLength = 0;
char rs485Line[kMaxRs485LineLength];
size_t rs485LineLength = 0;

bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
int winchDirection = 0;
int winchSpeed = 0;
unsigned long lastCommandAt = 0;
unsigned long lastWinchCommandAt = 0;
unsigned long lastStatusAt = 0;
unsigned long lastDriveLogAt = 0;
unsigned long lastRs485DiagnosticAt = 0;
unsigned long receivedRs485ByteCount = 0;
unsigned long receivedRs485LineCount = 0;
unsigned long receivedProbeLineCount = 0;
bool gpsFix = false;
double latitude = 0.0;
double longitude = 0.0;
double altitudeMeters = 0.0;
double headingDeg = 0.0;
double speedMps = 0.0;
unsigned long lastGpsFixAt = 0;
bool loggedGpsFix = false;

void applyOutputs(int left, int right);
void readBridgeCommands();
void updateGps();
void setRs485ReceiveMode();
void readRs485Probe();
void printRs485Diagnostics();
void forwardRs485ProbeLine(const char* line);
void handleCommand(const char* line);
void handleDriveCommand(const char* line);
void handleWinchCommand(const char* line);
void neutralize(const char* reason, bool clearEstop);
void stopWinch(const char* reason);
void sendStatus();
void sendWinchStatus();
bool parseDriveCommand(const char* line, int* values, int expectedCount);
bool parseWinchCommand(const char* line, int* values, int expectedCount);
int clampPulse(int value);
int clampWinchSpeed(int value);
void applyWinch(int direction, int speed);
void printLineHex(const char* line);

void setup()
{
  Serial.begin(kDebugBaudRate);
  Serial1.begin(kGpsBaudRate);
  Serial2.begin(kBridgeBaudRate);
  Serial3.begin(kRs485BaudRate);

  leftEsc.attach(kLeftEscPin);
  rightEsc.attach(kRightEscPin);
  pinMode(kWinchLowerPin, OUTPUT);
  pinMode(kWinchRaisePin, OUTPUT);
  pinMode(kRs485DirPin, OUTPUT);
  setRs485ReceiveMode();

  applyOutputs(kNeutralMicros, kNeutralMicros);
  applyWinch(0, 0);
  Serial.println(F("AQUAScan ESC bridge booting. Holding neutral for ESC arming."));
  delay(kStartupNeutralDelayMs);

  sendStatus();
  Serial.println(F("AQUAScan Mega ESC bridge ready on Serial2."));
  Serial.println(F("GPS receiver ready on Serial1 pins RX1=19/TX1=18."));
  Serial.println(F("GPS telemetry: TinyGPSPlus enabled on Arduino Mega."));
  Serial.println(F("RS-485 probe receiver ready on Serial3 pins RX3=15/TX3=14, RE/DE=45; forwarding probe lines to ESP32."));
}

void loop()
{
  readBridgeCommands();
  updateGps();
  readRs485Probe();
  printRs485Diagnostics();

  const unsigned long now = millis();

  if (armed && lastCommandAt > 0 && now - lastCommandAt > kCommandTimeoutMs)
    neutralize("command timeout", false);

  if (lastWinchCommandAt > 0 && now - lastWinchCommandAt > kCommandTimeoutMs)
    stopWinch("winch timeout");

  if (now - lastStatusAt >= kStatusIntervalMs)
  {
    sendStatus();
    sendWinchStatus();
  }
}

void updateGps()
{
  size_t processed = 0;
  while (Serial1.available() > 0 && processed < kGpsReadBudget)
  {
    gps.encode(static_cast<char>(Serial1.read()));
    processed++;
  }

  if (gps.location.isValid() && gps.location.isUpdated())
  {
    gpsFix = true;
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    lastGpsFixAt = millis();

    if (!loggedGpsFix)
    {
      loggedGpsFix = true;
      Serial.print(F("GPS fix acquired: "));
      Serial.print(latitude, 7);
      Serial.print(',');
      Serial.println(longitude, 7);
    }
  }

  if (gps.altitude.isValid())
    altitudeMeters = gps.altitude.meters();
  if (gps.course.isValid())
    headingDeg = gps.course.deg();
  if (gps.speed.isValid())
    speedMps = gps.speed.mps();

  if (gpsFix && millis() - lastGpsFixAt > kGpsFreshMs)
  {
    gpsFix = false;
    loggedGpsFix = false;
  }
}

void setRs485ReceiveMode()
{
  // MAX485-style module: DE LOW disables transmit and RE LOW enables receive.
  digitalWrite(kRs485DirPin, LOW);
}

void readRs485Probe()
{
  size_t processed = 0;
  while (Serial3.available() > 0 && processed < kRs485ReadBudget)
  {
    const char incoming = static_cast<char>(Serial3.read());
    processed++;
    receivedRs485ByteCount++;

    if (incoming == '\n' || incoming == '\r')
    {
      if (rs485LineLength > 0)
      {
        rs485Line[rs485LineLength] = '\0';
        forwardRs485ProbeLine(rs485Line);
        rs485LineLength = 0;
      }
      continue;
    }

    if (static_cast<uint8_t>(incoming) < 32)
      continue;

    if (rs485LineLength < kMaxRs485LineLength - 1)
    {
      rs485Line[rs485LineLength++] = incoming;
    }
    else
    {
      rs485LineLength = 0;
      Serial.println(F("RS-485 probe line too long. Buffer cleared."));
    }
  }
}

void printRs485Diagnostics()
{
  if (armed)
    return;

  const unsigned long now = millis();
  if (now - lastRs485DiagnosticAt < kRs485DiagnosticIntervalMs)
    return;

  lastRs485DiagnosticAt = now;
  Serial.print(F("RS485 listening: bytes="));
  Serial.print(receivedRs485ByteCount);
  Serial.print(F(" completeLines="));
  Serial.print(receivedRs485LineCount);
  Serial.print(F(" bufferedBytes="));
  Serial.println(rs485LineLength);
}

void forwardRs485ProbeLine(const char* line)
{
  receivedRs485LineCount++;
  if (!armed)
  {
    Serial.print(F("RS485 LINE "));
    Serial.print(receivedRs485LineCount);
    Serial.print(F(": "));
    Serial.println(line);
  }

  const bool prefixedProbeLine = line[0] == 'P' && line[1] == ',';
  const bool bareSensorCsv = line[0] >= '0' && line[0] <= '9';
  if (!prefixedProbeLine && !bareSensorCsv)
  {
    Serial.println(F("RS485 line ignored: expected P-prefixed or bare sensor CSV."));
    return;
  }

  receivedProbeLineCount++;
  Serial2.print(F("R,"));
  Serial2.println(line);

  if (!armed)
  {
    Serial.print(F("Forwarded probe line "));
    Serial.print(receivedProbeLineCount);
    Serial.println(F(" to boat ESP32."));
  }
}

void readBridgeCommands()
{
  size_t processed = 0;
  while (Serial2.available() > 0 && processed < kBridgeReadBudget)
  {
    const char incoming = static_cast<char>(Serial2.read());
    processed++;

    if (incoming == '\n' || incoming == '\r')
    {
      if (serialLineLength > 0)
      {
        serialLine[serialLineLength] = '\0';
        handleCommand(serialLine);
        serialLineLength = 0;
      }
      continue;
    }

    if (static_cast<uint8_t>(incoming) < 32)
      continue;

    // A new command marker also acts as a frame boundary. This lets the bridge
    // recover on the next command if a newline is lost under heavy UART load.
    if ((incoming == 'D' || incoming == 'W') && serialLineLength > 0)
    {
      serialLine[serialLineLength] = '\0';
      handleCommand(serialLine);
      serialLineLength = 0;
    }

    if (serialLineLength < kMaxLineLength - 1)
    {
      serialLine[serialLineLength++] = incoming;
    }
    else
    {
      serialLineLength = 0;
      neutralize("serial line too long", false);
    }
  }
}

void handleCommand(const char* line)
{
  if (line[0] == 'D')
  {
    handleDriveCommand(line);
    return;
  }

  if (line[0] == 'W')
  {
    handleWinchCommand(line);
    return;
  }

  if (line[0] != 'D')
  {
    Serial.print(F("Ignored bridge noise: "));
    printLineHex(line);
    return;
  }
}

void handleDriveCommand(const char* line)
{
  int values[5] = { lastSeq, 0, 0, kNeutralMicros, kNeutralMicros };
  if (!parseDriveCommand(line, values, 5))
  {
    Serial.print(F("Bad drive line: "));
    printLineHex(line);
    neutralize("bad command", false);
    return;
  }

  const int nextSeq = values[0];
  const bool nextArmed = values[1] != 0;
  const bool nextEstop = values[2] != 0;
  const int nextLeft = clampPulse(values[3]);
  const int nextRight = clampPulse(values[4]);

  lastSeq = nextSeq;
  estop = nextEstop;
  armed = nextArmed && !estop;
  leftMicros = armed ? nextLeft : kNeutralMicros;
  rightMicros = armed ? nextRight : kNeutralMicros;
  lastCommandAt = millis();

  applyOutputs(leftMicros, rightMicros);

  const unsigned long now = millis();
  if (armed && now - lastDriveLogAt >= 1000)
  {
    lastDriveLogAt = now;
    Serial.print(F("Drive seq="));
    Serial.print(lastSeq);
    Serial.print(F(" armed=1 estop=0 left="));
    Serial.print(leftMicros);
    Serial.print(F(" right="));
    Serial.println(rightMicros);
  }
}

void handleWinchCommand(const char* line)
{
  int values[3] = { lastSeq, 0, 0 };
  if (!parseWinchCommand(line, values, 3))
  {
    Serial.print(F("Bad winch line: "));
    printLineHex(line);
    stopWinch("bad winch command");
    return;
  }

  lastSeq = values[0];
  winchDirection = constrain(values[1], -1, 1);
  winchSpeed = winchDirection == 0 ? 0 : clampWinchSpeed(values[2]);
  lastWinchCommandAt = winchDirection == 0 ? 0 : millis();

  applyWinch(winchDirection, winchSpeed);
  sendWinchStatus();

  if (!armed)
  {
    Serial.print(F("Winch seq="));
    Serial.print(lastSeq);
    Serial.print(F(" direction="));
    Serial.print(winchDirection);
    Serial.print(F(" speed="));
    Serial.println(winchSpeed);
  }
}

void applyOutputs(int left, int right)
{
  leftEsc.writeMicroseconds(clampPulse(left));
  rightEsc.writeMicroseconds(clampPulse(right));
}

void neutralize(const char* reason, bool clearEstop)
{
  armed = false;
  if (clearEstop)
    estop = false;

  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = 0;

  applyOutputs(leftMicros, rightMicros);
  applyWinch(0, 0);
  sendStatus();
  sendWinchStatus();

  Serial.print(F("Neutralized: "));
  Serial.println(reason);
}

void stopWinch(const char* reason)
{
  winchDirection = 0;
  winchSpeed = 0;
  lastWinchCommandAt = 0;
  applyWinch(winchDirection, winchSpeed);
  sendWinchStatus();

  Serial.print(F("Winch stopped: "));
  Serial.println(reason);
}

void sendStatus()
{
  lastStatusAt = millis();

  Serial2.print(F("S,"));
  Serial2.print(lastSeq);
  Serial2.print(',');
  Serial2.print(armed ? 1 : 0);
  Serial2.print(',');
  Serial2.print(estop ? 1 : 0);
  Serial2.print(',');
  Serial2.print(leftMicros);
  Serial2.print(',');
  Serial2.print(rightMicros);
  Serial2.print(',');
  Serial2.print(gpsFix ? 1 : 0);
  Serial2.print(',');
  Serial2.print(latitude, 7);
  Serial2.print(',');
  Serial2.print(longitude, 7);
  Serial2.print(',');
  Serial2.print(altitudeMeters, 2);
  Serial2.print(',');
  Serial2.print(headingDeg, 1);
  Serial2.print(',');
  Serial2.println(speedMps, 2);
}

void sendWinchStatus()
{
  Serial2.print(F("P,"));
  Serial2.print(lastSeq);
  Serial2.print(',');
  Serial2.print(winchDirection);
  Serial2.print(',');
  Serial2.println(winchSpeed);
}

bool parseDriveCommand(const char* line, int* values, int expectedCount)
{
  if (line[0] != 'D' || line[1] != ',')
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

bool parseWinchCommand(const char* line, int* values, int expectedCount)
{
  if (line[0] != 'W' || line[1] != ',')
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

int clampWinchSpeed(int value)
{
  if (value < 0)
    return 0;
  if (value > 255)
    return 255;
  return value;
}

void applyWinch(int direction, int speed)
{
  const int clampedSpeed = clampWinchSpeed(speed);

  if (direction > 0)
  {
    analogWrite(kWinchLowerPin, clampedSpeed);
    analogWrite(kWinchRaisePin, 0);
    return;
  }

  if (direction < 0)
  {
    analogWrite(kWinchLowerPin, 0);
    analogWrite(kWinchRaisePin, clampedSpeed);
    return;
  }

  analogWrite(kWinchLowerPin, 0);
  analogWrite(kWinchRaisePin, 0);
}

void printLineHex(const char* line)
{
  Serial.print('[');
  for (size_t i = 0; line[i] != '\0'; i++)
  {
    const uint8_t value = static_cast<uint8_t>(line[i]);
    if (value < 16)
      Serial.print('0');
    Serial.print(value, HEX);
    if (line[i + 1] != '\0')
      Serial.print(' ');
  }
  Serial.println(']');
}
