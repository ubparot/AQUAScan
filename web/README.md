# AQUAScan Web

Frontend-only local control dashboard for AQUAScan.

## Run

```powershell
npm install
npm run dev
```

Open the local Vite URL over HTTP. Direct live control uses `ws://<boat-host>:81/`, so the operator device must be able to reach the boat network.

## Boat Model Conversion

The app looks for `public/models/speed-boat.glb`. Blender is not bundled with this repo.

```powershell
npm run convert:boat
```

If Blender is not installed or `speed-boat.glb` is missing, the Three.js scene renders a procedural fallback boat.

## Included Behavior

- CSV/JSON mission loading from `public/missions/` or file upload
- Metric registry, timeline playback, track, sample points, and heatmap
- React Three Fiber lake scene
- Heuristic AI prediction ported from Unity
- Direct WebSocket `hello`, `drive`, `estop`, and `status` handling
- Local settings persistence for live control and layer visibility

## Checks

```powershell
npm run test
npm run build
npm run lint
```
