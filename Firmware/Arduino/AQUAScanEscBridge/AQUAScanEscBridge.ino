#include <Servo.h>

namespace
{
  const uint8_t kLeftEscPin = 9;
  const uint8_t kRightEscPin = 10;
  const unsigned long kBridgeBaudRate = 19200;
  const unsigned long kDebugBaudRate = 115200;
  const unsigned long kStartupNeutralDelayMs = 5000;
  const unsigned long kCommandTimeoutMs = 300;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
}

Servo leftEsc;
Servo rightEsc;

String serialLine;
bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
unsigned long lastCommandAt = 0;

void setup()
{
  Serial.begin(kDebugBaudRate);
  Serial1.begin(kBridgeBaudRate);
  leftEsc.attach(kLeftEscPin);
  rightEsc.attach(kRightEscPin);

  applyOutputs(kNeutralMicros, kNeutralMicros);
  delay(kStartupNeutralDelayMs);
  sendStatus();
  Serial.println("AquaScan Mega ESC bridge ready on Serial1");
}

void loop()
{
  readSerialCommands();

  if (lastCommandAt > 0 && millis() - lastCommandAt > kCommandTimeoutMs)
    neutralize("timeout");
}

void readSerialCommands()
{
  while (Serial1.available() > 0)
  {
    char incoming = static_cast<char>(Serial1.read());
    if (incoming == '\n' || incoming == '\r')
    {
      if (serialLine.length() > 0)
      {
        handleCommand(serialLine);
        serialLine = "";
      }
      continue;
    }

    serialLine += incoming;
  }
}

void handleCommand(const String& line)
{
  if (!line.startsWith("D,"))
    return;

  int values[5] = { lastSeq, 0, 0, kNeutralMicros, kNeutralMicros };
  if (!parseCsvIntegers(line.substring(2), values, 5))
    return;

  int nextSeq = values[0];
  bool nextArmed = values[1] != 0;
  bool nextEStop = values[2] != 0;
  int nextLeft = constrain(values[3], kMinMicros, kMaxMicros);
  int nextRight = constrain(values[4], kMinMicros, kMaxMicros);

  lastSeq = nextSeq;
  estop = nextEStop;
  armed = nextArmed && !estop;
  leftMicros = armed ? nextLeft : kNeutralMicros;
  rightMicros = armed ? nextRight : kNeutralMicros;
  lastCommandAt = millis();

  applyOutputs(leftMicros, rightMicros);
  Serial.print("Applied drive seq=");
  Serial.print(lastSeq);
  Serial.print(" armed=");
  Serial.print(armed ? 1 : 0);
  Serial.print(" estop=");
  Serial.print(estop ? 1 : 0);
  Serial.print(" left=");
  Serial.print(leftMicros);
  Serial.print(" right=");
  Serial.println(rightMicros);
  sendStatus();
}

void applyOutputs(int left, int right)
{
  leftEsc.writeMicroseconds(constrain(left, kMinMicros, kMaxMicros));
  rightEsc.writeMicroseconds(constrain(right, kMinMicros, kMaxMicros));
}

void neutralize(const char* reason)
{
  armed = false;
  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = 0;
  applyOutputs(leftMicros, rightMicros);
  sendStatus();
  Serial.print("# ");
  Serial.println(reason);
}

void sendStatus()
{
  Serial1.print("S,");
  Serial1.print(lastSeq);
  Serial1.print(",");
  Serial1.print(armed ? 1 : 0);
  Serial1.print(",");
  Serial1.print(estop ? 1 : 0);
  Serial1.print(",");
  Serial1.print(leftMicros);
  Serial1.print(",");
  Serial1.println(rightMicros);

  Serial.print("Status -> S,");
  Serial.print(lastSeq);
  Serial.print(",");
  Serial.print(armed ? 1 : 0);
  Serial.print(",");
  Serial.print(estop ? 1 : 0);
  Serial.print(",");
  Serial.print(leftMicros);
  Serial.print(",");
  Serial.println(rightMicros);
}

bool parseCsvIntegers(const String& csv, int* values, int expectedCount)
{
  int start = 0;
  for (int i = 0; i < expectedCount; i++)
  {
    int separator = csv.indexOf(',', start);
    String token;
    if (separator < 0)
    {
      if (i != expectedCount - 1)
        return false;
      token = csv.substring(start);
    }
    else
    {
      token = csv.substring(start, separator);
      start = separator + 1;
    }

    token.trim();
    if (token.length() == 0)
      return false;

    values[i] = token.toInt();
  }

  return true;
}
