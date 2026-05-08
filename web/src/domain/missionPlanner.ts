import { offsetToLocal } from './geo'
import type { AquaMission, AquaSample } from '../types/aqua'

export type MissionPlanWarning = {
  severity: 'warn' | 'error'
  message: string
}

export function cloneMissionForPlanning(mission: AquaMission): AquaMission {
  return {
    ...mission,
    samples: mission.samples.map((sample) => ({
      ...sample,
      metrics: { ...sample.metrics },
      localPosition: [...sample.localPosition],
    })),
  }
}

export function updateWaypoint(mission: AquaMission, index: number, patch: Partial<Pick<AquaSample, 'timestamp' | 'latitude' | 'longitude' | 'altitude' | 'headingDeg' | 'speedMps' | 'depthMeters'>>) {
  return withSamples(mission, (samples) => {
    const sample = samples[index]
    if (!sample) return samples
    const nextSample = { ...sample, ...patch, metrics: { ...sample.metrics } }
    if (patch.depthMeters !== undefined) nextSample.metrics.depth = patch.depthMeters
    if (patch.speedMps !== undefined) nextSample.metrics.speed = patch.speedMps
    nextSample.localPosition = offsetToLocal(mission.geoReference, nextSample.latitude, nextSample.longitude, nextSample.altitude)
    samples[index] = nextSample
    return samples
  })
}

export function insertWaypointAfter(mission: AquaMission, index: number) {
  return withSamples(mission, (samples) => {
    const safeIndex = Math.max(0, Math.min(index, samples.length - 1))
    const base = samples[safeIndex]
    const next = samples[safeIndex + 1]
    if (!base) return samples
    const inserted: AquaSample = next ? midpointSample(base, next) : offsetSample(base)
    samples.splice(safeIndex + 1, 0, inserted)
    return samples
  })
}

export function deleteWaypoint(mission: AquaMission, index: number) {
  if (mission.samples.length <= 2) return mission
  return withSamples(mission, (samples) => {
    samples.splice(index, 1)
    return samples
  })
}

export function moveWaypoint(mission: AquaMission, index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= mission.samples.length) return mission
  return withSamples(mission, (samples) => {
    const [sample] = samples.splice(index, 1)
    samples.splice(target, 0, sample)
    return samples
  })
}

export function validateMissionPlan(mission: AquaMission | undefined): MissionPlanWarning[] {
  if (!mission) return [{ severity: 'error', message: 'Load a mission before editing waypoints.' }]
  const warnings: MissionPlanWarning[] = []
  if (mission.samples.length < 2) warnings.push({ severity: 'error', message: 'Mission needs at least two waypoints.' })
  const seenTimestamps = new Set<string>()
  mission.samples.forEach((sample, index) => {
    if (!Number.isFinite(sample.latitude) || sample.latitude < -90 || sample.latitude > 90) warnings.push({ severity: 'error', message: `Waypoint ${index + 1} has invalid latitude.` })
    if (!Number.isFinite(sample.longitude) || sample.longitude < -180 || sample.longitude > 180) warnings.push({ severity: 'error', message: `Waypoint ${index + 1} has invalid longitude.` })
    if (Number.isNaN(Date.parse(sample.timestamp))) warnings.push({ severity: 'error', message: `Waypoint ${index + 1} has invalid timestamp.` })
    if (seenTimestamps.has(sample.timestamp)) warnings.push({ severity: 'warn', message: `Waypoint ${index + 1} duplicates another timestamp.` })
    seenTimestamps.add(sample.timestamp)
  })
  mission.samples.slice(1).forEach((sample, offsetIndex) => {
    const previous = mission.samples[offsetIndex]
    const elapsedSeconds = (Date.parse(sample.timestamp) - Date.parse(previous.timestamp)) / 1000
    const distanceMeters = legDistanceMeters(previous, sample)
    if (elapsedSeconds <= 0) warnings.push({ severity: 'warn', message: `Waypoint ${offsetIndex + 2} is not later than the previous waypoint.` })
    if (elapsedSeconds > 0 && distanceMeters / elapsedSeconds > 8) warnings.push({ severity: 'warn', message: `Leg ${offsetIndex + 1} exceeds 8 m/s planned speed.` })
  })
  return warnings
}

export function legDistanceMeters(a: AquaSample, b: AquaSample) {
  return Math.hypot(b.localPosition[0] - a.localPosition[0], b.localPosition[2] - a.localPosition[2])
}

export function legHeadingDeg(a: AquaSample, b: AquaSample) {
  const dx = b.localPosition[0] - a.localPosition[0]
  const dz = b.localPosition[2] - a.localPosition[2]
  const heading = (Math.atan2(dx, dz) * 180) / Math.PI
  return heading < 0 ? heading + 360 : heading
}

export function exportMissionPlanJson(mission: AquaMission) {
  return JSON.stringify(
    {
      missionName: mission.missionName,
      sourceFile: mission.sourceFile,
      geoReference: mission.geoReference,
      samples: mission.samples.map(serializedPlanSample),
    },
    null,
    2,
  )
}

export function exportMissionPlanCsv(mission: AquaMission) {
  const headers = ['timestamp', 'latitude', 'longitude', 'altitude', 'heading', 'speed', 'depth', 'battery']
  const rows = mission.samples.map((sample) =>
    [
      sample.timestamp,
      sample.latitude,
      sample.longitude,
      sample.altitude ?? '',
      sample.headingDeg ?? '',
      sample.speedMps ?? '',
      sample.depthMeters ?? '',
      sample.batteryPercent ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

function withSamples(mission: AquaMission, change: (samples: AquaSample[]) => AquaSample[]) {
  return {
    ...mission,
    samples: change(mission.samples.map((sample) => ({ ...sample, metrics: { ...sample.metrics }, localPosition: [...sample.localPosition] }))).map((sample) => ({
      ...sample,
      localPosition: offsetToLocal(mission.geoReference, sample.latitude, sample.longitude, sample.altitude),
    })),
  }
}

function midpointSample(a: AquaSample, b: AquaSample): AquaSample {
  const timestamp = new Date((Date.parse(a.timestamp) + Date.parse(b.timestamp)) / 2).toISOString()
  return {
    ...a,
    timestamp,
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    altitude: averageOptional(a.altitude, b.altitude),
    headingDeg: averageOptional(a.headingDeg, b.headingDeg),
    speedMps: averageOptional(a.speedMps, b.speedMps),
    depthMeters: averageOptional(a.depthMeters, b.depthMeters),
    batteryPercent: averageOptional(a.batteryPercent, b.batteryPercent),
    metrics: { ...a.metrics },
    localPosition: [0, 0, 0],
  }
}

function offsetSample(sample: AquaSample): AquaSample {
  return {
    ...sample,
    timestamp: new Date(Date.parse(sample.timestamp) + 5000).toISOString(),
    latitude: sample.latitude + 0.00003,
    longitude: sample.longitude + 0.00003,
    metrics: { ...sample.metrics },
    localPosition: [0, 0, 0],
  }
}

function averageOptional(a: number | undefined, b: number | undefined) {
  if (a === undefined) return b
  if (b === undefined) return a
  return (a + b) / 2
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function serializedPlanSample(sample: AquaSample) {
  return {
    timestamp: sample.timestamp,
    latitude: sample.latitude,
    longitude: sample.longitude,
    altitude: sample.altitude,
    headingDeg: sample.headingDeg,
    speedMps: sample.speedMps,
    depthMeters: sample.depthMeters,
    batteryPercent: sample.batteryPercent,
    metrics: sample.metrics,
  }
}
