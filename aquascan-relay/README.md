# AQUAScan Relay Worker

Cloudflare Worker + Durable Object relay for public-domain AQUAScan control.

## Setup

```powershell
cd aquascan-relay
npm install
npx wrangler login
npx wrangler secret put AQUASCAN_DEVICE_TOKEN
npm run deploy
```

Use a long random `AQUASCAN_DEVICE_TOKEN`. The ESP32 uses that token to authenticate as the boat.

## Routes

- `/health` - JSON health check
- `/operator` - browser/operator WebSocket
- `/boat` - ESP32/boat WebSocket

After deploy, the relay URLs look like:

```text
wss://aquascan-relay.<your-workers-subdomain>.workers.dev/operator
wss://aquascan-relay.<your-workers-subdomain>.workers.dev/boat
```

## Important

This scaffold wires WebSocket routing and boat token auth. Before real public motor control, operator auth must verify Firebase ID tokens against `FIREBASE_PROJECT_ID`.
