/*
  AquaScan ESP32 probe sensor transmitter.

  Samples probe sensors, prints them to the Serial Monitor, and transmits
  matching P-prefixed CSV lines to the Arduino Mega over RS-485.

  Serial Monitor: 19200 baud
  RS-485: 19200 baud, 8N1

  Probe ESP32 to MAX485-style module:
    GPIO17 TX -> DI
    GPIO16 RX <- RO
    GPIO5     -> DE and RE
    GND       -> GND

  With an automatic-flow TTL-to-RS485 module:
    GPIO17 TX -> module RXD
    GPIO16 RX <- module TXD
    GND       -> module GND
    GPIO5 is not connected.
*/

#if __has_include(<OneWire.h>) && __has_include(<DallasTemperature.h>)
  #include <OneWire.h>
  #include <DallasTemperature.h>
  #define AQUASCAN_HAS_DS18B20 1
#else
  #define AQUASCAN_HAS_DS18B20 0
#endif

namespace
{
  const int kTempPin = 4;

  const int kTurbidityAnalogPin = 35;
  const int kPhAnalogPin = 34;
  const int kDissolvedOxygenAnalogPin = 32;
  const int kTdsAnalogPin = 33;
  const int kUvAnalogPin = 36;      // ESP32 SVP/SUP/VP input-only analog pin
  const int kLightAnalogPin = 39;   // ESP32 SVN/VN input-only analog pin

  const int kUltrasonicTrigPin = 25;
  const int kUltrasonicEchoPin = 27;

  const int kRs485TxPin = 17;
  const int kRs485RxPin = 16;
  const int kRs485ControlPin = 5;

  const unsigned long kSerialBaud = 19200;
  const unsigned long kRs485Baud = 19200;
  const unsigned long kSampleIntervalMs = 1000;
  const unsigned long kUltrasonicTimeoutUs = 30000;

  const float kAdcReferenceVoltage = 3.3f;
  const float kAdcMaxValue = 4095.0f;
}

#if AQUASCAN_HAS_DS18B20
OneWire oneWire(kTempPin);
DallasTemperature tempSensor(&oneWire);
#endif

HardwareSerial Rs485Serial(2);

unsigned long lastSampleAt = 0;
unsigned long sampleSeq = 0;

float adcToVoltage(int raw)
{
  return (static_cast<float>(raw) / kAdcMaxValue) * kAdcReferenceVoltage;
}

float readTemperatureC()
{
#if AQUASCAN_HAS_DS18B20
  tempSensor.requestTemperatures();
  float temperatureC = tempSensor.getTempCByIndex(0);
  if (temperatureC == DEVICE_DISCONNECTED_C)
    return NAN;
  return temperatureC;
#else
  return NAN;
#endif
}

