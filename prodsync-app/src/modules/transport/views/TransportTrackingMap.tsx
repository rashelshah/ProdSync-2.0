import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FeatureCollection, LineString } from 'geojson'
import type { LiveTrackingMeta, LiveVehicleLocation } from '../types'

type TransportTrackingMapProps = {
  liveLocations: LiveVehicleLocation[]
  liveMeta: LiveTrackingMeta | null
  loading: boolean
}

type MarkerHandle = {
  marker: mapboxgl.Marker
  popup: mapboxgl.Popup
  element: HTMLDivElement
  animationFrame: number | null
  lastCapturedAt: string | null
}

const ROUTE_SOURCE_ID = 'transport-live-routes'
const MAPBOX_PUBLIC_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_URL = import.meta.env.VITE_MAPBOX_STYLE_URL?.trim() || 'mapbox://styles/mapbox/navigation-day-v1'

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

function buildPopupHtml(location: LiveVehicleLocation) {
  return `
    <div style="min-width: 180px; font-family: ui-sans-serif, system-ui, sans-serif;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Vehicle</div>
      <div style="margin-top: 4px; font-size: 14px; font-weight: 700; color: #111827;">${location.vehicleName}</div>
      <div style="margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Driver</div>
      <div style="margin-top: 4px; font-size: 14px; color: #111827;">${location.driverName ?? 'Unassigned'}</div>
      <div style="margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a;">Status</div>
      <div style="margin-top: 4px; font-size: 14px; color: #111827;">${formatStatus(location.movingStatus ?? 'enroute')}</div>
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

function buildRouteCollection(liveLocations: LiveVehicleLocation[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: liveLocations
      .filter(location => (location.routeCoordinates?.length ?? 0) > 1)
      .map(location => ({
        type: 'Feature' as const,
        properties: {
          vehicleId: location.vehicleId,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: location.routeCoordinates ?? [],
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

function lastKnownLocationLabel(location: LiveVehicleLocation) {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

export const TransportTrackingMap = memo(function TransportTrackingMap({
  liveLocations,
  liveMeta,
  loading,
}: TransportTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<Map<string, MarkerHandle>>(new Map())
  const hasFitBoundsRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapUnavailable, setMapUnavailable] = useState(false)

  const routeCollection = useMemo(() => buildRouteCollection(liveLocations), [liveLocations])
  const canUseMapbox = Boolean(MAPBOX_PUBLIC_TOKEN && liveMeta?.mapboxEnabledForAdmin)
  const shouldUseMapbox = canUseMapbox && !mapUnavailable

  useEffect(() => {
    if (!canUseMapbox) {
      setMapUnavailable(false)
    }
  }, [canUseMapbox])

  useEffect(() => {
    if (!shouldUseMapbox || !containerRef.current || mapRef.current) {
      return
    }

    let disposed = false
    let map: mapboxgl.Map | null = null

    // Frontend Mapbox usage is limited to GL JS rendering. All location search/reverse geocoding stays on backend APIs.
    void import('mapbox-gl')
      .then(module => {
        if (disposed || !containerRef.current) {
          return
        }

        const mapbox = module.default
        mapboxRef.current = mapbox
        mapbox.accessToken = MAPBOX_PUBLIC_TOKEN
        map = new mapbox.Map({
          container: containerRef.current,
          style: MAPBOX_STYLE_URL,
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
        console.warn('[transport][tracking-map] failed to load mapbox', error)
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

      if (!handle.lastCapturedAt || handle.lastCapturedAt === location.capturedAt) {
        handle.marker.setLngLat([location.longitude, location.latitude])
        handle.lastCapturedAt = location.capturedAt
        return
      }

      if (handle.animationFrame != null) {
        cancelAnimationFrame(handle.animationFrame)
      }

      const routeCoordinates: Array<[number, number]> = location.routeCoordinates?.length
        ? location.routeCoordinates
        : [
          [location.previousLongitude ?? location.longitude, location.previousLatitude ?? location.latitude],
          [location.longitude, location.latitude],
        ]
      const durationMs = Math.max(
        1_000,
        location.previousCapturedAt
          ? new Date(location.capturedAt).getTime() - new Date(location.previousCapturedAt).getTime()
          : location.updateIntervalMs ?? 1_500,
      )
      const animationStart = performance.now()

      const animate = (timestamp: number) => {
        const progress = Math.min(1, (timestamp - animationStart) / durationMs)
        const [lng, lat] = interpolateRoute(routeCoordinates, progress)
        handle?.marker.setLngLat([lng, lat])

        if (progress < 1) {
          handle!.animationFrame = requestAnimationFrame(animate)
          return
        }

        handle!.animationFrame = null
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
        <div className="flex h-[320px] items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-zinc-100 px-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {!MAPBOX_PUBLIC_TOKEN
            ? 'Map unavailable due to configuration. Add a restricted public Mapbox token to enable rendering.'
            : liveMeta?.mapboxMode === 'disabled'
              ? 'Mapbox is disabled for cost control, so the system is showing a lightweight fallback with last known positions only.'
              : 'Mapbox is unavailable in this environment, so the system is showing last known positions only.'}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {liveLocations.length === 0 ? (
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              {loading ? 'Loading the latest checkpoints...' : 'No active vehicles are broadcasting checkpoints right now.'}
            </div>
          ) : (
            liveLocations.map(location => (
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
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div ref={containerRef} className="h-[320px] w-full" />
    </div>
  )
})
