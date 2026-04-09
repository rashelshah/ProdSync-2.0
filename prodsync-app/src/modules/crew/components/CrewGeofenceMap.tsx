/**
 * CrewGeofenceMap — OpenStreetMap only (Leaflet / react-leaflet)
 *
 * This component MUST NOT import mapbox-gl or use any Mapbox token.
 * The Transport module owns Mapbox; Geofencing is strictly OSM.
 */
import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CrewLocationPoint } from '@/types'

// Fix leaflet default icon path broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom orange marker icon matching the project's design system
const orangeMarkerIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 4px 16px rgba(249,115,22,0.38);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

interface CrewGeofenceMapProps {
  center: CrewLocationPoint | null
  radiusMeters: number
  editable?: boolean
  onCenterChange?: (next: CrewLocationPoint) => void
}

/** Inner component — renders drag-handler only in edit mode */
function DraggableMarker({
  center,
  radiusMeters,
  editable,
  onCenterChange,
}: {
  center: CrewLocationPoint
  radiusMeters: number
  editable: boolean
  onCenterChange?: (next: CrewLocationPoint) => void
}) {
  // Re-center viewport when center changes
  const map = useMapEvents({})

  useMemo(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true })
  }, [center.lat, center.lng, map])

  return (
    <>
      <Marker
        position={[center.lat, center.lng]}
        icon={orangeMarkerIcon}
        draggable={editable}
        eventHandlers={
          editable && onCenterChange
            ? {
                dragend: e => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng()
                  onCenterChange({ lat, lng, accuracy: null, timestamp: new Date().toISOString() })
                },
              }
            : {}
        }
      />
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusMeters}
        pathOptions={{
          color: '#ea580c',
          fillColor: '#f97316',
          fillOpacity: editable ? 0.16 : 0.1,
          weight: 2,
        }}
      />
    </>
  )
}

export function CrewGeofenceMap({ center, radiusMeters, editable = false, onCenterChange }: CrewGeofenceMapProps) {
  const isValidCenter =
    center !== null &&
    Number.isFinite(center.lat) &&
    Number.isFinite(center.lng) &&
    Math.abs(center.lat) <= 90 &&
    Math.abs(center.lng) <= 180

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">OpenStreetMap Geofence</p>
          <p className="mt-1 text-sm text-zinc-900 dark:text-white">
            {editable ? 'Drag the marker to update the center point.' : 'Read-only map with zoom enabled.'}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            editable
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200'
              : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          }`}
        >
          {editable ? 'Edit Mode' : 'View Only'}
        </span>
      </div>

      {isValidCenter ? (
        <MapContainer
          key={`${center!.lat.toFixed(5)}:${center!.lng.toFixed(5)}:${radiusMeters}:${String(editable)}`}
          center={[center!.lat, center!.lng]}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: 320, width: '100%' }}
          dragging={true}
          touchZoom={true}
          doubleClickZoom={true}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <DraggableMarker
            center={center!}
            radiusMeters={radiusMeters}
            editable={editable}
            onCenterChange={onCenterChange}
          />
        </MapContainer>
      ) : (
        <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          Set or fetch a location to preview the geofence.
        </div>
      )}
    </div>
  )
}
