import type { LocationPoint, Trip } from './types'

export interface HybridTrackingPolicy {
  strategy: 'short_trip' | 'long_trip'
  checkpointIntervalMs: number | null
  plannedUpdateCount: number | null
  updatesPerHour: number | null
  nearDestinationRadiusKm: number
  stopIntermediateUpdatesNearDestination: boolean
}

export interface TripTrackingPlan {
  destinationLocation: LocationPoint | null
  estimatedDistanceKm: number | null
  estimatedDurationMinutes: number | null
  hybridPolicy: HybridTrackingPolicy | null
}

function isLocationPoint(value: unknown): value is LocationPoint {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number'
}

function isHybridTrackingPolicy(value: unknown): value is HybridTrackingPolicy {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    (candidate.strategy === 'short_trip' || candidate.strategy === 'long_trip') &&
    typeof candidate.nearDestinationRadiusKm === 'number'
  )
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function extractTripTrackingPlan(trip: Pick<Trip, 'metadata'> | null | undefined): TripTrackingPlan | null {
  const raw = trip?.metadata?.trackingPlan
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const trackingPlan = raw as Record<string, unknown>
  return {
    destinationLocation: isLocationPoint(trackingPlan.destinationLocation) ? trackingPlan.destinationLocation : null,
    estimatedDistanceKm: readNumber(trackingPlan.estimatedDistanceKm),
    estimatedDurationMinutes: readNumber(trackingPlan.estimatedDurationMinutes),
    hybridPolicy: isHybridTrackingPolicy(trackingPlan.hybridPolicy) ? trackingPlan.hybridPolicy : null,
  }
}
