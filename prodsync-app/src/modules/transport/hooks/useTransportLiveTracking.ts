import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { transportService } from '@/services/transport.service'
import { getTransportSocket } from '../realtime'
import type { LiveVehicleLocation, TripUI } from '../types'

interface UseTransportLiveTrackingArgs {
  activeProjectId: string | null | undefined
  activeTrips: TripUI[]
  canManageTransport: boolean
  isDriver: boolean
}

type TrackingStreamState = {
  status: 'idle' | 'streaming' | 'error'
  message: string
}

const DEFAULT_STREAM_STATE: TrackingStreamState = {
  status: 'idle',
  message: 'Live tracking activates when an active trip is detected on this device.',
}

const GPS_PUSH_INTERVAL_MS = 10_000
const GPS_MIN_DISTANCE_METERS = 20

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

function upsertLiveLocation(current: LiveVehicleLocation[], next: LiveVehicleLocation) {
  const existingIndex = current.findIndex(item => item.vehicleId === next.vehicleId)
  if (existingIndex === -1) {
    return [next, ...current]
  }

  const updated = [...current]
  updated[existingIndex] = next
  return updated
}

export function useTransportLiveTracking({
  activeProjectId,
  activeTrips,
  canManageTransport,
  isDriver,
}: UseTransportLiveTrackingArgs) {
  const user = useAuthStore(state => state.user)
  const [liveLocations, setLiveLocations] = useState<LiveVehicleLocation[]>([])
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [streamState, setStreamState] = useState<TrackingStreamState>(DEFAULT_STREAM_STATE)
  const lastSentRef = useRef<{ latitude: number; longitude: number; capturedAt: number } | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const activeTripForDriver = useMemo(
    () => activeTrips.find(trip => trip.driverUserId === user?.id) ?? null,
    [activeTrips, user?.id],
  )

  const liveLocationsQuery = useQuery({
    queryKey: ['tracking-live', activeProjectId],
    queryFn: () => transportService.getLiveVehicleLocations(activeProjectId!),
    enabled: Boolean(activeProjectId && (canManageTransport || isDriver)),
    staleTime: 15_000,
  })

  useEffect(() => {
    setLiveLocations(liveLocationsQuery.data ?? [])
  }, [liveLocationsQuery.data])

  useEffect(() => {
    if (!activeProjectId) {
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

      socket.emit('project:subscribe', activeProjectId)
      socket.on('vehicle_location_update', handleLocationUpdate)
      detach = () => {
        socket.off('vehicle_location_update', handleLocationUpdate)
      }
    })

    return () => {
      cancelled = true
      detach?.()
    }
  }, [activeProjectId])

  useEffect(() => {
    if (!activeProjectId || !isDriver || !activeTripForDriver) {
      setStreamState(DEFAULT_STREAM_STATE)
      lastSentRef.current = null
      return
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStreamState({
        status: 'error',
        message: 'This device does not support live GPS tracking.',
      })
      return
    }

    let cancelled = false
    let watchId: number | null = null

    const pushLocation = (position: GeolocationPosition) => {
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      const capturedAt = Date.now()
      const previous = lastSentRef.current

      if (
        previous &&
        capturedAt - previous.capturedAt < GPS_PUSH_INTERVAL_MS &&
        distanceMeters(previous, { latitude, longitude }) < GPS_MIN_DISTANCE_METERS
      ) {
        return
      }

      lastSentRef.current = { latitude, longitude, capturedAt }
      setStreamState({
        status: 'streaming',
        message: 'Live GPS is streaming for your active trip.',
      })

      void getTransportSocket().then(socket => {
        if (!socket || cancelled) {
          return
        }

        socket.emit('vehicle_location_update', {
          projectId: activeProjectId,
          tripId: activeTripForDriver.id,
          vehicleId: activeTripForDriver.vehicleId,
          latitude,
          longitude,
          speedKph: position.coords.speed != null ? Number((position.coords.speed * 3.6).toFixed(2)) : null,
          heading: position.coords.heading != null ? Number(position.coords.heading.toFixed(2)) : null,
          accuracyMeters: position.coords.accuracy != null ? Number(position.coords.accuracy.toFixed(2)) : null,
          capturedAt: new Date(capturedAt).toISOString(),
        }, (response: { ok: boolean; error?: string }) => {
          if (response?.ok || cancelled) {
            return
          }

          setStreamState({
            status: 'error',
            message: response.error ?? 'Live GPS could not be uploaded right now.',
          })
        })
      })
    }

    const handleError = (error: GeolocationPositionError) => {
      if (cancelled) {
        return
      }

      setStreamState({
        status: 'error',
        message: error.message || 'Location permission is required for live tracking.',
      })
    }

    watchId = navigator.geolocation.watchPosition(pushLocation, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    })

    return () => {
      cancelled = true
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [activeProjectId, activeTripForDriver, isDriver])

  useEffect(() => {
    if (!activeProjectId || !canManageTransport) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setMapImageUrl(null)
      setMapLoading(false)
      return
    }

    let cancelled = false
    setMapLoading(true)
    const timeout = window.setTimeout(() => {
      void transportService.getLiveTrackingMapBlob(activeProjectId, {
        width: 1080,
        height: 420,
      })
        .then(blob => {
          if (cancelled) {
            return
          }

          const nextUrl = URL.createObjectURL(blob)
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
          }

          objectUrlRef.current = nextUrl
          setMapImageUrl(nextUrl)
          setMapLoading(false)
        })
        .catch(() => {
          if (cancelled) {
            return
          }

          setMapImageUrl(null)
          setMapLoading(false)
        })
    }, 650)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [activeProjectId, canManageTransport, liveLocations])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  return {
    liveLocations,
    mapImageUrl,
    mapLoading,
    streamState,
    liveLocationsFailed: liveLocationsQuery.isError,
  }
}
