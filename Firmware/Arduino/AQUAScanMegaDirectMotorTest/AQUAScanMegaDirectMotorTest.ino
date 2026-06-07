/*
  AQUAScan Arduino Mega direct motor test.

  Target board: Arduino Mega 2560
  USB Serial: 19200

  Wiring:
    Left ESC signal  -> D9
    Right ESC signal -> D10
    ESC ground       -> Arduino GND

  Serial commands:
    help              show commands
    arm               enable motor commands at neutral
    stop              neutral and disarm
    neutral           neutral and disarm
    estop             latch emergency stop at neutral
    clear             clear emergency stop and disarm
    both 1500         set both ESCs to a pulse, 1000-2000 us
    esc 1500 1500     set left/right ESC pulses, 1000-2000 us
    drive 0 0         tank drive mix: throttle -100..100, turn -100..100

  Remove props for bench testing. Most ESCs use:
    1500 us = neutral
    >1500 us = forward
    <1500 us = reverse, if the ESC supports reverse
*/

#include <Servo.h>

namespace
{
  const uint8_t kLeftEscPin = 9;
  const uint8_t kRightEscPin = 10;

  const unsigned long kBaudRate = 19200;
  const unsigned long kStartupNeutralDelayMs = 5000;
  const unsigned long kStatusIntervalMs = 500;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
  const int kDriveMaxOffsetMicros = 350;
}

Servo leftEsc;
Servo rightEsc;

String commandLine;
bool armed = false;
bool estop = false;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
unsigned long lastCommandAt = 0;
unsigned long lastStatusAt = 0;

void readSerialCommands();
void handleCommand(String command);
void printHelp();
void printStatus();
void applyEscOutputs(int left, int right);
void neutralize(const __FlashStringHelper* reason, bool clearEstop);
void applyManualEscCommand(int left, int right);
void applyDriveCommand(int throttle, int turn);
int clampPulse(int value);
int clampPercent(int value);

void setup()
{
  Serial.begin(kBaudRate);

  leftEsc.attach(kLeftEscPin);
  rightEsc.attach(kRightEscPin);

  applyEscOutputs(kNeutralMicros, kNeutralMicros);

  Serial.println();
  Serial.println(F("AQUAScan Mega direct motor test"));
  Serial.println(F("Holding neutral so ESCs can arm. Remove props before testing."));
  delay(kStartupNeutralDelayMs);
  Serial.println(F("Ready. Type 'help'."));
  printStatus();
}

void loop()
{
  const unsigned long now = millis();

  readSerialCommands();

  if (now - lastStatusAt >= kStatusIntervalMs)
    printStatus();
}

void readSerialCommands()
{
  while (Serial.available() > 0)
  {
    const char incoming = static_cast<char>(Serial.read());

    if (incoming == '\n' || incoming == '\r')
    {
      commandLine.trim();
      if (commandLine.length() > 0)
        handleCommand(commandLine);
      commandLine = "";
      continue;
    }

    if (commandLine.length() < 96)
      commandLine += incoming;
    else
      commandLine = "";
  }
}

void handleCommand(String command)
{
  command.trim();
  command.toLowerCase();

  if (command == "help" || command == "?")
  {
    printHelp();
    return;
  }

  if (command == "status")
  {
    printStatus();
    return;
  }

  if (command == "arm")
  {
    if (estop)
    {
      Serial.println(F("E-stop is latched. Type 'clear' first."));
      return;
    }

    armed = true;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastCommandAt = millis();
    applyEscOutputs(leftMicros, rightMicros);
    Serial.println(F("Armed at neutral."));
    printStatus();
    return;
  }

  if (command == "stop" || command == "neutral" || command == "disarm")
  {
    neutralize(F("operator stop"), true);
    return;
  }

  if (command == "estop")
  {
    estop = true;
    neutralize(F("e-stop"), false);
    return;
  }

  if (command == "clear")
  {
    neutralize(F("e-stop cleared"), true);
    return;
  }

  if (command.startsWith("both "))
  {
    const int pulse = command.substring(5).toInt();
    applyManualEscCommand(pulse, pulse);
    return;
  }

  if (command.startsWith("esc "))
  {
    const int separator = command.indexOf(' ', 4);
    if (separator < 0)
    {
      Serial.println(F("Expected: esc <leftMicros> <rightMicros>"));
      return;
    }

    const int left = command.substring(4, separator).toInt();
    const int right = command.substring(separator + 1).toInt();
    applyManualEscCommand(left, right);
    return;
  }

  if (command.startsWith("drive "))
  {
    const int separator = command.indexOf(' ', 6);
    if (separator < 0)
    {
      Serial.println(F("Expected: drive <throttle -100..100> <turn -100..100>"));
      return;
    }

    const int throttle = command.substring(6, separator).toInt();
    const int turn = command.substring(separator + 1).toInt();
    applyDriveCommand(throttle, turn);
    return;
  }

  Serial.println(F("Unknown command. Type 'help'."));
}

