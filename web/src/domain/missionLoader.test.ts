import { describe, expect, it } from 'vitest'
import { applyRadialDeadzone, buildDriveCommand, mixArcade, neutralMicros, toMicros } from './drive'
import { geoToLocal, localToGeo } from './geo'
import { getMetricDescriptor } from './metrics'
import { defaultLiveSettings, espAccessPointHost, espWebSocketPort } from './liveSettings'
import { loadFromCsv, loadFromJson, parseMission } from './missionLoader'
import { deleteWaypoint, exportMissionPlanCsv, insertWaypointAfter, moveWaypoint, updateWaypoint, validateMissionPlan } from './missionPlanner'
import { exportMissionRoutePayload, nearestSampleIndex, normalizedTimeForSample, summarizeMetricRoute, summarizeMissionRoute } from './missionTools'
import { abortUploadMessage, buildMissionUploadPlan } from './missionUploadProtocol'
import { getPlaybackSegment } from './playback'
import { buildPreflightChecks, preflightReady } from './preflight'
import { createProjectFile, parseProjectFile, serializeProjectFile } from './projectFiles'
import { analyzeResearchPhenomena } from './researchPhenomena'
import { buildResearchFeatureVector, parseResearchModelMetadata } from './researchModel'
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
    const roundTrip = localToGeo({ originLatitude: 37.4251, originLongitude: -122.0841 }, local[0], local[2])
    expect(roundTrip.latitude).toBeCloseTo(37.42514)
    expect(roundTrip.longitude).toBeCloseTo(-122.084)
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

  it('summarizes mission routes and maps samples to playback time', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const route = summarizeMissionRoute(mission)
    const metric = summarizeMetricRoute(mission, 'temperature')
    expect(route?.sampleCount).toBe(2)
    expect(route?.routeDistanceMeters).toBeGreaterThan(9)
    expect(route?.averageSpeedMps).toBeGreaterThan(0.9)
    expect(metric.min).toBeCloseTo(16.8)
    expect(metric.max).toBeCloseTo(17.1)
    expect(normalizedTimeForSample(mission, 1)).toBe(1)
    expect(nearestSampleIndex(mission, 0.98)).toBe(1)
  })

  it('exports route payloads with selected metric values', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const payload = exportMissionRoutePayload(mission, 'do')
    expect(payload.missionName).toBe('demo-mission')
    expect(payload.samples[0].selectedMetric).toBeCloseTo(8.9)
    expect(payload.metric.summary.count).toBe(2)
  })

  it('edits, inserts, reorders, validates, and exports planned waypoints', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const edited = updateWaypoint(mission, 0, { latitude: 37.4252, depthMeters: 3.1 })
    expect(edited.samples[0].latitude).toBeCloseTo(37.4252)
    expect(edited.samples[0].metrics.depth).toBeCloseTo(3.1)

    const inserted = insertWaypointAfter(edited, 0)
    expect(inserted.samples).toHaveLength(3)
    expect(inserted.samples[1].latitude).toBeGreaterThan(37.4251)

    const moved = moveWaypoint(inserted, 1, 1)
    expect(moved.samples[2].timestamp).toBe(inserted.samples[1].timestamp)

    const deleted = deleteWaypoint(moved, 1)
    expect(deleted.samples).toHaveLength(2)
    expect(validateMissionPlan(deleted).some((warning) => warning.severity === 'error')).toBe(false)
    expect(exportMissionPlanCsv(deleted)).toContain('timestamp,latitude,longitude')
  })

  it('serializes project files and computes preflight readiness', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const project = createProjectFile({
      name: 'Dock Test',
      mission,
      selectedMetricId: 'temperature',
      layers: { track: true, points: true, heatmap: false },
      liveSettings: { host: '192.168.0.67', port: 81, relayUrl: '', deadzone: 0.08, maxOutput: 1, sendRateHz: 20, timeoutSeconds: 1 },
    })
    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.name).toBe('Dock Test')
    expect(parsed.mission.samples).toHaveLength(2)

    const checks = buildPreflightChecks({
      mission,
      planWarnings: [],
      connected: true,
      telemetryHealth: 'fresh',
      status: {
        connected: true,
        armed: false,
        estop: false,
        lastSeq: 1,
        leftMicros: 1500,
        rightMicros: 1500,
        latitude: 37.4251,
        longitude: -122.0841,
        lastSeenUtc: new Date().toISOString(),
      },
      armed: false,
      estop: false,
    })
    expect(preflightReady(checks)).toBe(true)
  })

  it('uses the ESP access-point route for default project live settings', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const parsed = parseProjectFile(JSON.stringify({ version: 1, mission }))

    expect(defaultLiveSettings.host).toBe(espAccessPointHost)
    expect(defaultLiveSettings.port).toBe(espWebSocketPort)
    expect(parsed.liveSettings).toEqual(defaultLiveSettings)
  })

  it('builds mission upload protocol messages', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const plan = buildMissionUploadPlan(mission, 42)
    expect(plan.messages[0]).toMatchObject({ type: 'mission_upload_begin', seq: 42, waypointCount: 2 })
    expect(plan.messages[1]).toMatchObject({ type: 'mission_waypoint', seq: 43, index: 0 })
    expect(plan.messages.at(-1)).toMatchObject({ type: 'mission_upload_commit', seq: 45, checksum: plan.checksum })
    expect(abortUploadMessage(plan.missionId, 46, 'test')).toMatchObject({ type: 'mission_upload_abort', missionId: plan.missionId })
  })

  it('analyzes research phenomena readiness from mission data', () => {
    const mission = parseMission(csv, 'demo-mission.csv')
    const analyses = analyzeResearchPhenomena(mission)
    expect(analyses.map((analysis) => analysis.id)).toEqual(['nighttime_oxygen_trap', 'stormwater_fingerprint_atlas'])
    expect(analyses[0].title).toBe('Nighttime oxygen-trap mapping')
    expect(analyses[0].readinessPercent).toBeGreaterThan(30)
    expect(analyses[1].title).toBe('Stormwater fingerprint atlas')
    expect(analyses[1].aiPlan.join(' ')).toContain('Random forest')
  })

  it('parses ONNX research metadata and builds ordered model features', () => {
    const metadata = parseResearchModelMetadata({
      schemaVersion: 1,
      runtime: 'onnxruntime-web',
      packageName: 'AQUAScan research models',
      packageVersion: 'test',
      generatedUtc: '2026-05-07T00:00:00.000Z',
      models: {
        nighttime_oxygen_trap: {
          displayName: 'Nighttime oxygen-trap mapping',
          enabled: false,
          url: '/models/research/nighttime-oxygen-trap.onnx',
          inputName: 'features',
          featureOrder: ['depth_m', 'dissolved_oxygen_mg_l', 'do_delta_prev'],
        },
      },
    })
    const mission = parseMission(csv, 'demo-mission.csv')
    const features = buildResearchFeatureVector(metadata.models.nighttime_oxygen_trap!, mission, mission.samples[1])
    expect(metadata.models.nighttime_oxygen_trap?.enabled).toBe(false)
    expect(features[0]).toBeCloseTo(2.7)
    expect(features[1]).toBeCloseTo(8.7)
    expect(features[2]).toBeCloseTo(-0.2)
  })
})
