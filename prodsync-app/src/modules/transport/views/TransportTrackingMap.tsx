import { memo, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngExpression } from 'leaflet'
import type mapboxgl from 'mapbox-gl'
import type { FeatureCollection, LineString } from 'geojson'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_CONFIG, type MapProviderMode } from '@/config/map.config'
import type { LiveTrackingMeta, LiveVehicleLocation } from '../types'

export type LeafletFocusLocation = {
  latitude: number
  longitude: number
  label: string
  description?: string
}

type TransportTrackingMapProps = {
  liveLocations: LiveVehicleLocation[]
  liveMeta: LiveTrackingMeta | null
  loading: boolean
  hasActiveTrips: boolean
  leafletFocusLocation?: LeafletFocusLocation | null
  mapModeOverride?: MapProviderMode
}

type MarkerHandle = {
  marker: mapboxgl.Marker
  popup: mapboxgl.Popup
  element: HTMLDivElement
  animationFrame: number | null
  lastCapturedAt: string | null
}

const ROUTE_SOURCE_ID = 'transport-live-routes'
const DEFAULT_LEAFLET_CENTER: LatLngExpression = [13.0827, 80.2707]

function formatStatus(value: LiveVehicleLocation['movingStatus']) {
  switch (value) {
    case 'approaching_destination':
      return 'Approaching'
    case 'arrived':
      return 'Arrived'
    case 'idle':
      return 'Idle'
    case 'stale':
      return 'Stale'
    default:
      return 'En Route'
  }
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildPopupHtml(location: LiveVehicleLocation) {
  return `
    <div style="min-width: 180px; font-family: ui-sans-serif, system-ui, sans-serif;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Vehicle</div>
      <div style="margin-top: 4px; font-size: 14px; font-weight: 700; color: #111827;">${escapeHtml(location.vehicleName)}</div>
      <div style="margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Driver</div>
      <div style="margin-top: 4px; font-size: 14px; color: #111827;">${escapeHtml(location.driverName ?? 'Unassigned')}</div>
      <div style="margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Status</div>
      <div style="margin-top: 4px; font-size: 14px; color: #111827;">${escapeHtml(formatStatus(location.movingStatus ?? 'enroute'))}</div>
    </div>
  `
}

function buildMarkerElement() {
  const element = document.createElement('div')
  element.style.width = '34px'
  element.style.height = '34px'
  element.style.cursor = 'pointer'
  element.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17" cy="17" r="15" fill="#FDBA74" opacity="0.3" />
      <path d="M17 4.5L24.8 26L17 21.2L9.2 26L17 4.5Z" fill="#EA580C" stroke="white" stroke-width="1.5" stroke-linejoin="round" />
      <circle cx="17" cy="17" r="3" fill="white" />
    </svg>
  `
  return element
}

function buildLeafletIcon(tone: 'vehicle' | 'focus') {
  const fill = tone === 'vehicle' ? '#EA580C' : '#0F766E'
  const halo = tone === 'vehicle' ? '#FDBA74' : '#5EEAD4'

  return L.divIcon({
    className: '',
    html: `
      <div style="width:36px;height:36px;display:grid;place-items:center;">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="16" fill="${halo}" opacity="0.28"/>
          <circle cx="18" cy="18" r="9" fill="${fill}" stroke="white" stroke-width="2"/>
          <circle cx="18" cy="18" r="3" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}

function getDisplayRouteCoordinates(location: LiveVehicleLocation) {
  if ((location.plannedRouteCoordinates?.length ?? 0) > 1) {
    return location.plannedRouteCoordinates ?? []
  }

  if ((location.routeCoordinates?.length ?? 0) > 1) {
    return location.routeCoordinates ?? []
  }

  if (typeof location.previousLatitude === 'number' && typeof location.previousLongitude === 'number') {
    return [
      [location.previousLongitude, location.previousLatitude],
      [location.longitude, location.latitude],
    ] as Array<[number, number]>
  }

  return [[location.longitude, location.latitude]] as Array<[number, number]>
}

function buildRouteCollection(liveLocations: LiveVehicleLocation[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: liveLocations
      .map(location => ({
        location,
        routeCoordinates: getDisplayRouteCoordinates(location),
      }))
      .filter(entry => entry.routeCoordinates.length > 1)
      .map(entry => ({
        type: 'Feature' as const,
        properties: {
          vehicleId: entry.location.vehicleId,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: entry.routeCoordinates,
        },
      })),
  }
}

function interpolateRoute(routeCoordinates: Array<[number, number]>, progress: number): [number, number] {
  if (routeCoordinates.length === 0) {
    return [0, 0]
  }

  if (routeCoordinates.length === 1 || progress <= 0) {
    return routeCoordinates[0]
  }

  if (progress >= 1) {
    return routeCoordinates[routeCoordinates.length - 1]
  }

  const segments = routeCoordinates.slice(1).map((coordinate, index) => {
    const previous = routeCoordinates[index]
    const deltaX = coordinate[0] - previous[0]
    const deltaY = coordinate[1] - previous[1]
    return {
      from: previous,
      to: coordinate,
      length: Math.hypot(deltaX, deltaY),
    }
  })
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0)
  if (totalLength <= 0) {
    return routeCoordinates[routeCoordinates.length - 1]
  }

  let remaining = totalLength * progress
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const segmentProgress = segment.length === 0 ? 0 : remaining / segment.length
      return [
        segment.from[0] + (segment.to[0] - segment.from[0]) * segmentProgress,
        segment.from[1] + (segment.to[1] - segment.from[1]) * segmentProgress,
      ]
    }

    remaining -= segment.length
  }

  return routeCoordinates[routeCoordinates.length - 1]
}

