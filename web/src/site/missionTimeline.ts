/**
 * The "Get the highlights" mission, as a pure function of scroll progress (0 → 1) so the page can use it
 * without loading Three.js. Seen side-on: x runs along the pond, y is up, the water surface is y = 0, and the
 * boat's bow points along +x. Four equal beats: drive, lower, read, map.
 */
import { clamp } from './probeTimeline'
import { PROFILE, readingAt } from './sampleProfile'

export const BEATS = 4

/** Smoothstep, for starts and stops that ease in and out. */
export const ease = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

/** Which beat is on screen (0–3) for a given progress. */
export const beatAt = (p: number) => Math.min(BEATS - 1, Math.floor(clamp(p) * BEATS))

/** The boat drives in from the left and stops over the sampling point at x = 0. */
export const ROUTE = { startX: -3.8, targetX: 0 }

/** Pond depth along the section: deepest at the sampling point, shelving toward the banks. */
export const WATER_DEPTH = 2.75
export const bedDepth = (x: number) => WATER_DEPTH - 1.1 * Math.min(1, (x / 7) ** 2)

/** How far the probe travels down: from tucked between the hulls to the last reading at 2.5 m. */
export const PROBE_STOWED_Y = 0.05
export const PROBE_BOTTOM_DEPTH = 2.5

/** Sampling stations along the section, with each one's bottom-water oxygen in mg/L (sample data). */
export const STATIONS: Array<{ x: number; oxygen: number }> = [
  { x: -4.4, oxygen: 5.2 },
  { x: -2.9, oxygen: 4.1 },
  { x: -1.45, oxygen: 2.5 },
  { x: ROUTE.targetX, oxygen: 0.97 },
  { x: 1.45, oxygen: 1.6 },
  { x: 2.9, oxygen: 3.2 },
]
export const SECTION = { from: -5.2, to: 3.7 }

const SURFACE_OXYGEN = PROFILE[0][2]
const BOTTOM_OXYGEN = PROFILE[PROFILE.length - 1][2]

/** Oxygen at a depth for a station whose bottom water holds `bottom` mg/L, shaped like the sample profile. */
export function stationOxygen(bottom: number, depth: number) {
  const shape = (readingAt(depth).oxygen - BOTTOM_OXYGEN) / (SURFACE_OXYGEN - BOTTOM_OXYGEN) // 1 at the top, 0 at the bottom
  return bottom + (SURFACE_OXYGEN - bottom) * shape
}

/** Oxygen anywhere in the section: each station's profile, blended by distance along the pond. */
export function sectionOxygen(x: number, depth: number) {
  let sum = 0
  let weight = 0
  for (const s of STATIONS) {
    const k = 1 / ((s.x - x) ** 2 + 0.08) ** 2
    sum += stationOxygen(s.oxygen, depth) * k
    weight += k
  }
  return sum / weight
}

export type MissionState = {
  beat: number
  /** 0 → 1 along the route. */
  travel: number
  boatX: number
  /** How far the probe has been let out below its stowed position, in metres. */
  lowered: number
  /** Probe depth below the surface (0 while it is still above the water). */
  depth: number
  /** 0 → 1 as the station casts and the oxygen section appear. */
  map: number
  /** Camera blend: 0 wide on the drive, 1 close on the probe, 2 wide on the section. */
  view: number
}

export function missionAt(progress: number): MissionState {
  const s = clamp(progress) * BEATS
  const travel = ease(s / 0.9)

  // Beat 2 lets the probe out to 1 m; beat 3 carries it to the bottom reading; beat 4 winds it back in.
  const fullOut = PROBE_STOWED_Y + PROBE_BOTTOM_DEPTH
  const toMetre = PROBE_STOWED_Y + 1
  let lowered = ease((s - 1.05) / 0.85) * toMetre + ease((s - 2.05) / 0.8) * (fullOut - toMetre)
  lowered *= 1 - ease((s - 3) / 0.4)
  const depth = Math.max(0, lowered - PROBE_STOWED_Y)

  return {
    beat: Math.min(BEATS - 1, Math.floor(s)),
    travel,
    boatX: ROUTE.startX + (ROUTE.targetX - ROUTE.startX) * travel,
    lowered,
    depth,
    map: ease((s - 3.2) / 0.6),
    view: ease((s - 0.85) / 0.35) + ease((s - 3.05) / 0.45),
  }
}

/** Oxygen (mg/L) to a colour: red-orange where it's low, through amber and teal, to blue where it's plentiful. */
const RAMP: Array<[number, [number, number, number]]> = [
  [0.5, [0xe2, 0x4d, 0x34]],
  [2, [0xf2, 0xa1, 0x3c]],
  [3.5, [0x2b, 0xb5, 0x9a]],
  [6, [0x2f, 0x80, 0xea]],
]

export function oxygenColor(oxygen: number): [number, number, number] {
  if (oxygen <= RAMP[0][0]) return RAMP[0][1]
  for (let i = 1; i < RAMP.length; i++) {
    const [o1, c1] = RAMP[i]
    if (oxygen <= o1) {
      const [o0, c0] = RAMP[i - 1]
      const k = (oxygen - o0) / (o1 - o0)
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number]
    }
  }
  return RAMP[RAMP.length - 1][1]
}
