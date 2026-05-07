import Papa from 'papaparse'
import { offsetToLocal } from './geo'
import {
  estimateCableLengthMeters,
  estimateDepthMeters,
  rotationsFromDegrees,
  rotationsFromEncoderTicks,
  type SpoolGeometry,
} from './spool'
import type { AquaMission, AquaSample, GeoReference } from '../types/aqua'

const knownMetricIds = ['temperature', 'ph', 'do', 'salinity', 'tds', 'conductivity', 'turbidity', 'light', 'uv']
const reservedCsvFields = new Set(['timestamp', 'latitude', 'longitude', 'altitude', 'heading', 'speed', 'depth', 'battery'])

type CsvRow = Record<string, string>
type JsonMission = {
  missionName?: string
  samples?: unknown[]
}

export async function loadMissionFromUrl(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load mission: ${response.status} ${response.statusText}`)
  const text = await response.text()
  return parseMission(text, url.split('/').pop() ?? url)
}

export async function loadMissionFromFile(file: File) {
  const text = await file.text()
  return parseMission(text, file.name)
}

export function parseMission(contents: string, sourceFile: string): AquaMission {
  if (sourceFile.toLowerCase().endsWith('.json') || contents.trimStart().startsWith('{')) {
    return finalizeMission(loadFromJson(contents, sourceFile), sourceFile)
  }
  return finalizeMission(loadFromCsv(contents, sourceFile), sourceFile)
}

export function loadFromCsv(contents: string, sourceFile = 'mission.csv'): AquaMission {
  const parsed = Papa.parse<CsvRow>(contents, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? 'Failed to parse CSV')
  }

  const fields = parsed.meta.fields ?? []
  for (const required of ['timestamp', 'latitude', 'longitude']) {
    if (!fields.includes(required)) throw new Error(`CSV missing required header: ${required}`)
  }

  const samples: AquaSample[] = []
  parsed.data.forEach((row, index) => {
    const timestamp = parseTimestamp(row.timestamp)
    const latitude = numberOrUndefined(row.latitude)
    const longitude = numberOrUndefined(row.longitude)
    if (!timestamp || latitude === undefined || longitude === undefined) return
    if (!isValidLatLon(latitude, longitude)) throw new Error(`Latitude or longitude out of range at row ${index + 2}`)

    const sample = createSample(timestamp, latitude, longitude)
    sample.altitude = numberOrUndefined(row.altitude)
    sample.headingDeg = numberOrUndefined(row.heading)
    sample.speedMps = numberOrUndefined(row.speed)
    sample.depthMeters = numberOrUndefined(row.depth)
    sample.batteryPercent = numberOrUndefined(row.battery)

    const spoolDepth = estimateSpoolDepthFromRecord(row)
    if (sample.depthMeters === undefined && spoolDepth !== undefined) sample.depthMeters = spoolDepth
    if (sample.depthMeters !== undefined) sample.metrics.depth = sample.depthMeters
    const spoolLength = estimateSpoolLengthFromRecord(row)
    if (spoolLength !== undefined) sample.metrics.spool_cable_length = spoolLength
    if (sample.speedMps !== undefined) sample.metrics.speed = sample.speedMps
    if (sample.batteryPercent !== undefined) sample.metrics.battery = sample.batteryPercent

    for (const metric of knownMetricIds) setMetricFromValue(sample, metric, row[metric])
    if (sample.metrics.do === undefined) setMetricFromValue(sample, 'do', row.dissolved_oxygen)

    fields.forEach((field) => {
      if (reservedCsvFields.has(field) || sample.metrics[field] !== undefined) return
      setMetricFromValue(sample, field, row[field])
    })

    samples.push(sample)
  })

  return {
    missionName: stripExtension(sourceFile),
    sourceFile,
    geoReference: temporaryGeoReference(),
    samples,
  }
}

export function loadFromJson(contents: string, sourceFile = 'mission.json'): AquaMission {
  const root = JSON.parse(contents) as JsonMission
  if (!Array.isArray(root.samples) || root.samples.length === 0) throw new Error('JSON mission missing samples array')

  const samples: AquaSample[] = []
  root.samples.forEach((item, index) => {
    if (!isObject(item)) return
    const timestamp = typeof item.timestamp === 'string' ? parseTimestamp(item.timestamp) : undefined
    const latitude = numberFromUnknown(item.latitude)
    const longitude = numberFromUnknown(item.longitude)
    if (!timestamp || latitude === undefined || longitude === undefined) return
    if (!isValidLatLon(latitude, longitude)) throw new Error(`Latitude or longitude out of range at sample ${index}`)

    const sample = createSample(timestamp, latitude, longitude)
    sample.altitude = numberFromUnknown(item.altitude)
    sample.headingDeg = numberFromUnknown(item.heading)
    sample.speedMps = numberFromUnknown(item.speed)
    sample.depthMeters = numberFromUnknown(item.depth)
    sample.batteryPercent = numberFromUnknown(item.battery)

    const spoolDepth = estimateSpoolDepthFromRecord(item)
    if (sample.depthMeters === undefined && spoolDepth !== undefined) sample.depthMeters = spoolDepth
    if (sample.depthMeters !== undefined) sample.metrics.depth = sample.depthMeters
    const spoolLength = estimateSpoolLengthFromRecord(item)
    if (spoolLength !== undefined) sample.metrics.spool_cable_length = spoolLength
    if (sample.speedMps !== undefined) sample.metrics.speed = sample.speedMps
    if (sample.batteryPercent !== undefined) sample.metrics.battery = sample.batteryPercent

    if (isObject(item.metrics)) {
      Object.entries(item.metrics).forEach(([key, value]) => {
        const metricId = key.toLowerCase() === 'dissolved_oxygen' ? 'do' : key.toLowerCase()
        const numberValue = numberFromUnknown(value)
        if (numberValue !== undefined) sample.metrics[metricId] = numberValue
      })
    }

    samples.push(sample)
  })

  return {
    missionName: root.missionName ?? stripExtension(sourceFile),
    sourceFile,
    geoReference: temporaryGeoReference(),
    samples,
  }
}

function finalizeMission(mission: AquaMission, sourceFile: string): AquaMission {
  if (mission.samples.length === 0) throw new Error('Mission has no valid samples')
  const first = mission.samples[0]
  const geoReference: GeoReference = {
    originLatitude: first.latitude,
    originLongitude: first.longitude,
    originAltitude: first.altitude,
  }
  return {
    ...mission,
    sourceFile,
    geoReference,
    samples: mission.samples.map((sample) => ({
      ...sample,
      localPosition: offsetToLocal(geoReference, sample.latitude, sample.longitude, sample.altitude),
    })),
  }
}

function createSample(timestamp: string, latitude: number, longitude: number): AquaSample {
  return {
    timestamp,
    latitude,
    longitude,
    metrics: {},
    localPosition: [0, 0, 0],
  }
}

function estimateSpoolDepthFromRecord(record: Record<string, unknown>) {
  const rotations = readSpoolRotations(record)
  return rotations === undefined ? undefined : estimateDepthMeters(rotations, readSpoolGeometry(record))
}

function estimateSpoolLengthFromRecord(record: Record<string, unknown>) {
  const rotations = readSpoolRotations(record)
  return rotations === undefined ? undefined : estimateCableLengthMeters(rotations, readSpoolGeometry(record))
}

function readSpoolRotations(record: Record<string, unknown>) {
  const rotations = firstNumber(record, 'spool_rotations', 'spool_rotation', 'spool_revolutions')
  if (rotations !== undefined) return rotations
  const degrees = firstNumber(record, 'spool_degrees')
  if (degrees !== undefined) return rotationsFromDegrees(degrees)
  const ticks = firstNumber(record, 'spool_encoder_ticks', 'spool_ticks')
  if (ticks === undefined) return undefined
  const ticksPerRevolution = firstNumber(record, 'spool_ticks_per_revolution', 'encoder_ticks_per_revolution') ?? 4096
  return rotationsFromEncoderTicks(ticks, ticksPerRevolution)
}

function readSpoolGeometry(record: Record<string, unknown>): Partial<SpoolGeometry> {
  return {
    coreRadiusMeters: firstNumber(record, 'spool_core_radius_m'),
    cableDiameterMeters: firstNumber(record, 'cable_diameter_m'),
    spoolWidthMeters: firstNumber(record, 'spool_width_m'),
    zeroRotations: firstNumber(record, 'spool_zero_rotations'),
    rotationToSpoolRatio: firstNumber(record, 'spool_rotation_to_spool_ratio'),
    verticalEfficiency: firstNumber(record, 'probe_vertical_efficiency'),
    invertDirection: firstNumber(record, 'spool_direction') !== undefined ? firstNumber(record, 'spool_direction')! < 0 : undefined,
  }
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = numberFromUnknown(record[key])
    if (value !== undefined) return value
  }
  return undefined
}

function setMetricFromValue(sample: AquaSample, metricId: string, value: unknown) {
  const parsed = numberFromUnknown(value)
  if (parsed !== undefined) sample.metrics[metricId.toLowerCase()] = parsed
}

function parseTimestamp(value: string | undefined) {
  if (!value) return undefined
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString()
}

function numberOrUndefined(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') return numberOrUndefined(value)
  return undefined
}

function isValidLatLon(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

function temporaryGeoReference(): GeoReference {
  return { originLatitude: 0, originLongitude: 0 }
}
