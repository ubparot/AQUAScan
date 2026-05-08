import type { AquaMission, AquaSample } from '../types/aqua'
import { metricValue } from './metrics'

export type ResearchPhenomenonId = 'nighttime_oxygen_trap' | 'stormwater_fingerprint_atlas'

export type ResearchSignal = {
  label: string
  value: string
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}

export type ResearchPhenomenonAnalysis = {
  id: ResearchPhenomenonId
  title: string
  hypothesis: string
  currentStatus: string
  readinessPercent: number
  requiredFields: string[]
  missingFields: string[]
  recommendedSurvey: string[]
  aiPlan: string[]
  signals: ResearchSignal[]
}

export function analyzeResearchPhenomena(mission: AquaMission | undefined): ResearchPhenomenonAnalysis[] {
  return [analyzeNighttimeOxygenTrap(mission), analyzeStormwaterFingerprints(mission)]
}

function analyzeNighttimeOxygenTrap(mission: AquaMission | undefined): ResearchPhenomenonAnalysis {
  const samples = mission?.samples ?? []
  const missingFields = missingMetricFields(mission, ['do', 'depth'], ['conductivity', 'tds', 'turbidity', 'light', 'precipitation'])
  const oxygenValues = samples.map((sample) => metricValue(sample, 'do')).filter(isNumber)
  const lowOxygenCount = oxygenValues.filter((value) => value < 5).length
  const nightCount = samples.filter(isNightSample).length
  const depthCount = samples.filter((sample) => (sample.depthMeters ?? metricValue(sample, 'depth') ?? 0) > 0).length
  const conductivityAnomalyCount = anomalyCount(samples, 'conductivity', 1.25) + anomalyCount(samples, 'tds', 1.25)
  const readinessPercent = readiness(mission, ['do', 'depth'], ['conductivity', 'tds', 'turbidity', 'light', 'precipitation'])
  const status =
    readinessPercent < 45
      ? 'Needs oxygen/depth data before trap mapping.'
      : lowOxygenCount > 0
        ? `${lowOxygenCount} low-oxygen sample${lowOxygenCount === 1 ? '' : 's'} flagged for trap review.`
        : 'Ready for event-repeat mapping; no low-oxygen trap is obvious in this mission yet.'

  return {
    id: 'nighttime_oxygen_trap',
    title: 'Nighttime oxygen-trap mapping',
    hypothesis: 'Post-rain organic loading and transient stratification can create bottom dissolved-oxygen minima 10-100 m away from drains or marsh mouths, strongest from sunset to dawn.',
    currentStatus: status,
    readinessPercent,
    requiredFields: ['Dissolved oxygen', 'Depth/profile position', 'Timestamp', 'Repeated transects'],
    missingFields,
    recommendedSurvey: [
      'Repeat identical transects before rain, first flush, 2-4 hours after peak inflow, dusk, midnight, and dawn.',
      'Profile multiple depths at storm drains, marsh mouths, and 10-100 m downstream residence zones.',
      'Track rainfall, conductivity anomaly, turbidity, and light level with every transect.',
    ],
    aiPlan: [
      'Mixed-effects generalized additive model for oxygen-threshold exceedance area.',
      'Lagged cross-correlation against rainfall and conductivity anomaly.',
      'Change-point detection for oxygen-collapse onset and recovery.',
    ],
    signals: [
      signal('Low DO samples', String(lowOxygenCount), lowOxygenCount > 0 ? 'bad' : 'neutral'),
      signal('Night samples', String(nightCount), nightCount > 0 ? 'good' : 'warn'),
      signal('Depth samples', String(depthCount), depthCount > 0 ? 'good' : 'warn'),
      signal('Conductivity anomalies', String(conductivityAnomalyCount), conductivityAnomalyCount > 0 ? 'warn' : 'neutral'),
    ],
  }
}

function analyzeStormwaterFingerprints(mission: AquaMission | undefined): ResearchPhenomenonAnalysis {
  const samples = mission?.samples ?? []
  const missingFields = missingMetricFields(mission, ['conductivity', 'turbidity'], ['uv', 'light', 'temperature', 'do', 'tds', 'salinity'])
  const readinessPercent = readiness(mission, ['conductivity', 'turbidity'], ['uv', 'light', 'temperature', 'do', 'tds', 'salinity'])
  const phenotypes = classifyStormwaterPhenotypes(samples)
  const dominant = phenotypes.sort((a, b) => b.count - a.count)[0]
  const status =
    readinessPercent < 45
      ? 'Needs conductivity and turbidity for a defensible stormwater fingerprint atlas.'
      : dominant && dominant.count > 0
        ? `${dominant.label} is the strongest heuristic signature in this mission.`
        : 'Ready for repeated storm-event surveys; no clear fingerprint dominates this mission yet.'

  return {
    id: 'stormwater_fingerprint_atlas',
    title: 'Stormwater fingerprint atlas',
    hypothesis: 'Repeated paths can reveal stable source phenotypes from conductivity, turbidity, UV absorption, temperature anomaly, and oxygen response.',
    currentStatus: status,
    readinessPercent,
    requiredFields: ['Conductivity or TDS', 'Turbidity', 'Temperature', 'Dissolved oxygen response', 'Timestamped repeat paths'],
    missingFields,
    recommendedSurvey: [
      'Run identical paths through first flush, post-peak inflow, and recovery windows.',
      'Pair selected autonomous runs with grab samples for DOC, nitrate, chloride, or SUVA calibration.',
      'Preserve event metadata: rainfall, tide/stage, drain/source label, and time since storm start.',
    ],
    aiPlan: [
      'Hysteresis-loop metrics for rising/falling event limbs.',
      'PCA or UMAP embedding of multivariate source signatures.',
      'Random forest classification after sparse grab-sample labels are available.',
      'Event lag analysis from source point to downstream oxygen response.',
    ],
    signals: [
      signal('Road-salt rich', String(countPhenotype(phenotypes, 'Road-salt-rich runoff')), phenotypeTone(phenotypes, 'Road-salt-rich runoff')),
      signal('Organic urban', String(countPhenotype(phenotypes, 'Warm organic-rich runoff')), phenotypeTone(phenotypes, 'Warm organic-rich runoff')),
      signal('Groundwater seepage', String(countPhenotype(phenotypes, 'Groundwater-dominated seepage')), phenotypeTone(phenotypes, 'Groundwater-dominated seepage')),
      signal('Sediment first flush', String(countPhenotype(phenotypes, 'Sediment-heavy first flush')), phenotypeTone(phenotypes, 'Sediment-heavy first flush')),
    ],
  }
}

