import { colorForMetric, getMetricDescriptor, metricValue } from './metrics'
import type { AquaMission, Vec3 } from '../types/aqua'

export type ScenePoint = {
  key: string
  position: Vec3
  color: string
  value?: number
}

export type HeatCell = {
  key: string
  position: Vec3
  color: string
  intensity: number
}

export function buildScenePoints(mission: AquaMission | undefined, metricId: string): ScenePoint[] {
  if (!mission) return []
  const descriptor = getMetricDescriptor(metricId)
  return mission.samples.map((sample, index) => {
    const value = metricValue(sample, metricId)
    return {
      key: `${sample.timestamp}-${index}`,
      position: [sample.localPosition[0], 0.18, sample.localPosition[2]],
      color: colorForMetric(value, descriptor),
      value,
    }
  })
}

export function buildHeatCells(mission: AquaMission | undefined, metricId: string): HeatCell[] {
  if (!mission) return []
  const descriptor = getMetricDescriptor(metricId)
  return mission.samples
    .map((sample, index) => {
      const value = metricValue(sample, metricId)
      const [min, max] = descriptor.expectedRange
      const intensity = value === undefined || max <= min ? 0.25 : Math.min(1, Math.max(0.12, (value - min) / (max - min)))
      return {
        key: `heat-${sample.timestamp}-${index}`,
        position: [sample.localPosition[0], 0.045, sample.localPosition[2]] as Vec3,
        color: colorForMetric(value, descriptor),
        intensity,
      }
    })
    .filter((cell) => cell.intensity > 0)
}

export function missionBounds(mission: AquaMission | undefined) {
  if (!mission || mission.samples.length === 0) return { center: [0, 0, 0] as Vec3, radius: 20 }
  const xs = mission.samples.map((sample) => sample.localPosition[0])
  const zs = mission.samples.map((sample) => sample.localPosition[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const center: Vec3 = [(minX + maxX) / 2, 0, (minZ + maxZ) / 2]
  const radius = Math.max(20, Math.hypot(maxX - minX, maxZ - minZ) * 0.55)
  return { center, radius }
}