function computeBearing(location: LiveVehicleLocation) {
  if (typeof location.heading === 'number' && Number.isFinite(location.heading)) {
    return location.heading
  }

  if (typeof location.previousLatitude !== 'number' || typeof location.previousLongitude !== 'number') {
    return 0
  }

  const startLongitude = location.previousLongitude * (Math.PI / 180)
  const endLongitude = location.longitude * (Math.PI / 180)
  const startLatitude = location.previousLatitude * (Math.PI / 180)
  const endLatitude = location.latitude * (Math.PI / 180)
  const y = Math.sin(endLongitude - startLongitude) * Math.cos(endLatitude)
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(endLongitude - startLongitude)

  if (x === 0 && y === 0) {
    return 0
  }

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

function closestProgressOnRoute(routeCoordinates: Array<[number, number]>, point: [number, number]) {
  if (routeCoordinates.length < 2) {
    return 0
  }

  let totalLength = 0
  let traversed = 0
  let bestProgress = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const start = routeCoordinates[index - 1]
    const end = routeCoordinates[index]
    const deltaX = end[0] - start[0]
    const deltaY = end[1] - start[1]
    const segmentLength = Math.hypot(deltaX, deltaY)

    if (segmentLength === 0) {
      continue
    }

    totalLength += segmentLength
  }

  if (totalLength === 0) {
    return 0
  }

  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const start = routeCoordinates[index - 1]
    const end = routeCoordinates[index]
    const deltaX = end[0] - start[0]
    const deltaY = end[1] - start[1]
    const segmentLength = Math.hypot(deltaX, deltaY)

    if (segmentLength === 0) {
      continue
    }

    const projection = Math.max(0, Math.min(1, (((point[0] - start[0]) * deltaX) + ((point[1] - start[1]) * deltaY)) / (segmentLength * segmentLength)))
    const projectedPoint: [number, number] = [
      start[0] + deltaX * projection,
      start[1] + deltaY * projection,
    ]
    const projectedDistance = Math.hypot(point[0] - projectedPoint[0], point[1] - projectedPoint[1])

    if (projectedDistance < bestDistance) {
      bestDistance = projectedDistance
      bestProgress = (traversed + segmentLength * projection) / totalLength
    }

    traversed += segmentLength
  }

  return bestProgress
}

