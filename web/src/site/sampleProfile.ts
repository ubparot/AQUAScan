/** Station 5 of the sample pond-profile mission (public/missions/do-extrapolated-mission.csv). */
export const PROFILE: Array<[depth: number, temperature: number, oxygen: number]> = [
  [0.1, 27.1, 5.95], [0.25, 26.9, 5.74], [0.5, 26.5, 5.23], [0.75, 26.0, 4.63], [1.0, 25.4, 3.82], [1.25, 24.9, 3.11],
  [1.5, 24.3, 2.4], [1.75, 23.9, 1.89], [2.0, 23.6, 1.49], [2.25, 23.4, 1.18], [2.5, 23.2, 0.97],
]

/** Temperature and dissolved oxygen at any depth, interpolated between the profile's readings. */
export function readingAt(depth: number) {
  const first = PROFILE[0]
  const last = PROFILE[PROFILE.length - 1]
  if (depth <= first[0]) return { depth, temperature: first[1], oxygen: first[2] }
  if (depth >= last[0]) return { depth, temperature: last[1], oxygen: last[2] }
  const i = PROFILE.findIndex(([d]) => d >= depth)
  const [d0, t0, o0] = PROFILE[i - 1]
  const [d1, t1, o1] = PROFILE[i]
  const k = (depth - d0) / (d1 - d0)
  return { depth, temperature: t0 + (t1 - t0) * k, oxygen: o0 + (o1 - o0) * k }
}
