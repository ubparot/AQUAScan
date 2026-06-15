import { describe, expect, it } from 'vitest'
import { addSensorPacket, calculateSensorAverages, createSensorAverageAccumulator } from './sensorAverages'

describe('sensor averages', () => {
  it('averages unique RS-485 sensor sequences', () => {
    let accumulator = createSensorAverageAccumulator()
    accumulator = addSensorPacket(accumulator, { sensorSeq: 1, phVoltage: 2, phRaw: 1000 })
    accumulator = addSensorPacket(accumulator, { sensorSeq: 1, phVoltage: 20, phRaw: 10000 })
    accumulator = addSensorPacket(accumulator, { sensorSeq: 2, phVoltage: 4, phRaw: 1200 })

    expect(calculateSensorAverages(accumulator)).toEqual({
      packetCount: 2,
      values: {
        phVoltage: 3,
        phRaw: 1100,
      },
    })
  })

  it('tracks missing sensor fields independently', () => {
    let accumulator = createSensorAverageAccumulator()
    accumulator = addSensorPacket(accumulator, { sensorSeq: 1, temperatureC: 20 })
    accumulator = addSensorPacket(accumulator, { sensorSeq: 2, temperatureC: 22, distanceCm: 30 })

    expect(calculateSensorAverages(accumulator)).toEqual({
      packetCount: 2,
      values: {
        temperatureC: 21,
        distanceCm: 30,
      },
    })
  })

  it('can reset while ignoring the currently repeated sequence', () => {
    let accumulator = createSensorAverageAccumulator(5)
    accumulator = addSensorPacket(accumulator, { sensorSeq: 5, phVoltage: 2 })
    accumulator = addSensorPacket(accumulator, { sensorSeq: 6, phVoltage: 3 })

    expect(calculateSensorAverages(accumulator)).toEqual({
      packetCount: 1,
      values: { phVoltage: 3 },
    })
  })
})
