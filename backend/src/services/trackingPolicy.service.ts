export interface HybridTrackingPolicy {
  strategy: 'short_trip' | 'long_trip'
  checkpointIntervalMs: number | null
  plannedUpdateCount: number | null
  updatesPerHour: number | null
  nearDestinationRadiusKm: number
  stopIntermediateUpdatesNearDestination: boolean
}

const SHORT_TRIP_MAX_DURATION_MINUTES = 60
const SHORT_TRIP_UPDATE_COUNT = 3
const LONG_TRIP_UPDATES_PER_HOUR = 2
const DEFAULT_NEAR_DESTINATION_RADIUS_KM = 6
const ARRIVAL_DISTANCE_KM = 0.25

export function buildHybridTrackingPolicy(params: {
  estimatedDurationMinutes: number | null
  estimatedDistanceKm?: number | null
}): HybridTrackingPolicy {
  const durationMinutes = params.estimatedDurationMinutes != null && Number.isFinite(params.estimatedDurationMinutes)
    ? Math.max(1, Math.round(params.estimatedDurationMinutes))
    : null

  if (durationMinutes != null && durationMinutes <= SHORT_TRIP_MAX_DURATION_MINUTES) {
    return {
      strategy: 'short_trip',
      checkpointIntervalMs: Math.max(60_000, Math.round((durationMinutes * 60_000) / SHORT_TRIP_UPDATE_COUNT)),
      plannedUpdateCount: SHORT_TRIP_UPDATE_COUNT,
      updatesPerHour: null,
      nearDestinationRadiusKm: DEFAULT_NEAR_DESTINATION_RADIUS_KM,
      stopIntermediateUpdatesNearDestination: true,
    }
  }

  return {
    strategy: 'long_trip',
    checkpointIntervalMs: Math.round((60 / LONG_TRIP_UPDATES_PER_HOUR) * 60_000),
    plannedUpdateCount: durationMinutes != null ? Math.max(2, Math.ceil(durationMinutes / 30)) : null,
    updatesPerHour: LONG_TRIP_UPDATES_PER_HOUR,
    nearDestinationRadiusKm: DEFAULT_NEAR_DESTINATION_RADIUS_KM,
    stopIntermediateUpdatesNearDestination: true,
  }
}

export function resolveCheckpointIntervalMs(
  policy: HybridTrackingPolicy | null | undefined,
  distanceRemainingKm: number | null,
) {
  if (!policy?.checkpointIntervalMs) {
    return null
  }

  if (
    policy.stopIntermediateUpdatesNearDestination &&
    distanceRemainingKm != null &&
    distanceRemainingKm <= policy.nearDestinationRadiusKm &&
    distanceRemainingKm > ARRIVAL_DISTANCE_KM
  ) {
    return null
  }

  return policy.checkpointIntervalMs
}

export function hasEnteredNearDestinationWindow(
  distanceRemainingKm: number | null,
  policy: HybridTrackingPolicy | null | undefined,
) {
  if (distanceRemainingKm == null || !policy) {
    return false
  }

  return distanceRemainingKm <= policy.nearDestinationRadiusKm && distanceRemainingKm > ARRIVAL_DISTANCE_KM
}

export function isHybridTrackingPolicy(value: unknown): value is HybridTrackingPolicy {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    (candidate.strategy === 'short_trip' || candidate.strategy === 'long_trip') &&
    typeof candidate.nearDestinationRadiusKm === 'number'
  )
}