float readUltrasonicDistanceCm()
{
  digitalWrite(kUltrasonicTrigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(kUltrasonicTrigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(kUltrasonicTrigPin, LOW);

  unsigned long durationUs = pulseIn(kUltrasonicEchoPin, HIGH, kUltrasonicTimeoutUs);
  if (durationUs == 0)
    return NAN;

  return (durationUs * 0.0343f) / 2.0f;
}

void setRs485ReceiveMode()
{
  digitalWrite(kRs485ControlPin, LOW);
}

void setRs485TransmitMode()
{
  digitalWrite(kRs485ControlPin, HIGH);
}

void drainRs485ToSerial()
{
  while (Rs485Serial.available() > 0)
  {
    char incoming = static_cast<char>(Rs485Serial.read());
    Serial.print(incoming);
  }
}

void printCsvHeader()
{
  Serial.println(
    "seq,"
    "temp_c,temp_raw_gpio,"
    "turbidity_raw,turbidity_v,"
    "ph_raw,ph_v,"
    "distance_cm,"
    "do_raw,do_v,"
    "tds_raw,tds_v,"
    "uv_raw,uv_v,"
    "light_raw,light_v");
}

void printValueOrNaN(Print& output, float value, int decimals)
{
  if (isnan(value))
    output.print("nan");
  else
    output.print(value, decimals);
}

void printSensorCsv(
  Print& output,
  unsigned long sequence,
  float temperatureC,
  int tempRawGpio,
  int turbidityRaw,
  int phRaw,
  float distanceCm,
  int dissolvedOxygenRaw,
  int tdsRaw,
  int uvRaw,
  int lightAnalogRaw)
{
  output.print(sequence);
  output.print(',');
  printValueOrNaN(output, temperatureC, 2);
  output.print(',');
  output.print(tempRawGpio);
  output.print(',');
  output.print(turbidityRaw);
  output.print(',');
  output.print(adcToVoltage(turbidityRaw), 3);
  output.print(',');
  output.print(phRaw);
  output.print(',');
  output.print(adcToVoltage(phRaw), 3);
  output.print(',');
  printValueOrNaN(output, distanceCm, 1);
  output.print(',');
  output.print(dissolvedOxygenRaw);
  output.print(',');
  output.print(adcToVoltage(dissolvedOxygenRaw), 3);
  output.print(',');
  output.print(tdsRaw);
  output.print(',');
  output.print(adcToVoltage(tdsRaw), 3);
  output.print(',');
  output.print(uvRaw);
  output.print(',');
  output.print(adcToVoltage(uvRaw), 3);
  output.print(',');
  output.print(lightAnalogRaw);
  output.print(',');
  output.print(adcToVoltage(lightAnalogRaw), 3);
  output.println();
}

void sampleAndPrint()
{
  float temperatureC = readTemperatureC();
  int tempRawGpio = digitalRead(kTempPin);

  int turbidityRaw = analogRead(kTurbidityAnalogPin);
  int phRaw = analogRead(kPhAnalogPin);
  int dissolvedOxygenRaw = analogRead(kDissolvedOxygenAnalogPin);
  int tdsRaw = analogRead(kTdsAnalogPin);
  int uvRaw = analogRead(kUvAnalogPin);
  int lightAnalogRaw = analogRead(kLightAnalogPin);

  float distanceCm = readUltrasonicDistanceCm();
  const unsigned long sequence = sampleSeq++;

  printSensorCsv(
    Serial,
    sequence,
    temperatureC,
    tempRawGpio,
    turbidityRaw,
    phRaw,
    distanceCm,
    dissolvedOxygenRaw,
    tdsRaw,
    uvRaw,
    lightAnalogRaw);

  setRs485TransmitMode();
  delayMicroseconds(100);
  Rs485Serial.print(F("P,"));
  printSensorCsv(
    Rs485Serial,
    sequence,
    temperatureC,
    tempRawGpio,
    turbidityRaw,
    phRaw,
    distanceCm,
    dissolvedOxygenRaw,
    tdsRaw,
    uvRaw,
    lightAnalogRaw);
  Rs485Serial.flush();
  delayMicroseconds(100);
  setRs485ReceiveMode();
}

void setup()
{
  Serial.begin(kSerialBaud);
  delay(500);

  pinMode(kTempPin, INPUT);
  pinMode(kUltrasonicTrigPin, OUTPUT);
  pinMode(kUltrasonicEchoPin, INPUT);
  pinMode(kRs485ControlPin, OUTPUT);
  setRs485ReceiveMode();

  analogReadResolution(12);
  analogSetPinAttenuation(kTurbidityAnalogPin, ADC_11db);
  analogSetPinAttenuation(kPhAnalogPin, ADC_11db);
  analogSetPinAttenuation(kDissolvedOxygenAnalogPin, ADC_11db);
  analogSetPinAttenuation(kTdsAnalogPin, ADC_11db);
  analogSetPinAttenuation(kUvAnalogPin, ADC_11db);
  analogSetPinAttenuation(kLightAnalogPin, ADC_11db);

#if AQUASCAN_HAS_DS18B20
  tempSensor.begin();
#endif

  Rs485Serial.begin(kRs485Baud, SERIAL_8N1, kRs485RxPin, kRs485TxPin);

  Serial.println("AquaScan ESP32 probe sensor transmitter");
#if AQUASCAN_HAS_DS18B20
  Serial.println("Temperature mode: DS18B20 on GPIO 4");
#else
  Serial.println("Temperature mode: DS18B20 libraries not installed; temp_c will print nan");
#endif
  Serial.println("RS485 mode: transmitting P-prefixed sensor CSV on UART2 at 19200 8N1");
  printCsvHeader();
}

void loop()
{
  unsigned long now = millis();
  if (now - lastSampleAt >= kSampleIntervalMs)
  {
    lastSampleAt = now;
    sampleAndPrint();
  }

  drainRs485ToSerial();
}
