import type { AquaMission, AquaSample, Vec3 } from '../types/aqua'

export type PlaybackSegment = {
  from: AquaSample
  to: AquaSample
  lerp: number
  sample: AquaSample
  position: Vec3
}

export function missionDurationSeconds(mission: AquaMission | undefined) {
  if (!mission || mission.samples.length < 2) return 0
  return sampleSeconds(mission.samples.at(-1)!) - sampleSeconds(mission.samples[0])
}

export function getPlaybackSegment(mission: AquaMission | undefined, normalizedTime: number): PlaybackSegment | undefined {
  if (!mission || mission.samples.length < 2) return undefined
  const samples = mission.samples
  const start = sampleSeconds(samples[0])
  const duration = missionDurationSeconds(mission)
  const target = start + clamp01(normalizedTime) * duration
  const index = findSegmentIndex(samples, target)
  const from = samples[index]
  const to = samples[index + 1]
  const fromTime = sampleSeconds(from)
  const toTime = sampleSeconds(to)
  const lerp = toTime > fromTime ? clamp01((target - fromTime) / (toTime - fromTime)) : 0
  return {
    from,
    to,
    lerp,
    sample: lerp < 0.5 ? from : to,
    position: lerpVec3(from.localPosition, to.localPosition, lerp),
  }
}

export function findSegmentIndex(samples: AquaSample[], targetSeconds: number) {
  for (let i = 0; i < samples.length - 1; i += 1) {
    if (sampleSeconds(samples[i + 1]) >= targetSeconds) return i
  }
  return Math.max(0, samples.length - 2)
}

export function sampleSeconds(sample: AquaSample) {
  return new Date(sample.timestamp).getTime() / 1000
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
