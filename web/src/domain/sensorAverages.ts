import type { DriveStatus } from '../types/aqua'

export const sensorAverageFields = [
  'temperatureC',
  'distanceCm',
  'turbidityVoltage',
  'turbidityRaw',
  'phVoltage',
  'phRaw',
  'dissolvedOxygenVoltage',
  'dissolvedOxygenRaw',
  'tdsVoltage',
  'tdsRaw',
  'uvVoltage',
  'uvRaw',
  'lightVoltage',
  'lightRaw',
] as const

export type SensorAverageField = (typeof sensorAverageFields)[number]

type FieldTotal = {
  sum: number
  count: number
}

export type SensorAverageAccumulator = {
  packetCount: number
  lastSensorSeq?: number
  totals: Record<SensorAverageField, FieldTotal>
}

export type SensorAverages = {
  packetCount: number
  values: Partial<Record<SensorAverageField, number>>
}

export function createSensorAverageAccumulator(lastSensorSeq?: number): SensorAverageAccumulator {
  return {
    packetCount: 0,
    lastSensorSeq,
    totals: Object.fromEntries(sensorAverageFields.map((field) => [field, { sum: 0, count: 0 }])) as Record<SensorAverageField, FieldTotal>,
  }
}

export function addSensorPacket(accumulator: SensorAverageAccumulator, status: Partial<DriveStatus>) {
  const sensorSeq = status.sensorSeq
  if (!isFiniteNumber(sensorSeq) || sensorSeq === accumulator.lastSensorSeq) return accumulator

  const next: SensorAverageAccumulator = {
    packetCount: accumulator.packetCount + 1,
    lastSensorSeq: sensorSeq,
    totals: { ...accumulator.totals },
  }

  for (const field of sensorAverageFields) {
    const value = status[field]
    if (!isFiniteNumber(value)) continue
    const previous = accumulator.totals[field]
    next.totals[field] = {
      sum: previous.sum + value,
      count: previous.count + 1,
    }
  }

  return next
}

export function calculateSensorAverages(accumulator: SensorAverageAccumulator): SensorAverages {
  const values: Partial<Record<SensorAverageField, number>> = {}
  for (const field of sensorAverageFields) {
    const total = accumulator.totals[field]
    if (total.count > 0) values[field] = total.sum / total.count
  }
  return { packetCount: accumulator.packetCount, values }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
