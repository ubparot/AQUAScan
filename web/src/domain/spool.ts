export type SpoolGeometry = {
  coreRadiusMeters: number
  cableDiameterMeters: number
  spoolWidthMeters: number
  zeroRotations: number
  rotationToSpoolRatio: number
  invertDirection: boolean
  verticalEfficiency: number
}

export const defaultSpoolGeometry: SpoolGeometry = {
  coreRadiusMeters: 0.018,
  cableDiameterMeters: 0.0025,
  spoolWidthMeters: 0.045,
  zeroRotations: 0,
  rotationToSpoolRatio: 1,
  invertDirection: false,
  verticalEfficiency: 0.96,
}

export function estimateDepthMeters(measuredRotations: number, geometry: Partial<SpoolGeometry> = {}) {
  const sanitized = sanitizeGeometry(geometry)
  return estimateCableLengthMeters(measuredRotations, sanitized) * clamp01(sanitized.verticalEfficiency)
}

export function estimateCableLengthMeters(measuredRotations: number, geometry: Partial<SpoolGeometry> = {}) {
  const sanitized = sanitizeGeometry(geometry)
  let signedSpoolRotations = (measuredRotations - sanitized.zeroRotations) * sanitized.rotationToSpoolRatio
  if (sanitized.invertDirection) signedSpoolRotations = -signedSpoolRotations

  let remainingRotations = Math.max(0, signedSpoolRotations)
  if (remainingRotations <= 0) return 0

  const wrapsPerLayer = Math.max(1, Math.floor(sanitized.spoolWidthMeters / sanitized.cableDiameterMeters))
  let cableLength = 0
  let layer = 0

  while (remainingRotations > 0 && layer < 256) {
    const rotationsThisLayer = Math.min(remainingRotations, wrapsPerLayer)
    const layerCenterRadius = sanitized.coreRadiusMeters + sanitized.cableDiameterMeters * (0.5 + layer)
    cableLength += rotationsThisLayer * 2 * Math.PI * layerCenterRadius
    remainingRotations -= rotationsThisLayer
    layer += 1
  }

  return cableLength
}

export function rotationsFromDegrees(degrees: number) {
  return degrees / 360
}

export function rotationsFromEncoderTicks(ticks: number, ticksPerRevolution: number) {
  return ticksPerRevolution > 0 ? ticks / ticksPerRevolution : 0
}

function sanitizeGeometry(geometry: Partial<SpoolGeometry>): SpoolGeometry {
  return {
    coreRadiusMeters:
      geometry.coreRadiusMeters && geometry.coreRadiusMeters > 0
        ? geometry.coreRadiusMeters
        : defaultSpoolGeometry.coreRadiusMeters,
    cableDiameterMeters:
      geometry.cableDiameterMeters && geometry.cableDiameterMeters > 0
        ? geometry.cableDiameterMeters
        : defaultSpoolGeometry.cableDiameterMeters,
    spoolWidthMeters:
      geometry.spoolWidthMeters && geometry.spoolWidthMeters > 0
        ? geometry.spoolWidthMeters
        : defaultSpoolGeometry.spoolWidthMeters,
    zeroRotations: geometry.zeroRotations ?? defaultSpoolGeometry.zeroRotations,
    rotationToSpoolRatio:
      geometry.rotationToSpoolRatio && Math.abs(geometry.rotationToSpoolRatio) > 0.00001
        ? geometry.rotationToSpoolRatio
        : defaultSpoolGeometry.rotationToSpoolRatio,
    invertDirection: geometry.invertDirection ?? defaultSpoolGeometry.invertDirection,
    verticalEfficiency:
      geometry.verticalEfficiency && geometry.verticalEfficiency > 0
        ? geometry.verticalEfficiency
        : defaultSpoolGeometry.verticalEfficiency,
  }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
