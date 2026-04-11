export type MapProviderMode = 'auto' | 'osm' | 'mapbox'

const rawPublicToken = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '').trim()
const rawStyleUrl = (import.meta.env.VITE_MAPBOX_STYLE_URL || '').trim()

function isRestrictedPublicToken(token: string) {
  return token.startsWith('pk.')
}

export const MAP_CONFIG = {
  provider: 'mapbox' as const,
  fallback: 'osm' as const,
  publicToken: isRestrictedPublicToken(rawPublicToken) ? rawPublicToken : '',
  styleUrl: rawStyleUrl || 'mapbox://styles/mapbox/navigation-day-v1',
  osmTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  osmAttribution: '&copy; OpenStreetMap contributors',
  publicTokenConfigured: rawPublicToken.length > 0,
  publicTokenUsable: isRestrictedPublicToken(rawPublicToken),
}
