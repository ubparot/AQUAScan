import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMission } from '../domain/missionLoader'
import { analyzeMission, findingsFor, metricInfo, metricStats, readingsCsv, stationValue } from './analysis'

const load = (file: string) => analyzeMission(parseMission(readFileSync(`public/missions/${file}`, 'utf8'), file))

describe('Maris analysis', () => {
  it('groups the pond profiles into the five stations from the station column', () => {
    const analysis = load('do-extrapolated-mission.csv')
    expect(analysis.stations.map((station) => station.label)).toEqual(['Station 1', 'Station 2', 'Station 3', 'Station 4', 'Station 5'])
    expect(analysis.hasProfiles).toBe(true)
    expect(analysis.maxDepth).toBeCloseTo(2.5)
    // Water metrics only: boat and file fields stay out of the picker.
    expect(analysis.metrics[0].id).toBe('do')
    expect(analysis.metrics.map((metric) => metric.id)).not.toContain('battery')
    expect(analysis.metrics.map((metric) => metric.id)).not.toContain('station_index')
  })

  it('reports the oxygen drop with depth and the severely low readings', () => {
    const analysis = load('do-extrapolated-mission.csv')
    const oxygen = metricInfo('do')
    const stats = metricStats(analysis, 'do')!
    expect(stats.min).toBeCloseTo(0.59)

    const station5 = analysis.stations.find((station) => station.label === 'Station 5')!
    expect(stationValue(station5, 'do', 'surface')).toBeGreaterThan(stationValue(station5, 'do', 'bottom')!)

    const titles = findingsFor(analysis, oxygen).map((finding) => finding.title)
    expect(titles[0]).toMatch(/Dissolved oxygen ranged from 0\.59 mg\/L/)
    expect(titles.some((title) => /^Drops .* from surface to bottom at Station \d/.test(title))).toBe(true)
    expect(titles.some((title) => /Severely low oxygen/.test(title))).toBe(true)
  })

  it('treats a transect without a station column as separate points', () => {
    const analysis = load('demo-mission.csv')
    expect(analysis.readings).toHaveLength(20)
    expect(analysis.stations[0].label).toBe('Point 1')
    expect(findingsFor(analysis, metricInfo('do')).some((finding) => finding.tone === 'good')).toBe(true)
  })

  it('exports one CSV row per reading', () => {
    const analysis = load('pool-demo-mission.csv')
    const lines = readingsCsv(analysis).split('\n')
    expect(lines[0]).toMatch(/^timestamp,station,depth_m,x_m,z_m,do,/)
    expect(lines).toHaveLength(analysis.readings.length + 1)
  })
})
