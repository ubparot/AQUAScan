import type { GeoReference, Vec3 } from '../types/aqua'

const earthRadius = 6378137

export function degreesToRad(degrees: number) {
  return (degrees * Math.PI) / 180
}

export function geoToLocal(
  originLatitude: number,
  originLongitude: number,
  latitude: number,
  longitude: number,
  altitude = 0,
  originAltitude = 0,
): Vec3 {
  const latRad = degreesToRad(latitude)
  const lonRad = degreesToRad(longitude)
  const originLatRad = degreesToRad(originLatitude)
  const originLonRad = degreesToRad(originLongitude)
  const x = earthRadius * (lonRad - originLonRad) * Math.cos(originLatRad)
  const z = earthRadius * (latRad - originLatRad)
  const y = altitude - originAltitude
  return [x, y, z]
}

export function offsetToLocal(reference: GeoReference, latitude: number, longitude: number, altitude?: number) {
  return geoToLocal(
    reference.originLatitude,
    reference.originLongitude,
    latitude,
    longitude,
    altitude ?? 0,
    reference.originAltitude ?? 0,
  )
}
