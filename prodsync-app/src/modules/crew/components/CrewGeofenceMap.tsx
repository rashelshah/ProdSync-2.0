import { useEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { CrewLocationPoint } from '@/types'

interface CrewGeofenceMapProps {
  center: CrewLocationPoint | null
  radiusMeters: number
  editable?: boolean
  onCenterChange?: (next: CrewLocationPoint) => void
}

const MAP_STYLE: mapboxgl.Style = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: 'OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

function buildCircle(center: CrewLocationPoint, radiusMeters: number, points = 64) {
  const coordinates: [number, number][] = []
  const latRadians = (center.lat * Math.PI) / 180
  const latScale = radiusMeters / 111320
  const lngScale = radiusMeters / (111320 * Math.cos(latRadians))

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2
    coordinates.push([
      center.lng + lngScale * Math.cos(angle),
      center.lat + latScale * Math.sin(angle),
    ])
  }

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates],
        },
      },
    ],
  }
}

function buildPoint(center: CrewLocationPoint) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [center.lng, center.lat],
        },
      },
    ],
  }
}

function createMarkerElement() {
  const node = document.createElement('div')
  node.className = 'crew-geofence-marker'
  node.innerHTML = `
    <div style="height:20px;width:20px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 8px 20px rgba(249,115,22,0.28);"></div>
  `
  return node
}

export function CrewGeofenceMap({ center, radiusMeters, editable = false, onCenterChange }: CrewGeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const centerKey = useMemo(
    () => (center ? `${center.lat.toFixed(5)}:${center.lng.toFixed(5)}:${radiusMeters}:${editable}` : `empty:${radiusMeters}:${editable}`),
    [center, editable, radiusMeters],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !center) {
      return
    }

    let disposed = false
    let localMap: mapboxgl.Map | null = null

    void import('mapbox-gl')
      .then(module => {
        if (disposed || !containerRef.current) {
          return
        }

        const mapbox = module.default
        localMap = new mapbox.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: [center.lng, center.lat],
          zoom: 15,
          attributionControl: true,
          dragPan: editable,
        })

        localMap.addControl(new mapbox.NavigationControl({ showCompass: false }), 'top-right')
        localMap.on('load', () => {
          if (disposed || !localMap || !center) {
            return
          }

          localMap.addSource('crew-geofence-radius', {
            type: 'geojson',
            data: buildCircle(center, radiusMeters),
          })
          localMap.addSource('crew-geofence-center', {
            type: 'geojson',
            data: buildPoint(center),
          })

          localMap.addLayer({
            id: 'crew-geofence-fill',
            type: 'fill',
            source: 'crew-geofence-radius',
            paint: {
              'fill-color': '#f97316',
              'fill-opacity': editable ? 0.16 : 0.1,
            },
          })
          localMap.addLayer({
            id: 'crew-geofence-stroke',
            type: 'line',
            source: 'crew-geofence-radius',
            paint: {
              'line-color': '#ea580c',
              'line-width': 2,
            },
          })

          const marker = new mapbox.Marker({
            element: createMarkerElement(),
            draggable: editable,
          })
            .setLngLat([center.lng, center.lat])
            .addTo(localMap)

          marker.on('dragend', () => {
            const next = marker.getLngLat()
            onCenterChange?.({
              lat: next.lat,
              lng: next.lng,
              accuracy: null,
              timestamp: new Date().toISOString(),
            })
          })

          markerRef.current = marker
          mapRef.current = localMap
          setMapReady(true)
        })
      })
      .catch(error => {
        console.warn('[crew][geofence-map] failed to load mapbox-gl', error)
      })

    return () => {
      disposed = true
      markerRef.current?.remove()
      markerRef.current = null
      localMap?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [center, editable, onCenterChange, radiusMeters])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !center) {
      return
    }

    const map = mapRef.current
    const radiusSource = map.getSource('crew-geofence-radius') as mapboxgl.GeoJSONSource | undefined
    const pointSource = map.getSource('crew-geofence-center') as mapboxgl.GeoJSONSource | undefined

    radiusSource?.setData(buildCircle(center, radiusMeters))
    pointSource?.setData(buildPoint(center))
    markerRef.current?.setLngLat([center.lng, center.lat])
    markerRef.current?.setDraggable(editable)
    map.dragPan[editable ? 'enable' : 'disable']()
    map.easeTo({ center: [center.lng, center.lat], duration: 450 })
  }, [centerKey, center, editable, mapReady, radiusMeters])

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">OpenStreetMap Geofence</p>
          <p className="mt-1 text-sm text-zinc-900 dark:text-white">{editable ? 'Drag the marker to update the center point.' : 'Read-only map with zoom enabled.'}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${editable ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'}`}>
          {editable ? 'Edit Mode' : 'View Only'}
        </span>
      </div>
      {center ? (
        <div ref={containerRef} className="h-[320px] w-full" />
      ) : (
        <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          Set or fetch a location to preview the geofence.
        </div>
      )}
    </div>
  )
}
