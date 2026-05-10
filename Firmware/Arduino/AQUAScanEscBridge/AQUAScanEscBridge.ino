/*
  AQUAScan Arduino boat ESC bridge.

  Target board: Arduino Mega 2560
  USB Serial: 115200 debug monitor
  Serial2: 19200 link to the ESP32 boat gateway

  ESP32 -> Arduino:
    D,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>

  Arduino -> ESP32:
    S,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>
*/

#include <Servo.h>

namespace
{
  const uint8_t kLeftEscPin = 9;
  const uint8_t kRightEscPin = 10;

  const unsigned long kBridgeBaudRate = 19200;
  const unsigned long kDebugBaudRate = 115200;
  const unsigned long kStartupNeutralDelayMs = 5000;
  const unsigned long kCommandTimeoutMs = 3500;
  const unsigned long kStatusIntervalMs = 250;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
  const size_t kMaxLineLength = 96;
}

Servo leftEsc;
Servo rightEsc;

char serialLine[kMaxLineLength];
size_t serialLineLength = 0;

bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
unsigned long lastCommandAt = 0;
unsigned long lastStatusAt = 0;

void applyOutputs(int left, int right);
void readBridgeCommands();
void handleCommand(const char* line);
void neutralize(const char* reason, bool clearEstop);
void sendStatus();
bool parseDriveCommand(const char* line, int* values, int expectedCount);
int clampPulse(int value);
void printLineHex(const char* line);

void setup()
{
  Serial.begin(kDebugBaudRate);
  Serial2.begin(kBridgeBaudRate);

  leftEsc.attach(kLeftEscPin);
  rightEsc.attach(kRightEscPin);

  applyOutputs(kNeutralMicros, kNeutralMicros);
  Serial.println(F("AQUAScan ESC bridge booting. Holding neutral for ESC arming."));
  delay(kStartupNeutralDelayMs);

  sendStatus();
  Serial.println(F("AQUAScan Mega ESC bridge ready on Serial2."));
}

void loop()
{
  const unsigned long now = millis();

  readBridgeCommands();

  if (lastCommandAt > 0 && now - lastCommandAt > kCommandTimeoutMs)
    neutralize("command timeout", false);

  if (now - lastStatusAt >= kStatusIntervalMs)
    sendStatus();
}

void readBridgeCommands()
{
  while (Serial2.available() > 0)
  {
    const char incoming = static_cast<char>(Serial2.read());

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
  if (line[0] != 'D')
  {
    Serial.print(F("Ignored bridge noise: "));
    printLineHex(line);
    return;
  }

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
  sendStatus();

  Serial.print(F("Drive seq="));
  Serial.print(lastSeq);
  Serial.print(F(" armed="));
  Serial.print(armed ? 1 : 0);
  Serial.print(F(" estop="));
  Serial.print(estop ? 1 : 0);
  Serial.print(F(" left="));
  Serial.print(leftMicros);
  Serial.print(F(" right="));
  Serial.println(rightMicros);
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
  sendStatus();

  Serial.print(F("Neutralized: "));
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
  Serial2.println(rightMicros);
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

int clampPulse(int value)
{
  if (value < kMinMicros)
    return kMinMicros;
  if (value > kMaxMicros)
    return kMaxMicros;
  return value;
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
