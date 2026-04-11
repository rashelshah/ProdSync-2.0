import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { transportService } from '@/services/transport.service'
import { getTransportSocket } from '../realtime'
import { extractTripTrackingPlan } from '../tracking-policy'
import type { LiveTrackingMeta, LiveVehicleLocation, TripUI } from '../types'

interface UseTransportLiveTrackingArgs {
  activeProjectId: string | null | undefined
  activeTrips: TripUI[]
  canViewLiveTracking: boolean
  trackingMode: 'stream' | 'leaflet' | 'none'
  isDriver: boolean
}

type TrackingStreamState = {
  status: 'idle' | 'scheduled' | 'uploading' | 'paused' | 'error'
  message: string
}

const DEFAULT_STREAM_STATE: TrackingStreamState = {
  status: 'idle',
  message: 'Hybrid tracking activates when an active trip is detected on this device.',
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusMeters = 6_371_000
  const latitudeDelta = toRadians(b.latitude - a.latitude)
  const longitudeDelta = toRadians(b.longitude - a.longitude)
  const latitudeA = toRadians(a.latitude)
  const latitudeB = toRadians(b.latitude)

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2)

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function hasCoordinates(location: { latitude?: number | null; longitude?: number | null } | null | undefined): location is { latitude: number; longitude: number } {
  return location != null && typeof location.latitude === 'number' && typeof location.longitude === 'number'
}

function upsertLiveLocation(current: LiveVehicleLocation[], next: LiveVehicleLocation) {
  const existingIndex = current.findIndex(item => item.vehicleId === next.vehicleId)
  if (existingIndex === -1) {
    return [next, ...current]
  }

  const updated = [...current]
  const existing = updated[existingIndex]
  updated[existingIndex] = {
    ...existing,
    ...next,
    routeCoordinates: (next.routeCoordinates?.length ?? 0) > 1 ? next.routeCoordinates : existing.routeCoordinates,
    routeProvider: next.routeProvider === 'mapbox' || !existing.routeProvider ? next.routeProvider : existing.routeProvider,
    plannedRouteCoordinates: (next.plannedRouteCoordinates?.length ?? 0) > 1 ? next.plannedRouteCoordinates : existing.plannedRouteCoordinates,
    plannedRouteProvider: next.plannedRouteProvider === 'mapbox' || !existing.plannedRouteProvider
      ? next.plannedRouteProvider
      : existing.plannedRouteProvider,
  }
  return updated
}

