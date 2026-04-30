#include <WiFi.h>
#include <WebSocketsServer.h>

namespace
{
  const char* kStaSsid = "SETUP-C4AF;
  const char* kStaPassword = "county5845drain";
  const unsigned long kStaConnectTimeoutMs = 15000;

  const char* kApSsid = "AquaScan-Boat";
  const char* kApPassword = "ChangeMe1234";

  const uint16_t kWebSocketPort = 81;
  const unsigned long kCommandTimeoutMs = 300;
  const unsigned long kStatusBroadcastIntervalMs = 250;
  const long kBridgeBaudRate = 19200;

  const int kBridgeRxPin = 16;
  const int kBridgeTxPin = 17;

  const int kNeutralMicros = 1500;
  const int kMinMicros = 1000;
  const int kMaxMicros = 2000;
}

HardwareSerial BridgeSerial(2);
WebSocketsServer webSocket(kWebSocketPort);

String bridgeLine;
bool hasSocketClient = false;
bool armed = false;
bool estop = false;
int lastSeq = 0;
int leftMicros = kNeutralMicros;
int rightMicros = kNeutralMicros;
unsigned long lastCommandAt = 0;
unsigned long lastStatusBroadcastAt = 0;

void startNetwork();
bool connectToRouter();
void startFallbackAccessPoint();

void setup()
{
  Serial.begin(115200);
  BridgeSerial.begin(kBridgeBaudRate, SERIAL_8N1, kBridgeRxPin, kBridgeTxPin);

  startNetwork();

  webSocket.begin();
  webSocket.onEvent(handleSocketEvent);

  neutralize("boot");
  Serial.println("AquaScan ESP32 bridge ready");
}

void loop()
{
  webSocket.loop();
  readBridgeStatus();

  if (hasSocketClient && millis() - lastStatusBroadcastAt >= kStatusBroadcastIntervalMs)
  {
    sendStatusBroadcast();
    lastStatusBroadcastAt = millis();
  }

  if (lastCommandAt > 0 && millis() - lastCommandAt > kCommandTimeoutMs)
    neutralize("timeout");
}

void handleSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length)
{
  switch (type)
  {
    case WStype_CONNECTED:
      hasSocketClient = true;
      Serial.printf("WebSocket client connected: #%u\n", clientNum);
      sendStatus(clientNum);
      break;

    case WStype_DISCONNECTED:
      hasSocketClient = false;
      Serial.printf("WebSocket client disconnected: #%u\n", clientNum);
      neutralize("disconnect");
      break;

    case WStype_TEXT:
      Serial.printf("WebSocket text from #%u: %.*s\n", clientNum, static_cast<int>(length), payload);
      handleTextMessage(clientNum, reinterpret_cast<const char*>(payload), length);
      break;

    default:
      break;
  }
}

void handleTextMessage(uint8_t clientNum, const char* payload, size_t length)
{
  String message(payload);
  message = message.substring(0, length);
  message.trim();

  if (message.indexOf("\"type\":\"hello\"") >= 0)
  {
    Serial.println("Received hello");
    sendStatus(clientNum);
    return;
  }

  if (message.indexOf("\"type\":\"estop\"") >= 0)
  {
    Serial.println("Received estop");
    estop = true;
    armed = false;
    leftMicros = kNeutralMicros;
    rightMicros = kNeutralMicros;
    lastSeq = readInt(message, "\"seq\":", lastSeq);
    sendBridgeCommand();
    sendStatus(clientNum);
    return;
  }

  if (message.indexOf("\"type\":\"drive\"") < 0)
  {
    Serial.println("Ignoring unknown message");
    neutralize("invalid");
    sendStatus(clientNum);
    return;
  }

  int nextSeq = readInt(message, "\"seq\":", lastSeq);
  bool nextArmed = readBool(message, "\"armed\":", false);
  bool nextEStop = readBool(message, "\"estop\":", false);
  int nextLeft = readInt(message, "\"left\":", kNeutralMicros);
  int nextRight = readInt(message, "\"right\":", kNeutralMicros);

  if (nextLeft < kMinMicros || nextLeft > kMaxMicros || nextRight < kMinMicros || nextRight > kMaxMicros)
  {
    neutralize("out-of-range");
    sendStatus(clientNum);
    return;
  }

  lastSeq = nextSeq;
  estop = nextEStop;
  armed = nextArmed && !estop;
  leftMicros = armed ? nextLeft : kNeutralMicros;
  rightMicros = armed ? nextRight : kNeutralMicros;
  lastCommandAt = millis();

  Serial.printf("Drive applied seq=%d armed=%d estop=%d left=%d right=%d\n", lastSeq, armed ? 1 : 0, estop ? 1 : 0, leftMicros, rightMicros);
  sendBridgeCommand();
  sendStatus(clientNum);
}

