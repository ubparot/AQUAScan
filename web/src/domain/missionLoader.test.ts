import { describe, expect, it } from 'vitest'
import { applyRadialDeadzone, buildDriveCommand, mixArcade, neutralMicros, toMicros } from './drive'
import { geoToLocal } from './geo'
import { getMetricDescriptor } from './metrics'
import { loadFromCsv, loadFromJson, parseMission } from './missionLoader'
import { getPlaybackSegment } from './playback'
import { predictWaterQuality } from './ai'

const csv = `timestamp,latitude,longitude,temperature,ph,do,depth,heading,speed,battery
2025-01-01T12:00:00Z,37.425100,-122.084100,16.8,7.4,8.9,2.2,45,1.4,96
2025-01-01T12:00:10Z,37.425140,-122.084000,17.1,7.3,8.7,2.7,50,1.4,95`

const json = `{
  "missionName": "Demo JSON Mission",
  "samples": [
    { "timestamp": "2025-01-01T12:00:00Z", "latitude": 37.425100, "longitude": -122.084100, "depth": 2.2, "battery": 96, "metrics": { "temperature": 16.8, "ph": 7.4, "do": 8.9 } },
    { "timestamp": "2025-01-01T12:00:10Z", "latitude": 37.425140, "longitude": -122.084000, "depth": 2.7, "battery": 95, "metrics": { "temperature": 17.1, "ph": 7.3, "do": 8.7 } }
  ]
}`

describe('mission loading', () => {
  it('parses CSV missions and projects local coordinates', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    expect(mission.samples).toHaveLength(2)
    expect(mission.samples[0].metrics.temperature).toBeCloseTo(16.8)
    expect(mission.samples[1].metrics.depth).toBeCloseTo(2.7)
    expect(mission.samples[1].localPosition[0]).toBeGreaterThan(8)
    expect(mission.samples[1].localPosition[2]).toBeGreaterThan(4)
  })

  it('parses JSON missions', () => {
    const mission = loadFromJson(json)
    expect(mission.missionName).toBe('Demo JSON Mission')
    expect(mission.samples[1].batteryPercent).toBe(95)
    expect(mission.samples[0].metrics.do).toBeCloseTo(8.9)
  })

  it('rejects CSV without required headers', () => {
    expect(() => loadFromCsv('timestamp,latitude\n2025-01-01,1')).toThrow(/longitude/)
  })
})

describe('ported math', () => {
  it('matches Unity GPS projection direction', () => {
    const local = geoToLocal(37.4251, -122.0841, 37.42514, -122.084)
    expect(local[0]).toBeGreaterThan(8)
    expect(local[2]).toBeGreaterThan(4)
  })

  it('matches drive mixer and ESC mapping behavior', () => {
    expect(applyRadialDeadzone([0.02, 0.02], 0.08)).toEqual([0, 0])
    expect(mixArcade([1, 1])).toEqual([1, 0])
    expect(toMicros(0, 1)).toBe(neutralMicros)
    expect(toMicros(1, 1)).toBe(2000)
    expect(toMicros(-1, 1)).toBe(1000)
    const command = buildDriveCommand(7, [0, 1], { deadzone: 0.08, maxOutput: 1 }, true, false)
    expect(command.leftMicros).toBe(2000)
    expect(command.rightMicros).toBe(2000)
  })

  it('builds metric descriptors and playback predictions', () => {
    const mission = loadFromCsv(csv, 'demo-mission.csv')
    const segment = getPlaybackSegment(mission, 0.5)
    expect(getMetricDescriptor('do').displayName).toBe('Dissolved Oxygen')
    expect(segment?.lerp).toBeCloseTo(0.5)
    const prediction = predictWaterQuality(mission, segment?.sample)
    expect(prediction.oxygenNow).toBeGreaterThan(8)
    expect(prediction.bloomRisk).toBeGreaterThanOrEqual(0)
  })
})
