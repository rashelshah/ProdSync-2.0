import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_CONFIG } from '@/config/map.config'
import { EmptyState } from '@/components/system/SystemStates'

interface LocationPreviewMapProps {
  latitude: number | null
  longitude: number | null
  name: string
  address: string
}

export function LocationPreviewMap({ latitude, longitude, name, address }: LocationPreviewMapProps) {
  if (latitude == null || longitude == null) {
    return (
      <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/70">
        <EmptyState
          icon="map"
          title="Map preview unavailable"
          description="Add coordinates to this location to enable the map preview and future transport route planning."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 dark:border-zinc-800">
      <MapContainer center={[latitude, longitude]} zoom={13} className="h-[260px] w-full" scrollWheelZoom={false}>
        <TileLayer attribution={MAP_CONFIG.osmAttribution} url={MAP_CONFIG.osmTileUrl} />
        <Marker position={[latitude, longitude]}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{name}</p>
              <p className="text-xs">{address}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
