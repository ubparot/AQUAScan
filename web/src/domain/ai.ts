import { sampleSeconds } from './playback'
import type { AquaMission, AquaSample, PredictionResult } from '../types/aqua'

const fallbackBackend = 'Heuristic fallback'

export function predictWaterQuality(mission: AquaMission | undefined, current: AquaSample | undefined): PredictionResult {
  if (!mission || !current) return unavailable('No mission loaded')

  const temperature = readMetric(current, 'temperature', 18)
  const oxygen = readMetric(current, 'do', 8)
  const ph = readMetric(current, 'ph', 7.4)
  const tds = readMetric(current, 'tds', 320)
  const turbidity = readMetric(current, 'turbidity', 3)
  const light = readMetric(current, 'light', 0)
  const depth = current.depthMeters ?? readMetric(current, 'depth', 1)
  const wind = readMetric(current, 'wind_speed', 2)
  const precipitation = readMetric(current, 'precipitation', 0)
  const solar = readMetric(current, 'solar_radiation', light)
  const doDelta = estimateDelta(mission.samples, current, 'do')
  const tempDelta = estimateDelta(mission.samples, current, 'temperature')
  const stratification = Math.max(0, temperature - (temperature - 0.22 * Math.max(0, depth - 0.5)))

  const thermalPressure = Math.max(0, temperature - 20) * 0.045
  const depthPressure = Math.max(0, depth - 2.5) * 0.05
  const stormPressure = Math.max(0, precipitation - 0.25) * 0.04
  const trendPressure = Math.max(0, -doDelta) * 0.35
  const mixingRelief = clamp01(wind / 8) * 0.12

  const oxygen30 = oxygen - thermalPressure - depthPressure - stormPressure - trendPressure + mixingRelief
  const oxygen60 = oxygen30 - thermalPressure * 0.8 - depthPressure * 0.6 - stormPressure * 0.8
  const oxygen120 = oxygen60 - thermalPressure * 0.7 - depthPressure * 0.7 - Math.max(0, stratification) * 0.05

  let bloomScore = 0
  bloomScore += inverseLerp(19, 27, temperature) * 0.28
  bloomScore += inverseLerp(250, 900, solar) * 0.22
  bloomScore += inverseLerp(3, 18, turbidity) * 0.18
  bloomScore += inverseLerp(320, 620, tds) * 0.18
  bloomScore += inverseLerp(7.3, 8.4, ph) * 0.14

  let anomalyScore = 0
  anomalyScore = Math.max(anomalyScore, inverseLerp(5.2, 2.8, oxygen))
  anomalyScore = Math.max(anomalyScore, inverseLerp(-0.25, -1.5, doDelta))
  anomalyScore = Math.max(anomalyScore, inverseLerp(12, 35, turbidity))
  anomalyScore = Math.max(anomalyScore, inverseLerp(0.8, 2.4, Math.abs(tempDelta)))
  if (ph < 6.5 || ph > 9) anomalyScore = Math.max(anomalyScore, 0.9)

  return {
    oxygenNow: oxygen,
    oxygen30Minutes: Math.max(0, oxygen30),
    oxygen60Minutes: Math.max(0, oxygen60),
    oxygen120Minutes: Math.max(0, oxygen120),
    bloomRisk: clamp01(bloomScore),
    anomalyRisk: clamp01(anomalyScore),
    backendName: fallbackBackend,
    status: 'Fallback predictor active',
  }
}

function unavailable(reason: string): PredictionResult {
  return {
    oxygenNow: 0,
    oxygen30Minutes: 0,
    oxygen60Minutes: 0,
    oxygen120Minutes: 0,
    bloomRisk: 0,
    anomalyRisk: 0,
    backendName: fallbackBackend,
    status: reason,
  }
}

function estimateDelta(samples: AquaSample[], current: AquaSample, metricId: string) {
  const currentValue = current.metrics[metricId]
  if (currentValue === undefined) return 0
  const currentSeconds = sampleSeconds(current)
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const sample = samples[i]
    if (sampleSeconds(sample) >= currentSeconds) continue
    const previousValue = sample.metrics[metricId]
    if (previousValue !== undefined) return currentValue - previousValue
  }
  return 0
}

function readMetric(sample: AquaSample, metricId: string, fallback: number) {
  return sample.metrics[metricId] ?? fallback
}

function inverseLerp(a: number, b: number, value: number) {
  if (Math.abs(b - a) < 0.000001) return 0
  return clamp01((value - a) / (b - a))
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
