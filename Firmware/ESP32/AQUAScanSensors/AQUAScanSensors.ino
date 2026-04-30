/*
  AquaScan ESP32 sensor bring-up sketch.

  This sketch only prints sensor data to the Serial Monitor for now.
  It leaves RS485 initialized and ready for future Modbus/serial probes.

  Serial Monitor: 115200 baud
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

  const int kLightDigitalPin = 27;
  const int kLightAnalogPin = 34;

  const int kTdsAnalogPin = 35;
  const int kTurbidityAnalogPin = 32;
  const int kUvAnalogPin = 33;

  const int kUltrasonicTrigPin = 26;
  const int kUltrasonicEchoPin = 25;

  const int kRs485TxPin = 17;
  const int kRs485RxPin = 16;
  const int kRs485ControlPin = 5;

  const unsigned long kSerialBaud = 115200;
  const unsigned long kRs485Baud = 9600;
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
    "light_do,light_ao_raw,light_ao_v,"
    "tds_raw,tds_v,"
    "turbidity_raw,turbidity_v,"
    "uv_raw,uv_v,"
    "distance_cm");
}

void printValueOrNaN(float value, int decimals)
{
  if (isnan(value))
    Serial.print("nan");
  else
    Serial.print(value, decimals);
}

void sampleAndPrint()
{
  float temperatureC = readTemperatureC();
  int tempRawGpio = digitalRead(kTempPin);

  int lightDigital = digitalRead(kLightDigitalPin);
  int lightAnalogRaw = analogRead(kLightAnalogPin);
  int tdsRaw = analogRead(kTdsAnalogPin);
  int turbidityRaw = analogRead(kTurbidityAnalogPin);
  int uvRaw = analogRead(kUvAnalogPin);

  float distanceCm = readUltrasonicDistanceCm();

  Serial.print(sampleSeq++);
  Serial.print(",");
  printValueOrNaN(temperatureC, 2);
  Serial.print(",");
  Serial.print(tempRawGpio);
  Serial.print(",");
  Serial.print(lightDigital);
  Serial.print(",");
  Serial.print(lightAnalogRaw);
  Serial.print(",");
  Serial.print(adcToVoltage(lightAnalogRaw), 3);
  Serial.print(",");
  Serial.print(tdsRaw);
  Serial.print(",");
  Serial.print(adcToVoltage(tdsRaw), 3);
  Serial.print(",");
  Serial.print(turbidityRaw);
  Serial.print(",");
  Serial.print(adcToVoltage(turbidityRaw), 3);
  Serial.print(",");
  Serial.print(uvRaw);
  Serial.print(",");
  Serial.print(adcToVoltage(uvRaw), 3);
  Serial.print(",");
  printValueOrNaN(distanceCm, 1);
  Serial.println();

  drainRs485ToSerial();
}

void setup()
{
  Serial.begin(kSerialBaud);
  delay(500);

  pinMode(kTempPin, INPUT);
  pinMode(kLightDigitalPin, INPUT);
  pinMode(kUltrasonicTrigPin, OUTPUT);
  pinMode(kUltrasonicEchoPin, INPUT);
  pinMode(kRs485ControlPin, OUTPUT);
  setRs485ReceiveMode();

  analogReadResolution(12);
  analogSetPinAttenuation(kLightAnalogPin, ADC_11db);
  analogSetPinAttenuation(kTdsAnalogPin, ADC_11db);
  analogSetPinAttenuation(kTurbidityAnalogPin, ADC_11db);
  analogSetPinAttenuation(kUvAnalogPin, ADC_11db);

#if AQUASCAN_HAS_DS18B20
  tempSensor.begin();
#endif

  Rs485Serial.begin(kRs485Baud, SERIAL_8N1, kRs485RxPin, kRs485TxPin);

  Serial.println("AquaScan ESP32 sensor monitor");
#if AQUASCAN_HAS_DS18B20
  Serial.println("Temperature mode: DS18B20 on GPIO 4");
#else
  Serial.println("Temperature mode: DS18B20 libraries not installed; temp_c will print nan");
#endif
  Serial.println("RS485 mode: receive-only placeholder on UART2");
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
