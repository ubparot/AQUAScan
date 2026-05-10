# AQUAScan

AQUAScan is a Unity-based visualization and control project for a semi-autonomous
water-quality monitoring vessel. It combines mission replay, GPS-tagged sensor
visualization, live WebSocket boat control, firmware for the ESP32/Arduino control
chain, a browser dashboard, and a first-pass ML pipeline for water-quality
prediction.

## What This Repository Contains

- **Unity visualization** for mission playback, live boat telemetry, sample point
  clouds, heatmaps, route rendering, and depth-probe display.
- **Live control stack** that sends differential-drive commands over WebSocket to
  an ESP32 boat gateway and then to an Arduino Mega ESC bridge.
- **Web dashboard** built with React, Vite, Three.js, and ONNX Runtime Web for
  local mission review, simulation, and direct boat control.
- **ML pipeline** for training and exporting a multi-task water-quality model from
  mission CSV/JSON files and synthetic mission data.
- **Firmware sketches** for ESP32 networking/sensor bring-up and Arduino ESC
  pulse control.

## Repository Layout

```text
Assets/                    Unity scenes, scripts, shaders, sample missions, tests
Assets/Docs/AQUAScan.md    Detailed Unity/live-control operating notes
Firmware/                  ESP32 and Arduino sketches
ML/                        Python training, data loading, tests, exported artifacts
Packages/                  Unity package manifest and local packages
ProjectSettings/           Unity project settings
Tools/                     Portfolio graph and workbook generation scripts
web/                       React/Vite dashboard
```

## Requirements

- Unity **2022.3.57f1** or compatible Unity 2022.3 LTS editor
- Unity Universal Render Pipeline 14.x, UGUI, TextMeshPro, Timeline, and Unity Test
  Framework packages
- Node.js and npm for the web dashboard
- Python 3.10+ recommended for the ML and tooling scripts
- Arduino IDE or CLI with ESP32 board support for firmware flashing

## Unity Quick Start

1. Open the repository root in Unity Hub using Unity `2022.3.57f1`.
2. Let Unity restore packages from `Packages/manifest.json`.
3. Open `Assets/Scenes/SampleScene.unity`.
4. Use the included sample mission files in `Assets/StreamingAssets/` for playback.
5. For live control, configure the boat host and port in the runtime HUD, switch to
   `Live Control`, connect, then arm only after confirming neutral output.

The Unity project supports two main operating modes:

- `Playback`: load CSV/JSON missions, scrub the timeline, and visualize
  GPS-tagged sensor layers.
- `Live Control`: drive the dual-motor vessel over Wi-Fi while keeping the mission
  visualization shell available.

Detailed scene setup, wiring, WebSocket payloads, serial protocol, and operator
flow are documented in `Assets/Docs/AQUAScan.md`.

## Web Dashboard

The `web/` app is a frontend-only local control and visualization dashboard.

```powershell
cd web
npm install
npm run dev
```

Useful checks:

```powershell
npm run test
npm run build
npm run lint
```

The app can load mission CSV/JSON files, render a React Three Fiber lake scene,
show telemetry and predictions, and connect directly to the boat over
`ws://<boat-host>:81/`.

## ML Pipeline

The `ML/` folder trains a multi-task model from mission files and synthetic data.

```powershell
cd ML
pip install -r requirements.txt
python -m aquascan_ml.train --epochs 3 --synthetic-missions 12 --mission-dir ..\Assets\StreamingAssets
```

Artifacts are written to `ML/artifacts/`, including:

- `aquascan_multitask.pt`
- `aquascan_multitask.onnx`
- `normalization.json`
- `metrics.json`
- `prediction_sample.csv`

Run the Python checks with:

```powershell
cd ML
pytest
```

## Firmware

Primary firmware entry points:

- `Firmware/ESP32/AQUAScanESP32/AQUAScanESP32.ino`
- `Firmware/ESP32/AQUAScanSensors/AQUAScanSensors.ino`
- `Firmware/Arduino/AQUAScanEscBridge/AQUAScanEscBridge.ino`

The live-control topology is:

```text
Unity or web dashboard -> WebSocket -> ESP32 -> Serial2 -> Arduino Mega -> ESCs
```

Default control settings:

- ESP32 WebSocket endpoint: `ws://<esp32-ip>:81/`
- ESC neutral: `1500` microseconds
- ESC reverse range: `1000-1499`
- ESC forward range: `1501-2000`
- command send rate: `20 Hz`
- safety timeout: `300 ms`

Before field testing, confirm Wi-Fi credentials, serial pin assignments, shared
ground, neutral pulse output, and E-stop behavior with motors disconnected.

## Mission Data

CSV missions should include:

```text
timestamp,latitude,longitude,temperature,ph,do,salinity,tds,conductivity,turbidity,light,uv,depth,heading,speed,battery
```

JSON missions use a `missionName` and `samples` array. Each sample includes
timestamp, latitude, longitude, and a `metrics` object:

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

Default visualization metrics include temperature, pH, dissolved oxygen,
salinity, total dissolved solids, conductivity, turbidity, light, ultraviolet,
depth, speed, and battery.

## Validation

Recommended checks before sharing changes:

```powershell
# Unity
# Run EditMode tests in the Unity Test Runner.

# Web
cd web
npm run test
npm run build
npm run lint

# ML
cd ..\ML
pytest
```

## Safety Notes

Live-control code defaults to disarmed startup, neutral-on-timeout behavior, and
latched E-stop handling. Treat this as a software safeguard only: validate ESC
pulses, wiring, power isolation, and mechanical safety procedures on the bench
before operating the vessel near people or fragile equipment.