void readBridgeStatus()
{
  while (BridgeSerial.available() > 0)
  {
    char incoming = static_cast<char>(BridgeSerial.read());
    if (incoming == '\n' || incoming == '\r')
    {
      if (bridgeLine.length() > 0)
      {
        applyBridgeStatus(bridgeLine);
        bridgeLine = "";
      }
      continue;
    }

    bridgeLine += incoming;
  }
}

void applyBridgeStatus(const String& line)
{
  if (!line.startsWith("S,"))
    return;

  int values[5] = { lastSeq, armed ? 1 : 0, estop ? 1 : 0, leftMicros, rightMicros };
  if (!parseCsvIntegers(line.substring(2), values, 5))
    return;

  lastSeq = values[0];
  armed = values[1] != 0;
  estop = values[2] != 0;
  leftMicros = constrain(values[3], kMinMicros, kMaxMicros);
  rightMicros = constrain(values[4], kMinMicros, kMaxMicros);
  if (hasSocketClient)
    sendStatusBroadcast();
}

void sendBridgeCommand()
{
  BridgeSerial.printf(
    "D,%d,%d,%d,%d,%d\n",
    lastSeq,
    armed ? 1 : 0,
    estop ? 1 : 0,
    leftMicros,
    rightMicros);
}

void neutralize(const char* reason)
{
  armed = false;
  leftMicros = kNeutralMicros;
  rightMicros = kNeutralMicros;
  lastCommandAt = 0;
  sendBridgeCommand();
  if (hasSocketClient)
    sendStatusBroadcast();
  Serial.printf("Neutralized: %s\n", reason);
}

void sendStatus(uint8_t clientNum)
{
  String message = buildStatusJson();
  Serial.printf("Sending status to #%u: %s\n", clientNum, message.c_str());
  webSocket.sendTXT(clientNum, message);
}

void sendStatusBroadcast()
{
  String message = buildStatusJson();
  Serial.printf("Broadcasting status: %s\n", message.c_str());
  webSocket.broadcastTXT(message);
}

String buildStatusJson()
{
  String message = "{";
  message += "\"type\":\"status\",";
  message += "\"connected\":";
  message += hasSocketClient ? "true" : "false";
  message += ",\"armed\":";
  message += armed ? "true" : "false";
  message += ",\"estop\":";
  message += estop ? "true" : "false";
  message += ",\"lastSeq\":";
  message += String(lastSeq);
  message += ",\"left\":";
  message += String(leftMicros);
  message += ",\"right\":";
  message += String(rightMicros);
  message += ",\"rssi\":-1}";
  return message;
}

bool readBool(const String& message, const char* key, bool fallback)
{
  int index = message.indexOf(key);
  if (index < 0)
    return fallback;

  int valueIndex = index + strlen(key);
  if (message.startsWith("true", valueIndex))
    return true;
  if (message.startsWith("false", valueIndex))
    return false;
  return fallback;
}

int readInt(const String& message, const char* key, int fallback)
{
  int index = message.indexOf(key);
  if (index < 0)
    return fallback;

  int valueIndex = index + strlen(key);
  int endIndex = valueIndex;
  while (endIndex < static_cast<int>(message.length()) && (isDigit(message[endIndex]) || message[endIndex] == '-'))
    endIndex++;

  if (endIndex == valueIndex)
    return fallback;

  return message.substring(valueIndex, endIndex).toInt();
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

void startNetwork()
{
  if (!connectToRouter())
    startFallbackAccessPoint();
}

bool connectToRouter()
{
  if (String(kStaSsid) == "YOUR_ROUTER_SSID" || String(kStaPassword) == "YOUR_ROUTER_PASSWORD")
  {
    Serial.println("Router credentials not configured. Starting fallback AP.");
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(kStaSsid, kStaPassword);

  Serial.printf("Connecting to router SSID '%s'", kStaSsid);
  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < kStaConnectTimeoutMs)
  {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("Router connection failed.");
    WiFi.disconnect(true, true);
    return false;
  }

  Serial.print("Router connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void startFallbackAccessPoint()
{
  WiFi.mode(WIFI_AP);
  WiFi.softAP(kApSsid, kApPassword);
  Serial.print("Fallback AP started. SSID: ");
  Serial.println(kApSsid);
  Serial.print("Fallback AP IP: ");
  Serial.println(WiFi.softAPIP());
}
