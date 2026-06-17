# AQUAScan Web

Public-facing AQUAScan website and frontend-only local control dashboard.

## Pages

- `/` - AQUAScan overview and primary landing page
- `/technology` - vessel, navigation, sensing, and data-system overview
- `/impact` - environmental-monitoring value and applications
- `/about` - project purpose and design principles
- `/control` - Google-authenticated live-control and mission dashboard

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

## Firebase Backend Setup

The `/control` route uses Firebase Authentication and Cloud Firestore. The code
is configured for the existing Firebase project number `754800118914`.

In the Firebase console:

1. Open the existing AQUAScan project.
2. Go to Authentication -> Sign-in method.
3. Enable Email/Password.
4. Enable Google.
5. Go to Firestore Database and create a database if one does not exist.
6. Add your local/deployed domains under Authentication -> Settings ->
   Authorized domains.

After signing into the Firebase CLI, this repo can register/reuse a Web app in
that project and write the Firebase SDK config into `.env.local`:

```powershell
npx firebase-tools login
npm run firebase:setup
```

Add these variables locally in `.env.local` or in Vercel Project Settings ->
Environment Variables:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_AQUASCAN_ALLOWED_EMAILS=you@gmail.com,teammate@gmail.com
```

`VITE_AQUASCAN_ALLOWED_EMAILS` accepts comma- or space-separated exact email
addresses. Domain entries such as `@school.edu` are also supported.

Deploy the included Firestore rules after Firebase login/setup:

```powershell
npm run firebase:deploy:firestore
```

This protects the dashboard UI. The boat relay should also verify the same
Firebase/Google token before accepting motor or winch commands.

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
