import { describe, expect, it } from 'vitest'
import { bedDepth, beatAt, missionAt, oxygenColor, PROBE_BOTTOM_DEPTH, ROUTE, sectionOxygen, stationOxygen, WATER_DEPTH } from './missionTimeline'
import { readingAt } from './sampleProfile'

describe('mission timeline', () => {
  it('splits the scroll into four beats', () => {
    expect([0, 0.2, 0.3, 0.55, 0.8, 1].map(beatAt)).toEqual([0, 0, 1, 2, 3, 3])
  })

  it('drives from the start to the sampling point before the probe goes down', () => {
    const start = missionAt(0)
    expect(start.boatX).toBeCloseTo(ROUTE.startX)
    expect(start.depth).toBe(0)

    const arrived = missionAt(0.25)
    expect(arrived.travel).toBe(1)
    expect(arrived.boatX).toBeCloseTo(ROUTE.targetX)
    expect(arrived.depth).toBe(0)
  })

  it('lowers the probe to 1 m, then to the bottom reading, then winds it back in for the map', () => {
    expect(missionAt(0.5).depth).toBeCloseTo(1, 1)
    expect(missionAt(0.75).depth).toBeCloseTo(PROBE_BOTTOM_DEPTH, 2)
    const end = missionAt(1)
    expect(end.depth).toBe(0)
    expect(end.map).toBe(1)
  })

  it('interpolates the sample profile between readings', () => {
    expect(readingAt(2.5).oxygen).toBeCloseTo(0.97)
    expect(readingAt(2.5).temperature).toBeCloseTo(23.2)
    expect(readingAt(1.125).oxygen).toBeCloseTo((3.82 + 3.11) / 2)
  })

  it('builds the oxygen section from the stations\' profiles', () => {
    expect(stationOxygen(2, 2.5)).toBeCloseTo(2)
    expect(stationOxygen(2, 0.1)).toBeCloseTo(5.95)
    expect(sectionOxygen(ROUTE.targetX, 2.5)).toBeCloseTo(0.97, 1)
    expect(bedDepth(ROUTE.targetX)).toBe(WATER_DEPTH)
    expect(bedDepth(6)).toBeLessThan(WATER_DEPTH)
  })

  it('moves the camera from the drive, in to the probe, and back out for the section', () => {
    expect(missionAt(0.1).view).toBe(0)
    expect(missionAt(0.5).view).toBe(1)
    expect(missionAt(1).view).toBe(2)
  })

  it('colours low oxygen warm and high oxygen blue', () => {
    expect(oxygenColor(0.2)).toEqual([0xe2, 0x4d, 0x34])
    expect(oxygenColor(9)).toEqual([0x2f, 0x80, 0xea])
  })
})