void printHelp()
{
  Serial.println(F("Commands:"));
  Serial.println(F("  help              show this help"));
  Serial.println(F("  status            print current output"));
  Serial.println(F("  arm               enable motor commands at neutral"));
  Serial.println(F("  stop              neutral and disarm"));
  Serial.println(F("  neutral           neutral and disarm"));
  Serial.println(F("  estop             latch emergency stop at neutral"));
  Serial.println(F("  clear             clear emergency stop and disarm"));
  Serial.println(F("  both 1500         set both ESC pulses"));
  Serial.println(F("  esc 1500 1500     set left/right ESC pulses"));
  Serial.println(F("  drive 20 0        throttle/turn mix, each -100..100"));
  Serial.println(F("Pulse range: 1000-2000 us. Start near 1500 with props removed."));
}

void printStatus()
{
  lastStatusAt = millis();

  Serial.print(F("STATUS armed="));
  Serial.print(armed ? 1 : 0);
  Serial.print(F(" estop="));
  Serial.print(estop ? 1 : 0);
  Serial.print(F(" left="));
  Serial.print(leftMicros);
  Serial.print(F(" right="));
  Serial.println(rightMicros);
}

void applyEscOutputs(int left, int right)
{
  leftEsc.writeMicroseconds(clampPulse(left));
  rightEsc.writeMicroseconds(clampPulse(right));
}

void neutralize(const __FlashStringHelper* reason, bool clearEstop)
{
  armed = false;
  if (clearEstop)
    estop = false;

  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = 0;
  applyEscOutputs(leftMicros, rightMicros);

  Serial.print(F("Neutralized: "));
  Serial.println(reason);
  printStatus();
}

void applyManualEscCommand(int left, int right)
{
  if (estop)
  {
    Serial.println(F("E-stop is latched. Type 'clear' first."));
    return;
  }

  if (!armed)
  {
    Serial.println(F("Not armed. Type 'arm' first."));
    return;
  }

  if (left < kMinMicros || left > kMaxMicros || right < kMinMicros || right > kMaxMicros)
  {
    Serial.println(F("Pulse out of range. Use 1000-2000."));
    return;
  }

  leftMicros = left;
  rightMicros = right;
  lastCommandAt = millis();
  applyEscOutputs(leftMicros, rightMicros);
  printStatus();
}

void applyDriveCommand(int throttle, int turn)
{
  throttle = clampPercent(throttle);
  turn = clampPercent(turn);

  const int leftOffset = map(throttle + turn, -200, 200, -kDriveMaxOffsetMicros, kDriveMaxOffsetMicros);
  const int rightOffset = map(throttle - turn, -200, 200, -kDriveMaxOffsetMicros, kDriveMaxOffsetMicros);

  applyManualEscCommand(kNeutralMicros + leftOffset, kNeutralMicros + rightOffset);
}

int clampPulse(int value)
{
  if (value < kMinMicros)
    return kMinMicros;
  if (value > kMaxMicros)
    return kMaxMicros;
  return value;
}

int clampPercent(int value)
{
  if (value < -100)
    return -100;
  if (value > 100)
    return 100;
  return value;
}
