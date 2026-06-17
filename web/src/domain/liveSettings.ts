import type { LiveSettings } from '../types/aqua'

export const espAccessPointHost = '192.168.4.1'
export const espWebSocketPort = 81
export const defaultRelayUrl = import.meta.env.VITE_AQUASCAN_RELAY_URL ?? 'wss://aquascan-relay.rocksparrot.workers.dev/operator'

export const defaultLiveSettings: LiveSettings = {
  host: espAccessPointHost,
  port: espWebSocketPort,
  relayUrl: defaultRelayUrl,
  deadzone: 0.08,
  maxOutput: 1,
  sendRateHz: 10,
  timeoutSeconds: 3,
}
