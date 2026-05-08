export type Vec3 = [number, number, number]

export type AquaSample = {
  timestamp: string
  latitude: number
  longitude: number
  altitude?: number
  headingDeg?: number
  speedMps?: number
  depthMeters?: number
  batteryPercent?: number
  metrics: Record<string, number>
  localPosition: Vec3
}

export type GeoReference = {
  originLatitude: number
  originLongitude: number
  originAltitude?: number
}

export type AquaMission = {
  missionName: string
  sourceFile?: string
  geoReference: GeoReference
  samples: AquaSample[]
}

export type MetricDescriptor = {
  id: string
  displayName: string
  unit: string
  expectedRange: [number, number]
  gradient: string[]
}

export type PredictionResult = {
  oxygenNow: number
  oxygen30Minutes: number
  oxygen60Minutes: number
  oxygen120Minutes: number
  bloomRisk: number
  anomalyRisk: number
  backendName: string
  status: string
}

export type DriveCommand = {
  seq: number
  armed: boolean
  estop: boolean
  joystickX: number
  joystickY: number
  leftMicros: number
  rightMicros: number
}

export type DriveStatus = {
  connected: boolean
  armed: boolean
  estop: boolean
  lastSeq: number
  leftMicros: number
  rightMicros: number
  rssi?: number
  latitude?: number
  longitude?: number
  altitude?: number
  headingDeg?: number
  speedMps?: number
  batteryPercent?: number
  depthMeters?: number
  lastSeenUtc: string
}

export type TelemetryHealth = 'offline' | 'connecting' | 'fresh' | 'stale' | 'error'

export type TelemetrySnapshot = DriveStatus & {
  receivedAtMs: number
  packetAgeMs: number
}

export type LiveSettings = {
  host: string
  port: number
  deadzone: number
  maxOutput: number
  sendRateHz: number
  timeoutSeconds: number
}

export type LayerVisibility = {
  track: boolean
  points: boolean
  heatmap: boolean
}

export type TabId = 'setup' | 'run' | 'drive' | 'ai' | 'sensors' | 'planner' | 'review'
