import { getMetricDescriptor } from '../domain/metrics'
import type { AquaMission, AquaSample, MetricDescriptor } from '../types/aqua'

/** Columns that describe the boat or the file rather than the water. */
const NON_WATER_FIELDS = new Set([
  'depth', 'battery', 'speed', 'heading', 'spool_cable_length', 'station_index', 'cast_index', 'oxygen_status_code',
])

/** Preferred order for the metric picker; anything else in the file follows alphabetically. */
const METRIC_ORDER = ['do', 'temperature', 'ph', 'turbidity', 'tds', 'conductivity', 'salinity', 'light', 'uv', 'do_percent_saturation', 'secchi_depth_m']

const FRIENDLY_NAMES: Record<string, { name: string; unit: string }> = {
  do: { name: 'Dissolved oxygen', unit: 'mg/L' },
  temperature: { name: 'Temperature', unit: '°C' },
  ph: { name: 'pH', unit: '' },
  turbidity: { name: 'Turbidity', unit: 'NTU' },
  tds: { name: 'Dissolved solids', unit: 'ppm' },
  conductivity: { name: 'Conductivity', unit: 'µS/cm' },
  salinity: { name: 'Salinity', unit: 'psu' },
  light: { name: 'Light', unit: 'lux' },
  uv: { name: 'UV index', unit: '' },
  do_percent_saturation: { name: 'Oxygen saturation', unit: '%' },
  secchi_depth_m: { name: 'Water clarity', unit: 'm' },
}

export type Metric = { id: string; name: string; unit: string; descriptor: MetricDescriptor }

export type Reading = {
  index: number
  station: string
  timeSeconds: number
  timestamp: string
  depth: number
  x: number
  z: number
  values: Record<string, number>
}

export type Station = {
  id: string
  label: string
  x: number
  z: number
  readings: Reading[]
  minDepth: number
  maxDepth: number
}

export type Layer = 'surface' | 'average' | 'bottom'

export type Finding = { tone: 'neutral' | 'good' | 'warn' | 'bad'; title: string; detail: string }

export type Analysis = {
  name: string
  readings: Reading[]
  stations: Station[]
  metrics: Metric[]
  durationSeconds: number
  maxDepth: number
  extentMeters: number
  /** True when the probe visited several depths at the same place, so profiles are meaningful. */
  hasProfiles: boolean
}

export function metricInfo(id: string): Metric {
  const descriptor = getMetricDescriptor(id)
  const friendly = FRIENDLY_NAMES[id]
  return { id, name: friendly?.name ?? descriptor.displayName, unit: friendly?.unit ?? descriptor.unit, descriptor }
}

export function formatValue(value: number | undefined, metric: Metric, withUnit = true) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const text = abs >= 100 ? value.toFixed(0) : abs >= 10 ? value.toFixed(1) : value.toFixed(2)
  return withUnit && metric.unit ? `${text} ${metric.unit}` : text
}

export function formatDepth(depth: number) {
  return `${depth.toFixed(depth < 1 ? 2 : 1)} m`
}

export function analyzeMission(mission: AquaMission): Analysis {
  const start = Date.parse(mission.samples[0]?.timestamp ?? '') || 0
  const readings: Reading[] = mission.samples.map((sample, index) => toReading(sample, index, start))

  // Group into stations: an explicit station column wins; otherwise readings within ~1.5 m are one place.
  const hasStationColumn = mission.samples.some((sample) => sample.metrics.station_index !== undefined)
  const groups = new Map<string, Reading[]>()
  readings.forEach((reading, index) => {
    const stationIndex = mission.samples[index].metrics.station_index
    const key = hasStationColumn && stationIndex !== undefined
      ? `s${stationIndex}`
      : `p${Math.round(reading.x / 1.5)}:${Math.round(reading.z / 1.5)}`
    reading.station = key
    groups.set(key, [...(groups.get(key) ?? []), reading])
  })

  const stationLabel = hasStationColumn ? 'Station' : 'Point'
  const stations: Station[] = [...groups.entries()].map(([id, group], order) => {
    const depths = group.map((reading) => reading.depth)
    const surface = group.reduce((best, reading) => (reading.depth < best.depth ? reading : best), group[0])
    return {
      id,
      label: `${stationLabel} ${hasStationColumn ? id.slice(1) : order + 1}`,
      x: surface.x,
      z: surface.z,
      readings: [...group].sort((a, b) => a.depth - b.depth || a.timeSeconds - b.timeSeconds),
      minDepth: Math.min(...depths),
      maxDepth: Math.max(...depths),
    }
  })

  const metricIds = new Set<string>()
  readings.forEach((reading) => Object.keys(reading.values).forEach((id) => metricIds.add(id)))
  const metrics = [...metricIds]
    .filter((id) => !NON_WATER_FIELDS.has(id))
    .filter((id) => readings.some((reading) => Number.isFinite(reading.values[id])))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(metricInfo)

  const xs = stations.map((station) => station.x)
  const zs = stations.map((station) => station.z)
  const extentMeters = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))

  return {
    name: mission.missionName,
    readings,
    stations,
    metrics,
    durationSeconds: readings.at(-1)?.timeSeconds ?? 0,
    maxDepth: Math.max(0, ...readings.map((reading) => reading.depth)),
    extentMeters,
    hasProfiles: stations.some((station) => station.maxDepth - station.minDepth >= 0.4),
  }
}

