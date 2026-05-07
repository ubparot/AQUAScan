import type { AquaMission, AquaSample, MetricDescriptor } from '../types/aqua'

const defaultMetrics: MetricDescriptor[] = [
  descriptor('temperature', 'Temperature', 'deg C', [0, 35], ['#0d59e6', '#00ffff', '#22c55e', '#fde047', '#e6331a']),
  descriptor('ph', 'pH', '', [6, 9], ['#334dcc', '#e6e633']),
  descriptor('do', 'Dissolved Oxygen', 'mg/L', [4, 12], ['#990000', '#ffb833', '#00ccff']),
  descriptor('salinity', 'Salinity', 'psu', [0, 35], ['#0d40a6', '#e6661a']),
  descriptor('tds', 'Total Dissolved Solids', 'ppm', [0, 1000], ['#0d6bb8', '#e6a32e']),
  descriptor('conductivity', 'Conductivity', 'uS/cm', [0, 2000], ['#1a61b8', '#ebb338']),
  descriptor('turbidity', 'Turbidity', 'NTU', [0, 100], ['#0073bf', '#f2e68c', '#8c5926']),
  descriptor('light', 'Light', 'lux', [0, 1200], ['#051424', '#ffdb52']),
  descriptor('uv', 'Ultraviolet', 'index', [0, 11], ['#2e1f73', '#e066ff']),
  descriptor('depth', 'Depth', 'm', [0, 30], ['#a6e6ff', '#002659']),
  descriptor('spool_cable_length', 'Spool Cable', 'm', [0, 30], ['#b3fff2', '#006b80']),
  descriptor('speed', 'Speed', 'm/s', [0, 3], ['#8cccf2', '#e63326']),
  descriptor('battery', 'Battery', '%', [0, 100], ['#d90d0d', '#ffbf1a', '#33cc40']),
]

const registry = new Map(defaultMetrics.map((metric) => [metric.id, metric]))

export function getMetricDescriptor(id: string): MetricDescriptor {
  const normalized = id.toLowerCase()
  return registry.get(normalized) ?? descriptor(normalized, uppercaseFirst(normalized), '', [0, 1], ['#0099e6', '#e63333'])
}

export function listMissionMetrics(mission: AquaMission | undefined): MetricDescriptor[] {
  const ids = new Set<string>()
  defaultMetrics.forEach((metric) => ids.add(metric.id))
  mission?.samples.forEach((sample) => Object.keys(sample.metrics).forEach((metric) => ids.add(metric.toLowerCase())))
  return [...ids].map(getMetricDescriptor).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function metricValue(sample: AquaSample | undefined, metricId: string) {
  return sample?.metrics[metricId.toLowerCase()]
}

export function formatMetricValue(value: number | undefined, descriptor: MetricDescriptor) {
  if (value === undefined) return '--'
  const formatted = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2)
  return descriptor.unit ? `${formatted} ${descriptor.unit}` : formatted
}

export function colorForMetric(value: number | undefined, descriptor: MetricDescriptor) {
  if (value === undefined) return '#64748b'
  const [min, max] = descriptor.expectedRange
  const t = max > min ? clamp01((value - min) / (max - min)) : 0
  return interpolateGradient(descriptor.gradient, t)
}

export function gradientCss(descriptor: MetricDescriptor) {
  return `linear-gradient(90deg, ${descriptor.gradient.join(', ')})`
}

function descriptor(
  id: string,
  displayName: string,
  unit: string,
  expectedRange: [number, number],
  gradient: string[],
): MetricDescriptor {
  return { id, displayName, unit, expectedRange, gradient }
}

function interpolateGradient(colors: string[], t: number) {
  if (colors.length === 1) return colors[0]
  const scaled = clamp01(t) * (colors.length - 1)
  const index = Math.min(colors.length - 2, Math.floor(scaled))
  const localT = scaled - index
  return mixHex(colors[index], colors[index + 1], localT)
}

function mixHex(a: string, b: string, t: number) {
  const ac = parseHex(a)
  const bc = parseHex(b)
  const r = Math.round(ac[0] + (bc[0] - ac[0]) * t)
  const g = Math.round(ac[1] + (bc[1] - ac[1]) * t)
  const blue = Math.round(ac[2] + (bc[2] - ac[2]) * t)
  return `rgb(${r}, ${g}, ${blue})`
}

function parseHex(value: string): [number, number, number] {
  const clean = value.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ]
}

function uppercaseFirst(input: string) {
  return input.length <= 1 ? input.toUpperCase() : input[0].toUpperCase() + input.slice(1)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
