import type { AquaMission, LayerVisibility, LiveSettings } from '../types/aqua'
import { cloneMissionForPlanning } from './missionPlanner'

export type AquaProjectFile = {
  version: 1
  id: string
  name: string
  savedAtUtc: string
  mission: AquaMission
  selectedMetricId: string
  layers: LayerVisibility
  liveSettings: LiveSettings
}

export type ProjectSummary = {
  id: string
  name: string
  savedAtUtc: string
  sampleCount: number
}

export function createProjectFile({
  id = createProjectId(),
  name,
  mission,
  selectedMetricId,
  layers,
  liveSettings,
}: {
  id?: string
  name: string
  mission: AquaMission
  selectedMetricId: string
  layers: LayerVisibility
  liveSettings: LiveSettings
}): AquaProjectFile {
  return {
    version: 1,
    id,
    name: name.trim() || mission.missionName || 'AQUAScan Mission',
    savedAtUtc: new Date().toISOString(),
    mission: cloneMissionForPlanning(mission),
    selectedMetricId,
    layers,
    liveSettings,
  }
}

export function parseProjectFile(contents: string): AquaProjectFile {
  const parsed = JSON.parse(contents) as Partial<AquaProjectFile>
  if (parsed.version !== 1) throw new Error('Unsupported AQUAScan project version')
  if (!parsed.mission || !Array.isArray(parsed.mission.samples)) throw new Error('Project file is missing mission samples')
  return {
    version: 1,
    id: parsed.id || createProjectId(),
    name: parsed.name || parsed.mission.missionName || 'AQUAScan Mission',
    savedAtUtc: parsed.savedAtUtc || new Date().toISOString(),
    mission: cloneMissionForPlanning(parsed.mission),
    selectedMetricId: parsed.selectedMetricId || 'temperature',
    layers: parsed.layers || { track: true, points: true, heatmap: true },
    liveSettings:
      parsed.liveSettings ||
      ({
        host: '192.168.0.187',
        port: 81,
        deadzone: 0.08,
        maxOutput: 1,
        sendRateHz: 10,
        timeoutSeconds: 1,
      } satisfies LiveSettings),
  }
}

export function projectSummary(project: AquaProjectFile): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    savedAtUtc: project.savedAtUtc,
    sampleCount: project.mission.samples.length,
  }
}

export function serializeProjectFile(project: AquaProjectFile) {
  return JSON.stringify(project, null, 2)
}

function createProjectId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