/** One value per station for the map: the shallowest reading, the deepest, or the mean. */
export function stationValue(station: Station, metricId: string, layer: Layer) {
  const values = station.readings.filter((reading) => Number.isFinite(reading.values[metricId]))
  if (values.length === 0) return undefined
  if (layer === 'surface') return values[0].values[metricId]
  if (layer === 'bottom') return values[values.length - 1].values[metricId]
  return values.reduce((sum, reading) => sum + reading.values[metricId], 0) / values.length
}

export type MetricStats = { min: number; max: number; mean: number; minAt: Reading; maxAt: Reading; count: number }

export function metricStats(analysis: Analysis, metricId: string): MetricStats | undefined {
  const withValue = analysis.readings.filter((reading) => Number.isFinite(reading.values[metricId]))
  if (withValue.length === 0) return undefined
  let minAt = withValue[0]
  let maxAt = withValue[0]
  let sum = 0
  for (const reading of withValue) {
    const value = reading.values[metricId]
    if (value < minAt.values[metricId]) minAt = reading
    if (value > maxAt.values[metricId]) maxAt = reading
    sum += value
  }
  return { min: minAt.values[metricId], max: maxAt.values[metricId], mean: sum / withValue.length, minAt, maxAt, count: withValue.length }
}

export function stationName(analysis: Analysis, id: string) {
  return analysis.stations.find((station) => station.id === id)?.label ?? id
}

/** Plain-language observations for the selected metric. Every number comes straight from the data. */
export function findingsFor(analysis: Analysis, metric: Metric): Finding[] {
  const stats = metricStats(analysis, metric.id)
  if (!stats) return [{ tone: 'neutral', title: `No ${metric.name.toLowerCase()} readings`, detail: 'This dataset does not include that measurement.' }]

  const findings: Finding[] = []
  const where = (reading: Reading) => `${stationName(analysis, reading.station)}, ${formatDepth(reading.depth)}`

  findings.push({
    tone: 'neutral',
    title: `${metric.name} ranged from ${formatValue(stats.min, metric)} to ${formatValue(stats.max, metric)}.`,
    detail: `Lowest at ${where(stats.minAt)}. Highest at ${where(stats.maxAt)}. Average ${formatValue(stats.mean, metric)} across ${stats.count} readings.`,
  })

  // Biggest change from surface to bottom at any one station.
  let steepest: { station: Station; change: number } | undefined
  for (const station of analysis.stations) {
    if (station.maxDepth - station.minDepth < 0.4) continue
    const top = stationValue(station, metric.id, 'surface')
    const bottom = stationValue(station, metric.id, 'bottom')
    if (top === undefined || bottom === undefined) continue
    const change = bottom - top
    if (!steepest || Math.abs(change) > Math.abs(steepest.change)) steepest = { station, change }
  }
  if (steepest && Math.abs(steepest.change) > 0) {
    const relative = Math.abs(steepest.change) / Math.max(1e-6, stats.max - stats.min)
    findings.push({
      tone: relative > 0.5 ? 'warn' : 'neutral',
      title: `${steepest.change < 0 ? 'Drops' : 'Rises'} ${formatValue(Math.abs(steepest.change), metric)} from surface to bottom at ${steepest.station.label}.`,
      detail: `Measured between ${formatDepth(steepest.station.minDepth)} and ${formatDepth(steepest.station.maxDepth)}. A surface reading alone would miss this.`,
    })
  }

  findings.push(...thresholdFindings(analysis, metric))

  // Which place stands out.
  if (analysis.stations.length > 2) {
    const averages = analysis.stations
      .map((station) => ({ station, value: stationValue(station, metric.id, 'average') }))
      .filter((entry): entry is { station: Station; value: number } => entry.value !== undefined)
      .sort((a, b) => a.value - b.value)
    if (averages.length > 2) {
      const low = averages[0]
      const high = averages[averages.length - 1]
      findings.push({
        tone: 'neutral',
        title: `${high.station.label} averaged highest, ${low.station.label} lowest.`,
        detail: `${formatValue(high.value, metric)} versus ${formatValue(low.value, metric)} on average.`,
      })
    }
  }

  return findings
}

