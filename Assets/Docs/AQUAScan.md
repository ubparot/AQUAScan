## AquaScan

Unity 2022.3 project for the Engineering Design portfolio solution **AquaScan**: a small semi-autonomous water-quality monitoring vessel with a deployable depth probe, GPS-tagged samples, live vessel control, and mission replay.

The project now supports two operating modes:
- `Playback`: load CSV/JSON missions, scrub the timeline, and visualize GPS-tagged sensor layers
- `Live Control`: drive the dual-motor surface vessel over Wi-Fi with an on-screen joystick while keeping the mission visualization shell available

### Portfolio Alignment
This Unity project is the software and visualization component described in the portfolio:
- shows boat path and GPS sampling points
- visualizes selected water-quality layers as sample points and heatmaps
- supports depth-aware records from the deployable probe
- presents live system status and motor outputs for the ESP32/Arduino control chain
- replays collected CSV/JSON data so measurements can be interpreted after field testing

Supported default portfolio metrics:
- temperature
- pH
- dissolved oxygen
- salinity
- total dissolved solids
- conductivity
- turbidity
- light
- ultraviolet
- depth
- speed
- battery

### Scene Setup
1. Create an empty GameObject `AquaRoot` and add:
   - `AquaMissionController`
   - `AquaMissionPlayer`
   - `BoatTrackRenderer` with `LineRenderer`
   - `SamplePointCloud`
   - `HeatmapSurface`
   - `AquaSceneOverhaul`
2. Assign the boat marker transform to `BoatTrackRenderer.BoatMarker`.
3. Keep the existing UGUI mission controls wired to `AquaMissionController`.
4. `AquaSceneOverhaul` will build the live control HUD at runtime, including:
   - live mode toggle
   - boat IP/port fields
   - deadzone and max output fields
   - connect, arm, and E-stop buttons
   - joystick
   - connection and ESC pulse readouts
5. A runtime `EventSystem` is auto-created if the scene does not already have one.

### Live Control Topology
`Unity -> WebSocket -> ESP32 -> serial bridge -> Arduino -> SeaKing ESCs`

Defaults:
- ESP32 WebSocket endpoint: `ws://<esp32-ip>:81/`
- ESC neutral: `1500` microseconds
- ESC reverse range: `1000-1499`
- ESC forward range: `1501-2000`
- heartbeat/send rate: `20 Hz`
- timeout: `300 ms`

Network startup:
- the ESP32 now tries to join your router first using `kStaSsid` and `kStaPassword`
- if router join fails, it falls back to AP mode as `AquaScan-Boat`
- check the ESP32 serial monitor at `115200` to see which mode it started in and what IP it got

### Unity Control Contract
Unity sends JSON frames over WebSocket.

Hello:
```json
{"type":"hello","client":"AquaScan","version":"0.1.0"}
```

Drive:
```json
{"type":"drive","seq":42,"armed":true,"estop":false,"x":0.25,"y":0.8,"left":1875,"right":1625}
```

E-stop:
```json
{"type":"estop","seq":43}
```

ESP32 status:
```json
{"type":"status","connected":true,"armed":true,"estop":false,"lastSeq":42,"left":1875,"right":1625,"rssi":-1}
```

### Serial Contract Between ESP32 and Arduino
ESP32 to Arduino:
```text
D,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>\n
```

Arduino to ESP32:
```text
S,<seq>,<armed>,<estop>,<leftMicros>,<rightMicros>\n
```

Examples:
```text
D,42,1,0,1875,1625
S,42,1,0,1875,1625
```

### Recommended Wiring
Adjust pins before flashing if your board layout differs.

ESP32:
- `Serial2` RX: `GPIO16`
- `Serial2` TX: `GPIO17`
- uses hardware UART instead of software serial

Arduino Mega:
- left ESC signal pin: `9`
- right ESC signal pin: `10`
- USB debug stays on `Serial` at `115200`
- ESP32 bridge uses `Serial1` at `19200`
- Mega `RX1` = pin `19`
- Mega `TX1` = pin `18`
- wire ESP32 `TX` -> Mega `RX1` (`19`)
- wire ESP32 `RX` -> Mega `TX1` (`18`)

Common requirements:
- shared ground between ESP32, Arduino, and ESC signal ground
- do not power the ESP32 directly from an ESC BEC without confirming voltage regulation
- keep motors disconnected for first bring-up and pulse verification

### Firmware Files
- ESP32 sketch: `Firmware/ESP32/AQUAScanESP32/AQUAScanESP32.ino`
- Arduino Mega sketch: `Firmware/Arduino/AQUAScanEscBridge/AQUAScanEscBridge.ino`

### Router Mode Setup
Before flashing the ESP32 sketch, edit these constants:
```cpp
const char* kStaSsid = "YOUR_ROUTER_SSID";
const char* kStaPassword = "YOUR_ROUTER_PASSWORD";
```

After boot:
- open the ESP32 serial monitor at `115200`
- if router join succeeds, Unity should connect to the printed `ESP32 IP`
- if router join fails, the ESP32 will start the fallback AP `AquaScan-Boat`

### Operator Flow
1. Power the Arduino and ESP32.
2. Wait for ESC startup to settle at neutral.
3. Open the ESP32 serial monitor at `115200` and note the network mode and IP.
4. If the ESP32 joined your router, keep the control laptop on that same router network.
5. If the ESP32 fell back to AP mode, connect the control laptop to `AquaScan-Boat`.
6. In Unity, set the host field to the ESP32 IP that was printed on serial.
7. Switch Unity to `Live Control`.
8. Verify the connection status shows connected before arming.
9. Arm only with the joystick centered.
10. Drive with the joystick.
11. Press `E-Stop` for any unsafe behavior.
12. Disarm before disconnecting power.

### Safety Behavior
- startup is disarmed
- joystick release returns requested output to neutral
- disconnect, malformed message, or timeout forces neutral
- E-stop latches until reset in the Unity HUD
- switching back to `Playback` disconnects the live socket

### ESP32 Notes
- The Unity-side WebSocket protocol is unchanged.
- The ESP32 sketch uses `Serial2` by default, so it is more reliable than the previous ESP8266 software-serial bridge.
- If your ESP32 board routes `Serial2` differently, change `kBridgeRxPin` and `kBridgeTxPin` in the sketch before flashing.
- In router mode, Unity should no longer use the hardcoded `192.168.4.1` unless the ESP32 actually fell back to AP mode.

### Arduino Mega Notes
- The Mega bridge now uses `Serial1` for ESP32 comms and keeps USB `Serial` free for the serial monitor.
- Open the Arduino serial monitor at `115200` if you want to see applied drive/status debug without interfering with the ESP32 link.

### Playback / Data Visualization
Mission playback is unchanged:
- metric dropdown still drives point cloud and heatmap coloring
- track, points, and heatmap toggles remain available
- timeline, play/pause, and mission loading remain active in `Playback`

CSV header example:
```text
timestamp,latitude,longitude,temperature,ph,do,salinity,tds,conductivity,turbidity,light,uv,depth,heading,speed,battery
```

JSON example:
```json
{
  "missionName": "Demo JSON Mission",
  "samples": [
    {
      "timestamp": "2025-01-01T12:00:00Z",
      "latitude": 37.4251,
      "longitude": -122.0841,
      "metrics": {
        "temperature": 16.2,
        "ph": 7.5,
        "do": 8.4,
        "tds": 320,
        "turbidity": 5.0,
        "light": 980,
        "uv": 1.8
      }
    }
  ]
}
```
