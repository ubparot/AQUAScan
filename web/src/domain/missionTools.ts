import type { AquaMission, AquaSample } from '../types/aqua'
import { metricValue } from './metrics'
import { missionDurationSeconds, sampleSeconds } from './playback'

export type MissionRouteSummary = {
  sampleCount: number
  durationSeconds: number
  routeDistanceMeters: number
  averageSpeedMps: number
  maxSpeedMps?: number
  boundsMeters: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
}

export type MetricRouteSummary = {
  count: number
  min?: number
  max?: number
  average?: number
}

export function summarizeMissionRoute(mission: AquaMission | undefined): MissionRouteSummary | undefined {
  if (!mission || mission.samples.length === 0) return undefined
  const xs = mission.samples.map((sample) => sample.localPosition[0])
  const zs = mission.samples.map((sample) => sample.localPosition[2])
  const speeds = mission.samples.map((sample) => sample.speedMps).filter((value): value is number => value !== undefined)
  const routeDistanceMeters = mission.samples.reduce((distance, sample, index) => {
    if (index === 0) return distance
    const previous = mission.samples[index - 1]
    const dx = sample.localPosition[0] - previous.localPosition[0]
    const dz = sample.localPosition[2] - previous.localPosition[2]
    return distance + Math.hypot(dx, dz)
  }, 0)
  const durationSeconds = missionDurationSeconds(mission)
  const averageSpeedMps = durationSeconds > 0 ? routeDistanceMeters / durationSeconds : 0

  return {
    sampleCount: mission.samples.length,
    durationSeconds,
    routeDistanceMeters,
    averageSpeedMps,
    maxSpeedMps: speeds.length > 0 ? Math.max(...speeds) : undefined,
    boundsMeters: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    },
  }
}

export function summarizeMetricRoute(mission: AquaMission | undefined, metricId: string): MetricRouteSummary {
  const values = mission?.samples.map((sample) => metricValue(sample, metricId)).filter((value): value is number => value !== undefined) ?? []
  if (values.length === 0) return { count: 0 }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: total / values.length,
  }
}

export function normalizedTimeForSample(mission: AquaMission | undefined, sampleIndex: number) {
  if (!mission || mission.samples.length < 2) return 0
  const sample = mission.samples[Math.max(0, Math.min(sampleIndex, mission.samples.length - 1))]
  const start = sampleSeconds(mission.samples[0])
  const duration = missionDurationSeconds(mission)
  if (duration <= 0) return 0
  return Math.max(0, Math.min(1, (sampleSeconds(sample) - start) / duration))
}

export function nearestSampleIndex(mission: AquaMission | undefined, normalizedTime: number) {
  if (!mission || mission.samples.length === 0) return undefined
  if (mission.samples.length === 1) return 0
  const start = sampleSeconds(mission.samples[0])
  const duration = missionDurationSeconds(mission)
  const target = start + Math.max(0, Math.min(1, normalizedTime)) * duration
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  mission.samples.forEach((sample, index) => {
    const distance = Math.abs(sampleSeconds(sample) - target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  return nearestIndex
}

export function exportMissionRoutePayload(mission: AquaMission, metricId: string) {
  return {
    missionName: mission.missionName,
    sourceFile: mission.sourceFile,
    geoReference: mission.geoReference,
    route: summarizeMissionRoute(mission),
    metric: {
      id: metricId,
      summary: summarizeMetricRoute(mission, metricId),
    },
    samples: mission.samples.map((sample, index) => serializeRouteSample(sample, index, metricId)),
  }
}

function serializeRouteSample(sample: AquaSample, index: number, metricId: string) {
  return {
    index,
    timestamp: sample.timestamp,
    latitude: sample.latitude,
    longitude: sample.longitude,
    altitude: sample.altitude,
    localPosition: sample.localPosition,
    headingDeg: sample.headingDeg,
    speedMps: sample.speedMps,
    depthMeters: sample.depthMeters,
    batteryPercent: sample.batteryPercent,
    selectedMetric: metricValue(sample, metricId),
    metrics: sample.metrics,
  }
}
