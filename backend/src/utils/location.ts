import type { LocationPoint } from '../models/transport.types'

const EARTH_RADIUS_KM = 6371
const DEFAULT_MIN_SEGMENT_METERS = 60

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

export function calculateTrackDistanceKm(
  points: Array<LocationPoint | null | undefined>,
  options?: {
    minSegmentMeters?: number
    maxSegmentKm?: number
  },
) {
  const minSegmentMeters = options?.minSegmentMeters ?? DEFAULT_MIN_SEGMENT_METERS
  const maxSegmentKm = options?.maxSegmentKm ?? 500
  const validPoints = points.filter((point): point is LocationPoint => Boolean(point))

  if (validPoints.length < 2) {
    return 0
  }

  let totalDistance = 0

  for (let index = 1; index < validPoints.length; index += 1) {
    const segmentDistance = haversineDistanceKm(validPoints[index - 1], validPoints[index])

    // Ignore tiny jitter from GPS drift and implausibly huge jumps from bad fixes.
    if (segmentDistance * 1000 < minSegmentMeters || segmentDistance > maxSegmentKm) {
      continue
    }

    totalDistance += segmentDistance
  }

  return roundDistance(totalDistance)
}

export function calculateDistanceVariancePercent(left: number, right: number) {
  const referenceDistance = Math.max(left, right)
  if (!Number.isFinite(referenceDistance) || referenceDistance <= 0) {
    return 0
  }

  return roundDistance((Math.abs(left - right) / referenceDistance) * 100, 2)
}
