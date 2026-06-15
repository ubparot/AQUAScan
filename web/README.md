# AQUAScan Web

Public-facing AQUAScan website and frontend-only local control dashboard.

## Pages

- `/` - AQUAScan overview and primary landing page
- `/technology` - vessel, navigation, sensing, and data-system overview
- `/impact` - environmental-monitoring value and applications
- `/about` - project purpose and design principles
- `/control` - existing live-control and mission dashboard

The included `vercel.json` rewrites public routes to the Vite application when
the site is deployed on Vercel.

## Run

```powershell
npm install
npm run dev
```

Vite listens on all network interfaces. On another device connected to the same
network, open the `Network` URL printed by Vite, such as:

```text
http://192.168.0.90:5173/
```

If Windows prompts for firewall access, allow Node.js on private networks. If it
does not prompt and the page cannot be reached, open port 5173 for private
networks in Windows Defender Firewall.

The dashboard starts in hardware/live mode and defaults to the ESP access-point
route at `ws://192.168.4.1:81/`. Loading the website and connecting to the boat
are separate network connections. The operator device must also have a route to
the ESP access point before live control will work.

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
