import type { LiveSettings } from '../types/aqua'

export const espAccessPointHost = '192.168.4.1'
export const espWebSocketPort = 81

export const defaultLiveSettings: LiveSettings = {
  host: espAccessPointHost,
  port: espWebSocketPort,
  deadzone: 0.08,
  maxOutput: 1,
  sendRateHz: 10,
  timeoutSeconds: 3,
}