function resolvePredictedCoordinate(location: LiveVehicleLocation, routeCoordinates: Array<[number, number]>, now: number): [number, number] {
  const capturedAt = new Date(location.capturedAt).getTime()
  const expectedNextUpdateAt = location.expectedNextUpdateAt ? new Date(location.expectedNextUpdateAt).getTime() : Number.NaN

  if (!Number.isFinite(capturedAt) || !Number.isFinite(expectedNextUpdateAt) || expectedNextUpdateAt <= capturedAt) {
    return [location.longitude, location.latitude]
  }

  const progressStart = closestProgressOnRoute(routeCoordinates, [location.longitude, location.latitude])
  const maxProgress = Math.min(0.985, progressStart + (1 - progressStart) * 0.92)
  const elapsedProgress = Math.max(0, Math.min(1, (now - capturedAt) / (expectedNextUpdateAt - capturedAt)))

  return interpolateRoute(routeCoordinates, progressStart + (maxProgress - progressStart) * elapsedProgress)
}

function lastKnownLocationLabel(location: LiveVehicleLocation) {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

function toLeafletRoute(routeCoordinates: Array<[number, number]> | undefined) {
  return (routeCoordinates ?? [])
    .filter(point => Array.isArray(point) && point.length === 2)
    .map(([longitude, latitude]) => [latitude, longitude] as LatLngExpression)
}

function leafletLocationKey(liveLocations: LiveVehicleLocation[], focus?: LeafletFocusLocation | null) {
  return JSON.stringify({
    focus: focus ? [focus.latitude, focus.longitude] : null,
    locations: liveLocations.map(location => [location.vehicleId, location.latitude, location.longitude, location.capturedAt]),
  })
}

function LeafletViewport({
  liveLocations,
  focus,
}: {
  liveLocations: LiveVehicleLocation[]
  focus?: LeafletFocusLocation | null
}) {
  const map = useMap()
  const viewportKey = useMemo(() => leafletLocationKey(liveLocations, focus), [focus, liveLocations])

  useEffect(() => {
    const points = liveLocations.length > 0
      ? liveLocations.map(location => [location.latitude, location.longitude] as LatLngExpression)
      : focus
        ? [[focus.latitude, focus.longitude] as LatLngExpression]
        : []

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [36, 36],
        maxZoom: 13,
      })
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true })
    }
  }, [map, viewportKey])

  return null
}