function classifyStormwaterPhenotypes(samples: AquaSample[]) {
  const conductivityValues = samples.map((sample) => readAny(sample, ['conductivity', 'tds', 'salinity'])).filter(isNumber)
  const turbidityValues = samples.map((sample) => metricValue(sample, 'turbidity')).filter(isNumber)
  const tempValues = samples.map((sample) => metricValue(sample, 'temperature')).filter(isNumber)
  const conductivityHigh = percentile(conductivityValues, 0.75)
  const turbidityHigh = percentile(turbidityValues, 0.75)
  const tempHigh = percentile(tempValues, 0.75)
  const tempLow = percentile(tempValues, 0.25)

  const counts = new Map<string, number>([
    ['Road-salt-rich runoff', 0],
    ['Warm organic-rich runoff', 0],
    ['Groundwater-dominated seepage', 0],
    ['Sewage-affected plume candidate', 0],
    ['Sediment-heavy first flush', 0],
  ])

  samples.forEach((sample) => {
    const conductivity = readAny(sample, ['conductivity', 'tds', 'salinity'])
    const turbidity = metricValue(sample, 'turbidity')
    const temp = metricValue(sample, 'temperature')
    const oxygen = metricValue(sample, 'do')
    if (conductivity !== undefined && conductivity >= conductivityHigh) increment(counts, 'Road-salt-rich runoff')
    if (temp !== undefined && temp >= tempHigh && oxygen !== undefined && oxygen < 6) increment(counts, 'Warm organic-rich runoff')
    if (temp !== undefined && temp <= tempLow && conductivity !== undefined && conductivity >= conductivityHigh * 0.65 && turbidity !== undefined && turbidity < turbidityHigh) increment(counts, 'Groundwater-dominated seepage')
    if (oxygen !== undefined && oxygen < 5 && conductivity !== undefined && conductivity >= conductivityHigh * 0.8) increment(counts, 'Sewage-affected plume candidate')
    if (turbidity !== undefined && turbidity >= turbidityHigh) increment(counts, 'Sediment-heavy first flush')
  })

  return [...counts.entries()].map(([label, count]) => ({ label, count }))
}

function missingMetricFields(mission: AquaMission | undefined, requiredAny: string[], useful: string[]) {
  const present = new Set<string>()
  mission?.samples.forEach((sample) => {
    Object.keys(sample.metrics).forEach((metric) => present.add(metric))
    if (sample.depthMeters !== undefined) present.add('depth')
  })
  const missingRequired = requiredAny.filter((field) => !present.has(field))
  const missingUseful = useful.filter((field) => !present.has(field))
  return [...missingRequired, ...missingUseful]
}

function readiness(mission: AquaMission | undefined, required: string[], optional: string[]) {
  if (!mission || mission.samples.length === 0) return 0
  const present = new Set<string>()
  mission.samples.forEach((sample) => {
    Object.keys(sample.metrics).forEach((metric) => present.add(metric))
    if (sample.depthMeters !== undefined) present.add('depth')
  })
  const requiredScore = required.filter((field) => present.has(field)).length / required.length
  const optionalScore = optional.length > 0 ? optional.filter((field) => present.has(field)).length / optional.length : 1
  return Math.round((requiredScore * 0.72 + optionalScore * 0.28) * 100)
}

function isNightSample(sample: AquaSample) {
  const light = readAny(sample, ['light', 'solar_radiation'])
  if (light !== undefined) return light < 25
  const hour = new Date(sample.timestamp).getHours()
  return hour < 6 || hour >= 20
}

function anomalyCount(samples: AquaSample[], metricId: string, ratio: number) {
  const values = samples.map((sample) => metricValue(sample, metricId)).filter(isNumber)
  const med = median(values)
  if (med <= 0) return 0
  return values.filter((value) => value / med >= ratio).length
}

function signal(label: string, value: string, tone: ResearchSignal['tone']): ResearchSignal {
  return { label, value, tone }
}

function countPhenotype(phenotypes: Array<{ label: string; count: number }>, label: string) {
  return phenotypes.find((phenotype) => phenotype.label === label)?.count ?? 0
}

function phenotypeTone(phenotypes: Array<{ label: string; count: number }>, label: string): ResearchSignal['tone'] {
  return countPhenotype(phenotypes, label) > 0 ? 'warn' : 'neutral'
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function readAny(sample: AquaSample, ids: string[]) {
  for (const id of ids) {
    const value = metricValue(sample, id)
    if (value !== undefined) return value
  }
  return undefined
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))]
}

function median(values: number[]) {
  return percentile(values, 0.5)
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