export function useTransportLiveTracking({
  activeProjectId,
  activeTrips,
  canViewLiveTracking,
  trackingMode,
  isDriver,
}: UseTransportLiveTrackingArgs) {
  const user = useAuthStore(state => state.user)
  const [liveLocations, setLiveLocations] = useState<LiveVehicleLocation[]>([])
  const [liveMeta, setLiveMeta] = useState<LiveTrackingMeta | null>(null)
  const [streamState, setStreamState] = useState<TrackingStreamState>(DEFAULT_STREAM_STATE)
  const lastCheckpointRef = useRef<{
    latitude: number
    longitude: number
    capturedAt: number
    updateIntervalMs: number | null
    expectedNextUpdateAt: number | null
  } | null>(null)
  const latestPositionRef = useRef<{
    latitude: number
    longitude: number
    speedKph: number | null
    heading: number | null
    accuracyMeters: number | null
    capturedAt: number
  } | null>(null)
  const uploadInFlightRef = useRef(false)
  const previousFixRef = useRef<{ latitude: number; longitude: number } | null>(null)

  const activeTripForDriver = useMemo(
    () => activeTrips.find(trip => trip.driverUserId === user?.id) ?? null,
    [activeTrips, user?.id],
  )
  const activeDriverLiveLocation = useMemo(
    () => activeTripForDriver ? liveLocations.find(location => location.tripId === activeTripForDriver.id) ?? null : null,
    [activeTripForDriver, liveLocations],
  )
  const trackingPlan = useMemo(
    () => extractTripTrackingPlan(activeTripForDriver),
    [activeTripForDriver],
  )
  const usesRealtimeTracking = trackingMode === 'stream'
  const usesLeafletPolling = trackingMode === 'leaflet'

  const liveLocationsQuery = useQuery({
    queryKey: ['tracking-live', activeProjectId],
    queryFn: () => transportService.getLiveTrackingState(activeProjectId!),
    enabled: Boolean(activeProjectId && canViewLiveTracking),
    refetchInterval: !canViewLiveTracking
      ? false
      : usesLeafletPolling
        ? activeTrips.length > 0
          ? 5 * 60_000
          : false
        : activeTrips.length > 0
          ? 60_000
          : false,
    staleTime: usesLeafletPolling ? 4 * 60_000 : 15_000,
  })

  useEffect(() => {
    setLiveLocations(liveLocationsQuery.data?.data ?? [])
    setLiveMeta(liveLocationsQuery.data?.meta ?? null)
  }, [liveLocationsQuery.data])

  useEffect(() => {
    if (canViewLiveTracking) {
      return
    }

    setLiveLocations([])
    setLiveMeta(null)
  }, [canViewLiveTracking])

  useEffect(() => {
    if (!activeProjectId || !canViewLiveTracking || !usesRealtimeTracking) {
      return
    }

    let cancelled = false
    let detach: (() => void) | null = null

    void getTransportSocket().then(socket => {
      if (cancelled || !socket) {
        return
      }

      const handleLocationUpdate = (payload: { projectId: string; data: LiveVehicleLocation }) => {
        if (payload.projectId !== activeProjectId) {
          return
        }

        setLiveLocations(current => upsertLiveLocation(current, payload.data))
      }

      socket.emit('tracking:subscribe', activeProjectId)
      socket.on('vehicle_location_update', handleLocationUpdate)
      detach = () => {
        socket.off('vehicle_location_update', handleLocationUpdate)
        socket.emit('tracking:unsubscribe', activeProjectId)
      }
    })

    return () => {
      cancelled = true
      detach?.()
    }
  }, [activeProjectId, canViewLiveTracking, usesRealtimeTracking])

  useEffect(() => {
    if (!activeDriverLiveLocation) {
      lastCheckpointRef.current = null
      return
    }

    lastCheckpointRef.current = {
      latitude: activeDriverLiveLocation.latitude,
      longitude: activeDriverLiveLocation.longitude,
      capturedAt: new Date(activeDriverLiveLocation.capturedAt).getTime(),
      updateIntervalMs: activeDriverLiveLocation.updateIntervalMs ?? null,
      expectedNextUpdateAt: activeDriverLiveLocation.expectedNextUpdateAt
        ? new Date(activeDriverLiveLocation.expectedNextUpdateAt).getTime()
        : null,
    }
  }, [
    activeDriverLiveLocation?.capturedAt,
    activeDriverLiveLocation?.expectedNextUpdateAt,
    activeDriverLiveLocation?.latitude,
    activeDriverLiveLocation?.longitude,
    activeDriverLiveLocation?.updateIntervalMs,
  ])

  useEffect(() => {
    if (!activeProjectId || !isDriver || !activeTripForDriver) {
      setStreamState(DEFAULT_STREAM_STATE)
      latestPositionRef.current = null
      lastCheckpointRef.current = null
      uploadInFlightRef.current = false
      return
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStreamState({
        status: 'error',
        message: 'This device does not support trip checkpoint tracking.',
      })
      return
    }

    let cancelled = false
    let watchId: number | null = null
    let intervalId: number | null = null

    const resolveHeading = (position: GeolocationPosition) => {
      if (position.coords.heading != null && Number.isFinite(position.coords.heading)) {
        return Number(position.coords.heading.toFixed(2))
      }

      const previous = previousFixRef.current
      if (!previous) {
        return null
      }

      const latitudeA = toRadians(previous.latitude)
      const latitudeB = toRadians(position.coords.latitude)
      const longitudeDelta = toRadians(position.coords.longitude - previous.longitude)
      const y = Math.sin(longitudeDelta) * Math.cos(latitudeB)
      const x =
        Math.cos(latitudeA) * Math.sin(latitudeB) -
        Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta)

      if (x === 0 && y === 0) {
        return null
      }

      return Number(((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360).toFixed(2))
    }

    const maybeSendCheckpoint = () => {
      if (cancelled || uploadInFlightRef.current) {
        return
      }

      const latestPosition = latestPositionRef.current
      if (!latestPosition) {
        setStreamState({
          status: 'scheduled',
          message: 'Waiting for the current device location before sending the next checkpoint.',
        })
        return
      }

      const checkpointState = lastCheckpointRef.current
      const fallbackIntervalMs = trackingPlan?.hybridPolicy?.checkpointIntervalMs ?? null
      const nextDueAt = checkpointState?.expectedNextUpdateAt
        ?? (checkpointState && checkpointState.updateIntervalMs != null
          ? checkpointState.capturedAt + checkpointState.updateIntervalMs
          : fallbackIntervalMs != null
            ? new Date(activeTripForDriver.startTime).getTime() + fallbackIntervalMs
            : null)

      const destinationLocation = trackingPlan?.destinationLocation ?? null
      const nearDestinationRadiusKm = trackingPlan?.hybridPolicy?.nearDestinationRadiusKm ?? 6
      if (
        trackingPlan?.hybridPolicy?.stopIntermediateUpdatesNearDestination &&
        hasCoordinates(destinationLocation) &&
        distanceMeters(latestPosition, destinationLocation) <= nearDestinationRadiusKm * 1000
      ) {
        setStreamState({
          status: 'paused',
          message: 'Near destination. Intermediate updates are paused and only the final stop will be recorded.',
        })
        return
      }

      if (nextDueAt == null) {
        setStreamState({
          status: 'scheduled',
          message: 'Checkpoint tracking is active. The backend will decide when the next update is due.',
        })
        return
      }

      if (Date.now() < nextDueAt) {
        setStreamState({
          status: 'scheduled',
          message: `Next checkpoint scheduled for ${new Date(nextDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        })
        return
      }

      uploadInFlightRef.current = true
      setStreamState({
        status: 'uploading',
        message: 'Sending the next scheduled checkpoint for your trip.',
      })

      void getTransportSocket().then(socket => {
        if (!socket || cancelled) {
          uploadInFlightRef.current = false
          if (!cancelled) {
            setStreamState({
              status: 'error',
              message: 'The tracking connection is unavailable right now.',
            })
          }
          return
        }

        socket.emit('vehicle_location_update', {
          projectId: activeProjectId,
          tripId: activeTripForDriver.id,
          vehicleId: activeTripForDriver.vehicleId,
          latitude: latestPosition.latitude,
          longitude: latestPosition.longitude,
          speedKph: latestPosition.speedKph,
          heading: latestPosition.heading,
          accuracyMeters: latestPosition.accuracyMeters,
          capturedAt: new Date(latestPosition.capturedAt).toISOString(),
        }, (response: { ok: boolean; error?: string; data?: LiveVehicleLocation }) => {
          uploadInFlightRef.current = false
          if (cancelled) {
            return
          }

          if (response?.ok && response.data) {
            setLiveLocations(current => upsertLiveLocation(current, response.data!))
            lastCheckpointRef.current = {
              latitude: response.data.latitude,
              longitude: response.data.longitude,
              capturedAt: new Date(response.data.capturedAt).getTime(),
              updateIntervalMs: response.data.updateIntervalMs ?? null,
              expectedNextUpdateAt: response.data.expectedNextUpdateAt
                ? new Date(response.data.expectedNextUpdateAt).getTime()
                : null,
            }
            setStreamState({
              status: 'scheduled',
              message: response.data.expectedNextUpdateAt
                ? `Checkpoint sent. Next update after ${new Date(response.data.expectedNextUpdateAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                : 'Checkpoint sent. The trip is now in final-stop mode near the destination.',
            })
            return
          }

          setStreamState({
            status: 'error',
            message: response?.error ?? 'The scheduled checkpoint could not be uploaded right now.',
          })
        })
      })
    }

    const pushLocation = (position: GeolocationPosition) => {
      const heading = resolveHeading(position)
      previousFixRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
      latestPositionRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speedKph: position.coords.speed != null ? Number((position.coords.speed * 3.6).toFixed(2)) : null,
        heading,
        accuracyMeters: position.coords.accuracy != null ? Number(position.coords.accuracy.toFixed(2)) : null,
        capturedAt: typeof position.timestamp === 'number' ? position.timestamp : Date.now(),
      }
      maybeSendCheckpoint()
    }

    const handleError = (error: GeolocationPositionError) => {
      if (cancelled) {
        return
      }

      setStreamState({
        status: 'error',
        message: error.message || 'Location permission is required for trip checkpoint tracking.',
      })
    }

    watchId = navigator.geolocation.watchPosition(pushLocation, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    })
    intervalId = window.setInterval(maybeSendCheckpoint, 5_000)

    return () => {
      cancelled = true
      uploadInFlightRef.current = false
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
    }
  }, [activeProjectId, activeTripForDriver, isDriver, trackingPlan])

  return {
    liveLocations,
    liveMeta,
    trackingLoading: liveLocationsQuery.isLoading,
    streamState,
    liveLocationsFailed: liveLocationsQuery.isError,
  }
}