function LeafletTrackingMap({
  liveLocations,
  focus,
  loading,
}: {
  liveLocations: LiveVehicleLocation[]
  focus?: LeafletFocusLocation | null
  loading: boolean
}) {
  const center = liveLocations[0]
    ? [liveLocations[0].latitude, liveLocations[0].longitude] as LatLngExpression
    : focus
      ? [focus.latitude, focus.longitude] as LatLngExpression
      : DEFAULT_LEAFLET_CENTER
  const vehicleIcon = useMemo(() => buildLeafletIcon('vehicle'), [])
  const focusIcon = useMemo(() => buildLeafletIcon('focus'), [])

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <MapContainer center={center} zoom={12} className="h-[320px] w-full" scrollWheelZoom={false}>
        <TileLayer attribution={MAP_CONFIG.osmAttribution} url={MAP_CONFIG.osmTileUrl} />
        <LeafletViewport liveLocations={liveLocations} focus={focus} />

        {liveLocations.map(location => {
          const route = toLeafletRoute(getDisplayRouteCoordinates(location))
          return route.length > 1 ? (
            <Polyline
              key={`${location.vehicleId}-route`}
              positions={route}
              pathOptions={{ color: '#EA580C', weight: 4, opacity: 0.85 }}
            />
          ) : null
        })}

        {liveLocations.map(location => (
          <Marker
            key={location.vehicleId}
            position={[location.latitude, location.longitude]}
            icon={vehicleIcon}
          >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Vehicle</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{location.vehicleName}</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Driver</p>
                  <p className="mt-1 text-sm text-zinc-700">{location.driverName ?? 'Unassigned'}</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Updated</p>
                  <p className="mt-1 text-sm text-zinc-700">{formatTimestamp(location.capturedAt)}</p>
                </div>
              </Popup>
          </Marker>
        ))}

        {liveLocations.length === 0 && focus && (
          <Marker position={[focus.latitude, focus.longitude]} icon={focusIcon}>
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-sm font-semibold text-zinc-900">{focus.label}</p>
                {focus.description && <p className="mt-1 text-xs text-zinc-600">{focus.description}</p>}
                <p className="mt-2 text-xs text-zinc-500">{focus.latitude.toFixed(5)}, {focus.longitude.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {liveLocations.length === 0 && (
        <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {loading
            ? 'Loading the latest checkpoints...'
            : focus
              ? 'OSM is active until an active trip begins.'
              : 'OSM is active. Waiting for current location or trip destination coordinates.'}
        </div>
      )}
    </div>
  )
}

export const TransportTrackingMap = memo(function TransportTrackingMap({
  liveLocations,
  liveMeta,
  loading,
  hasActiveTrips,
  leafletFocusLocation,
  mapModeOverride = 'auto',
}: TransportTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<Map<string, MarkerHandle>>(new Map())
  const hasFitBoundsRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapUnavailable, setMapUnavailable] = useState(false)

  const routeCollection = useMemo(() => buildRouteCollection(liveLocations), [liveLocations])
  const mapboxAvailable = Boolean(MAP_CONFIG.publicToken && liveMeta?.mapEnabled && liveMeta?.provider === 'mapbox')
  const activeTrackingAvailable = hasActiveTrips && liveLocations.length > 0
  const wantsMapbox = mapModeOverride === 'mapbox' || (mapModeOverride === 'auto' && activeTrackingAvailable)
  const shouldUseMapbox = mapboxAvailable && wantsMapbox && !mapUnavailable

  useEffect(() => {
    if (!mapboxAvailable) {
      setMapUnavailable(false)
    }
  }, [mapboxAvailable])

  useEffect(() => {
    if (!shouldUseMapbox || !containerRef.current || mapRef.current) {
      return
    }

    let disposed = false
    let map: mapboxgl.Map | null = null

    // Frontend Mapbox usage is limited to public-token GL rendering. Secret calls stay on backend proxy/cache routes.
    void import('mapbox-gl')
      .then(module => {
        if (disposed || !containerRef.current) {
          return
        }

        const mapbox = module.default
        mapboxRef.current = mapbox
        mapbox.accessToken = MAP_CONFIG.publicToken
        map = new mapbox.Map({
          container: containerRef.current,
          style: MAP_CONFIG.styleUrl,
          attributionControl: false,
        })

        map.addControl(new mapbox.NavigationControl({ showCompass: false }), 'top-right')
        map.on('load', () => {
          if (disposed) {
            return
          }

          if (!map?.getSource(ROUTE_SOURCE_ID)) {
            map?.addSource(ROUTE_SOURCE_ID, {
              type: 'geojson',
              data: buildRouteCollection([]),
            })
          }

          map?.addLayer({
            id: `${ROUTE_SOURCE_ID}-halo`,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': '#FDBA74',
              'line-width': 8,
              'line-opacity': 0.32,
            },
          })

          map?.addLayer({
            id: `${ROUTE_SOURCE_ID}-path`,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': '#EA580C',
              'line-width': 4,
              'line-opacity': 0.94,
            },
          })

          mapRef.current = map
          setMapReady(true)
        })
      })
      .catch(error => {
        if (import.meta.env.DEV) {
          console.warn('[transport][tracking-map] mapbox unavailable', error instanceof Error ? error.message : 'load failed')
        }
        if (!disposed) {
          setMapUnavailable(true)
        }
      })

    return () => {
      disposed = true
      markersRef.current.forEach(handle => {
        if (handle.animationFrame != null) {
          cancelAnimationFrame(handle.animationFrame)
        }
        handle.popup.remove()
        handle.marker.remove()
      })
      markersRef.current.clear()
      hasFitBoundsRef.current = false
      setMapReady(false)
      map?.remove()
      mapRef.current = null
    }
  }, [shouldUseMapbox])

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return
    }

    const source = mapRef.current.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    source?.setData(routeCollection)
  }, [mapReady, routeCollection])

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return
    }

    const map = mapRef.current
    const mapbox = mapboxRef.current
    if (!mapbox) {
      return
    }
    const activeVehicleIds = new Set(liveLocations.map(location => location.vehicleId))

    markersRef.current.forEach((handle, vehicleId) => {
      if (activeVehicleIds.has(vehicleId)) {
        return
      }

      if (handle.animationFrame != null) {
        cancelAnimationFrame(handle.animationFrame)
      }
      handle.popup.remove()
      handle.marker.remove()
      markersRef.current.delete(vehicleId)
    })

    liveLocations.forEach(location => {
      let handle = markersRef.current.get(location.vehicleId)
      if (!handle) {
        const element = buildMarkerElement()
        const popup = new mapbox.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 18,
        }).setHTML(buildPopupHtml(location))

        const marker = new mapbox.Marker({
          element,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        })
          .setLngLat([location.longitude, location.latitude])
          .addTo(map)

        element.addEventListener('mouseenter', () => {
          popup.setLngLat(marker.getLngLat()).addTo(map)
        })
        element.addEventListener('mouseleave', () => {
          popup.remove()
        })
        element.addEventListener('click', () => {
          popup.setLngLat(marker.getLngLat()).addTo(map)
        })

        handle = {
          marker,
          popup,
          element,
          animationFrame: null,
          lastCapturedAt: null,
        }
        markersRef.current.set(location.vehicleId, handle)
      }

      handle.popup.setHTML(buildPopupHtml(location))
      handle.marker.setRotation(computeBearing(location))
      const displayRouteCoordinates = getDisplayRouteCoordinates(location)

      if (handle.animationFrame != null) {
        cancelAnimationFrame(handle.animationFrame)
        handle.animationFrame = null
      }

      const runPredictiveMotion = () => {
        if (displayRouteCoordinates.length < 2 || !location.expectedNextUpdateAt) {
          return false
        }

        const animate = () => {
          const [lng, lat] = resolvePredictedCoordinate(location, displayRouteCoordinates, Date.now())
          handle?.marker.setLngLat([lng, lat])
          handle!.animationFrame = requestAnimationFrame(animate)
        }

        handle.animationFrame = requestAnimationFrame(animate)
        return true
      }

      if (!handle.lastCapturedAt || handle.lastCapturedAt === location.capturedAt) {
        handle.marker.setLngLat([location.longitude, location.latitude])
        runPredictiveMotion()
        handle.lastCapturedAt = location.capturedAt
        return
      }
      const durationMs = Math.max(
        1_000,
        location.previousCapturedAt
          ? new Date(location.capturedAt).getTime() - new Date(location.previousCapturedAt).getTime()
          : location.updateIntervalMs ?? 1_500,
      )
      const animationStart = performance.now()

      const animate = (timestamp: number) => {
        const progress = Math.min(1, (timestamp - animationStart) / durationMs)
        const [lng, lat] = interpolateRoute(displayRouteCoordinates, progress)
        handle?.marker.setLngLat([lng, lat])

        if (progress < 1) {
          handle!.animationFrame = requestAnimationFrame(animate)
          return
        }

        handle!.animationFrame = null
        runPredictiveMotion()
      }

      handle.lastCapturedAt = location.capturedAt
      handle.animationFrame = requestAnimationFrame(animate)
    })

    if (liveLocations.length === 0 || hasFitBoundsRef.current) {
      return
    }

    if (liveLocations.length === 1) {
      map.setCenter([liveLocations[0].longitude, liveLocations[0].latitude])
      map.setZoom(12)
      hasFitBoundsRef.current = true
      return
    }

    const bounds = new mapbox.LngLatBounds()
    liveLocations.forEach(location => {
      bounds.extend([location.longitude, location.latitude])
    })
    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: 12.5,
      duration: 900,
    })
    hasFitBoundsRef.current = true
  }, [liveLocations, mapReady])

  if (!shouldUseMapbox) {
    return (
      <div className="space-y-4">
        <LeafletTrackingMap
          liveLocations={liveLocations}
          focus={leafletFocusLocation}
          loading={loading}
        />

        {liveLocations.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {liveLocations.map(location => (
              <div key={location.vehicleId} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{location.vehicleName}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{location.driverName ?? 'Unassigned driver'}</p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700 dark:bg-orange-500/12 dark:text-orange-300">
                    {formatStatus(location.movingStatus ?? 'enroute')}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Last Known</p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-200">{lastKnownLocationLabel(location)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Updated</p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-200">{formatTimestamp(location.capturedAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div ref={containerRef} className="h-[320px] w-full" />
    </div>
  )
})
