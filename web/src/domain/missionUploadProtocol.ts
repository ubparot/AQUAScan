import type { AquaMission, AquaSample } from '../types/aqua'
import { legDistanceMeters } from './missionPlanner'

export type MissionUploadBegin = {
  type: 'mission_upload_begin'
  seq: number
  missionId: string
  missionName: string
  waypointCount: number
  checksum: string
}

export type MissionUploadWaypoint = {
  type: 'mission_waypoint'
  seq: number
  missionId: string
  index: number
  timestamp: string
  latitude: number
  longitude: number
  altitude?: number
  headingDeg?: number
  speedMps?: number
  depthMeters?: number
}

export type MissionUploadCommit = {
  type: 'mission_upload_commit'
  seq: number
  missionId: string
  checksum: string
}

export type MissionUploadAbort = {
  type: 'mission_upload_abort'
  seq: number
  missionId: string
  reason: string
}

export type MissionUploadAck = {
  type: 'mission_upload_ack'
  missionId: string
  seq: number
  accepted: boolean
  message?: string
}

export type MissionUploadProgress = {
  type: 'mission_upload_progress'
  missionId: string
  receivedWaypoints: number
  waypointCount: number
  checksum?: string
}

export type MissionUploadMessage = MissionUploadBegin | MissionUploadWaypoint | MissionUploadCommit | MissionUploadAbort

export type MissionUploadPlan = {
  missionId: string
  checksum: string
  totalDistanceMeters: number
  messages: MissionUploadMessage[]
  expectedResponses: Array<MissionUploadAck | MissionUploadProgress>
}

export function buildMissionUploadPlan(mission: AquaMission, startingSeq = 1): MissionUploadPlan {
  const missionId = stableMissionId(mission)
  const checksum = missionChecksum(mission)
  let seq = startingSeq
  const messages: MissionUploadMessage[] = [
    {
      type: 'mission_upload_begin',
      seq: seq++,
      missionId,
      missionName: mission.missionName,
      waypointCount: mission.samples.length,
      checksum,
    },
    ...mission.samples.map((sample, index) => waypointMessage(sample, index, missionId, seq++)),
    {
      type: 'mission_upload_commit',
      seq: seq++,
      missionId,
      checksum,
    },
  ]

  return {
    missionId,
    checksum,
    totalDistanceMeters: mission.samples.slice(1).reduce((total, sample, index) => total + legDistanceMeters(mission.samples[index], sample), 0),
    messages,
    expectedResponses: [
      { type: 'mission_upload_ack', missionId, seq: startingSeq, accepted: true },
      { type: 'mission_upload_progress', missionId, receivedWaypoints: mission.samples.length, waypointCount: mission.samples.length, checksum },
    ],
  }
}

export function abortUploadMessage(missionId: string, seq: number, reason: string): MissionUploadAbort {
  return { type: 'mission_upload_abort', seq, missionId, reason }
}

function waypointMessage(sample: AquaSample, index: number, missionId: string, seq: number): MissionUploadWaypoint {
  return {
    type: 'mission_waypoint',
    seq,
    missionId,
    index,
    timestamp: sample.timestamp,
    latitude: sample.latitude,
    longitude: sample.longitude,
    altitude: sample.altitude,
    headingDeg: sample.headingDeg,
    speedMps: sample.speedMps,
    depthMeters: sample.depthMeters,
  }
}

function stableMissionId(mission: AquaMission) {
  return `mission-${hashText(`${mission.missionName}:${mission.samples.length}:${mission.samples[0]?.timestamp ?? ''}`).toString(16)}`
}

function missionChecksum(mission: AquaMission) {
  return hashText(
    mission.samples
      .map((sample) => [sample.timestamp, sample.latitude.toFixed(7), sample.longitude.toFixed(7), sample.altitude ?? '', sample.headingDeg ?? '', sample.speedMps ?? ''].join('|'))
      .join('\n'),
  ).toString(16)
}

function hashText(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