function thresholdFindings(analysis: Analysis, metric: Metric): Finding[] {
  const values = analysis.readings.filter((reading) => Number.isFinite(reading.values[metric.id]))
  const stationsWhere = (test: (value: number) => boolean) => {
    const hits = values.filter((reading) => test(reading.values[metric.id]))
    return { hits, stations: new Set(hits.map((reading) => reading.station)) }
  }
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  if (metric.id === 'do') {
    const low = stationsWhere((value) => value < 5)
    const severe = stationsWhere((value) => value < 2)
    if (severe.hits.length) {
      const shallowest = Math.min(...severe.hits.map((reading) => reading.depth))
      return [{
        tone: 'bad',
        title: `Severely low oxygen (under 2 mg/L) in ${count(severe.hits.length, 'reading')}.`,
        detail: `Found at ${count(severe.stations.size, 'location')}, starting around ${formatDepth(shallowest)}. Most fish cannot stay in water this low in oxygen.`,
      }]
    }
    if (low.hits.length) {
      return [{
        tone: 'warn',
        title: `Below 5 mg/L in ${count(low.hits.length, 'reading')}.`,
        detail: `At ${count(low.stations.size, 'location')}. Many fish start to struggle below about 5 mg/L.`,
      }]
    }
    return [{ tone: 'good', title: 'Oxygen stayed above 5 mg/L everywhere.', detail: 'No readings fell into the range where fish typically become stressed.' }]
  }
  if (metric.id === 'ph') {
    const out = stationsWhere((value) => value < 6.5 || value > 9)
    return out.hits.length
      ? [{ tone: 'warn', title: `pH outside 6.5–9 in ${count(out.hits.length, 'reading')}.`, detail: 'That range is the usual target for healthy freshwater.' }]
      : [{ tone: 'good', title: 'pH stayed within 6.5–9.', detail: 'Within the usual range for healthy freshwater.' }]
  }
  if (metric.id === 'turbidity') {
    const cloudy = stationsWhere((value) => value > 25)
    return cloudy.hits.length
      ? [{ tone: 'warn', title: `Cloudy water (over 25 NTU) in ${count(cloudy.hits.length, 'reading')}.`, detail: 'Cloudy water blocks light that plants and algae need, and can point to runoff or stirred-up sediment.' }]
      : []
  }
  if (metric.id === 'temperature' && analysis.hasProfiles) {
    const layered = analysis.stations.filter((station) => {
      const top = stationValue(station, 'temperature', 'surface')
      const bottom = stationValue(station, 'temperature', 'bottom')
      const span = station.maxDepth - station.minDepth
      return top !== undefined && bottom !== undefined && span >= 0.4 && (top - bottom) / span >= 1
    })
    return layered.length
      ? [{ tone: 'warn', title: `Layered water at ${count(layered.length, 'location')}.`, detail: 'Temperature falls by at least 1 °C per metre of depth. Layers like this keep oxygen from mixing down to the bottom.' }]
      : []
  }
  return []
}

export function summaryJson(analysis: Analysis, metric: Metric, layer: Layer) {
  const stats = metricStats(analysis, metric.id)
  return {
    dataset: analysis.name,
    generatedAt: new Date().toISOString(),
    metric: { id: metric.id, name: metric.name, unit: metric.unit },
    layer,
    readings: analysis.readings.length,
    maxDepthMeters: analysis.maxDepth,
    stats: stats && { min: stats.min, max: stats.max, mean: stats.mean, count: stats.count },
    stations: analysis.stations.map((station) => ({
      label: station.label,
      readings: station.readings.length,
      depthRangeMeters: [station.minDepth, station.maxDepth],
      surface: stationValue(station, metric.id, 'surface'),
      average: stationValue(station, metric.id, 'average'),
      bottom: stationValue(station, metric.id, 'bottom'),
    })),
    findings: findingsFor(analysis, metric).map(({ title, detail }) => ({ title, detail })),
  }
}

export function readingsCsv(analysis: Analysis) {
  const metricIds = analysis.metrics.map((metric) => metric.id)
  const header = ['timestamp', 'station', 'depth_m', 'x_m', 'z_m', ...metricIds]
  const rows = analysis.readings.map((reading) => [
    reading.timestamp,
    stationName(analysis, reading.station),
    reading.depth,
    reading.x.toFixed(2),
    reading.z.toFixed(2),
    ...metricIds.map((id) => reading.values[id] ?? ''),
  ].join(','))
  return [header.join(','), ...rows].join('\n')
}

function toReading(sample: AquaSample, index: number, start: number): Reading {
  const values: Record<string, number> = {}
  Object.entries(sample.metrics).forEach(([key, value]) => {
    if (Number.isFinite(value)) values[key] = value
  })
  return {
    index,
    station: '',
    timeSeconds: Math.max(0, ((Date.parse(sample.timestamp) || start) - start) / 1000),
    timestamp: sample.timestamp,
    depth: sample.depthMeters ?? sample.metrics.depth ?? 0,
    x: sample.localPosition[0],
    z: sample.localPosition[2],
    values,
  }
}

function rank(id: string) {
  const index = METRIC_ORDER.indexOf(id)
  return index === -1 ? METRIC_ORDER.length : index
}
