import type { LocationPoint } from '../models/transport.types'

const EARTH_RADIUS_KM = 6371

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

export function haversineDistanceKm(from: LocationPoint, to: LocationPoint) {
  const deltaLatitude = degreesToRadians(to.latitude - from.latitude)
  const deltaLongitude = degreesToRadians(to.longitude - from.longitude)
  const latitudeA = degreesToRadians(from.latitude)
  const latitudeB = degreesToRadians(to.latitude)

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2)

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function roundDistance(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
