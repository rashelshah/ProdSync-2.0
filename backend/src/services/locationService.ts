import type { LocationPoint } from '../models/transport.types'
import { getCacheJson, setCacheJson } from './cache.service'
import {
  getMapboxToken,
  getMapboxUsageState,
  hasMapboxToken,
  incrementMapboxUsage,
  mapboxUsageSnapshot,
  safeMapboxCall,
  type MapboxUsageState,
  type MapProviderRole,
} from './mapboxUsageService'

export { hasMapboxToken }
export { incrementMapboxUsage }
export type { MapProviderRole }

export type GeocodeProvider = 'cache' | 'osm' | 'mapbox'

export interface LocationSuggestionRecord {
  id: string
  label: string
  address: string
  location: LocationPoint
}

export type MapboxBudgetState = MapboxUsageState

export interface ReverseGeocodeResult {
  address: string
  provider: GeocodeProvider
  sourceProvider: Exclude<GeocodeProvider, 'cache'>
  cacheHit: boolean
  budget: ReturnType<typeof mapboxUsageSnapshot>
}

export interface ForwardGeocodeResult {
  suggestions: LocationSuggestionRecord[]
  provider: GeocodeProvider
  sourceProvider: Exclude<GeocodeProvider, 'cache'>
  cacheHit: boolean
  budget: ReturnType<typeof mapboxUsageSnapshot>
}

interface ReverseCacheEntry {
  address: string
  provider: Exclude<GeocodeProvider, 'cache'>
}

interface SearchCacheEntry {
  suggestions: LocationSuggestionRecord[]
  provider: Exclude<GeocodeProvider, 'cache'>
}

type NormalizedLocation = {
  latitude: number
  longitude: number
}

const CACHE_TTL_SECONDS = 24 * 60 * 60
const OSM_THROTTLE_MS = 1_000
const REQUEST_TIMEOUT_MS = 8_000
const OSM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const OSM_FORWARD_URL = 'https://nominatim.openstreetmap.org/search'
const MAPBOX_FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward'

const reverseInflight = new Map<string, Promise<ReverseGeocodeResult>>()
const searchInflight = new Map<string, Promise<ForwardGeocodeResult>>()

let osmQueue: Promise<unknown> = Promise.resolve()
let nextOsmRequestAt = 0

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRequestHeaders() {
  return {
    Accept: 'application/json',
    'User-Agent': 'ProdSync/2.0 transport-location-service',
  }
}

function normalizeCoordinate(value: number) {
  return Number(value.toFixed(5))
}

function normalizeLocation(latitude: number, longitude: number): NormalizedLocation {
  return {
    latitude: normalizeCoordinate(latitude),
    longitude: normalizeCoordinate(longitude),
  }
}

function formatCoordinate(value: number) {
  return normalizeCoordinate(value).toFixed(5)
}

function coordinateFallback(location: NormalizedLocation) {
  return `${formatCoordinate(location.latitude)}, ${formatCoordinate(location.longitude)}`
}

function reverseCacheKey(location: NormalizedLocation) {
  return `geo:${formatCoordinate(location.latitude)}:${formatCoordinate(location.longitude)}`
}

function searchCacheKey(query: string) {
  return `search:${(query ?? '').trim().toLowerCase()}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: getRequestHeaders(),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Provider request failed with status ${response.status}`)
    }

    return response.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

async function scheduleOsmRequest<T>(task: () => Promise<T>) {
  const scheduled = osmQueue.then(async () => {
    const waitMs = Math.max(0, nextOsmRequestAt - Date.now())
    if (waitMs > 0) {
      await sleep(waitMs)
    }

    nextOsmRequestAt = Date.now() + OSM_THROTTLE_MS
    return task()
  })

  osmQueue = scheduled.catch(() => undefined)
  return scheduled
}

function normalizeAddress(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

function extractAddressParts(properties: Record<string, unknown>) {
  return [
    properties.name,
    properties.full_address,
    properties.place_formatted,
    properties.street,
    properties.housenumber,
    properties.district,
    properties.city,
    properties.state,
    properties.country,
  ]
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
}

function buildSuggestionLabel(properties: Record<string, unknown>, fallback: string) {
  const parts = extractAddressParts(properties)
  return parts.length > 0 ? parts.slice(0, 4).join(', ') : fallback
}

export function mapboxBudgetSnapshot(budget: MapboxBudgetState) {
  return mapboxUsageSnapshot(budget)
}

export function getMapProvider(userRole: MapProviderRole, budget?: MapboxBudgetState) {
  if (!hasMapboxToken()) {
    return 'osm'
  }

  if (budget && (!budget.enabled || budget.mode === 'disabled')) {
    return 'osm'
  }

  if (userRole === 'ADMIN' || userRole === 'PRODUCER') {
    return 'mapbox'
  }

  return 'osm'
}

export async function getMapboxBudgetState(): Promise<MapboxBudgetState> {
  return getMapboxUsageState()
}

function canUseMapboxForFallback(userRole: MapProviderRole, budget: MapboxBudgetState) {
  return getMapProvider(userRole, budget) === 'mapbox' && budget.mode !== 'disabled'
}

function canUseMapboxForWeakSearch(userRole: MapProviderRole, budget: MapboxBudgetState) {
  return getMapProvider(userRole, budget) === 'mapbox' && budget.mode === 'normal'
}

export function providerOrder(userRole: MapProviderRole, budget: MapboxBudgetState): Array<Exclude<GeocodeProvider, 'cache'>> {
  if (getMapProvider(userRole, budget) !== 'mapbox' || budget.mode === 'disabled') {
    return ['osm']
  }

  return ['osm', 'mapbox']
}

async function reverseWithOsm(location: NormalizedLocation) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(location.latitude),
    lon: String(location.longitude),
    zoom: '18',
    addressdetails: '1',
  })

  const payload = await scheduleOsmRequest(() => fetchJson<{ display_name?: string }>(`${OSM_REVERSE_URL}?${params.toString()}`))
  return normalizeAddress(payload.display_name, coordinateFallback(location))
}

async function searchWithOsm(query: string) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '5',
    addressdetails: '1',
  })

  const payload = await scheduleOsmRequest(() => fetchJson<Array<{
    lat?: string
    lon?: string
    display_name?: string
    place_id?: number
    name?: string
  }>>(`${OSM_FORWARD_URL}?${params.toString()}`))

  return payload.reduce<LocationSuggestionRecord[]>((accumulator, item, index) => {
    const latitude = Number(item.lat)
    const longitude = Number(item.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return accumulator
    }

    const address = normalizeAddress(item.display_name ?? item.name, 'Unnamed location')
    accumulator.push({
      id: String(item.place_id ?? `${address}-${latitude}-${longitude}-${index}`),
      label: address,
      address,
      location: {
        latitude,
        longitude,
        address,
      },
    })
    return accumulator
  }, []).slice(0, 5)
}

async function searchWithMapbox(query: string) {
  const token = getMapboxToken()
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    limit: '5',
    autocomplete: 'true',
  })

  const payload = await fetchJson<{
    features?: Array<{
      id?: string
      geometry?: { coordinates?: [number, number] }
      properties?: Record<string, unknown>
      place_name?: string
      name_preferred?: string
      text?: string
    }>
  }>(`${MAPBOX_FORWARD_URL}?${params.toString()}`)

  const suggestions = (payload.features ?? []).reduce<LocationSuggestionRecord[]>((accumulator, feature, index) => {
    const latitude = feature.geometry?.coordinates?.[1]
    const longitude = feature.geometry?.coordinates?.[0]

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return accumulator
    }

    const properties = feature.properties ?? {}
    const label = buildSuggestionLabel(
      properties,
      normalizeAddress(feature.place_name ?? feature.name_preferred ?? feature.text, 'Unnamed location'),
    )

    accumulator.push({
      id: String(feature.id ?? `${label}-${latitude}-${longitude}-${index}`),
      label,
      address: label,
      location: {
        latitude,
        longitude,
        address: label,
      },
    })

    return accumulator
  }, []).slice(0, 5)

  await incrementMapboxUsage()
  return suggestions
}

function osmSearchLooksWeak(query: string, suggestions: LocationSuggestionRecord[]) {
  if (suggestions.length === 0) {
    return true
  }

  const normalizedQuery = normalizeText(query)
  const queryTokens = normalizedQuery.split(' ').filter(token => token.length >= 2)
  if (queryTokens.length === 0) {
    return false
  }

  return !suggestions.slice(0, 3).some(suggestion => {
    const label = normalizeText(`${suggestion.label} ${suggestion.address}`)
    return queryTokens.every(token => label.includes(token))
  })
}

async function readReverseCache(location: NormalizedLocation) {
  return getCacheJson<ReverseCacheEntry>(reverseCacheKey(location))
}

async function readSearchCache(query: string) {
  return getCacheJson<SearchCacheEntry>(searchCacheKey(query))
}

async function writeReverseCache(location: NormalizedLocation, entry: ReverseCacheEntry) {
  await setCacheJson(reverseCacheKey(location), entry, CACHE_TTL_SECONDS)
}

async function writeSearchCache(query: string, entry: SearchCacheEntry) {
  await setCacheJson(searchCacheKey(query), entry, CACHE_TTL_SECONDS)
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  _userRole: MapProviderRole = 'MEMBER',
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      address: 'Location unavailable',
      provider: 'osm',
      sourceProvider: 'osm',
      cacheHit: false,
      budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
    }
  }

  const location = normalizeLocation(latitude, longitude)
  try {
    const budget = await getMapboxBudgetState()
    const cached = await readReverseCache(location)
    if (cached?.address) {
      return {
        address: cached.address,
        provider: 'cache',
        sourceProvider: cached.provider,
        cacheHit: true,
        budget: mapboxBudgetSnapshot(budget),
      }
    }

    const cacheKey = reverseCacheKey(location)
    const inflight = reverseInflight.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      try {
        const address = await reverseWithOsm(location)
        await writeReverseCache(location, { address, provider: 'osm' })
        return {
          address,
          provider: 'osm' as const,
          sourceProvider: 'osm' as const,
          cacheHit: false,
          budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
        }
      } catch (error) {
        console.warn('[location][reverse] osm failed', {
          latitude: location.latitude,
          longitude: location.longitude,
          error: error instanceof Error ? error.message : error,
        })
      }

      const fallbackAddress = 'Location unavailable'
      await writeReverseCache(location, { address: fallbackAddress, provider: 'osm' })
      return {
        address: fallbackAddress,
        provider: 'osm' as const,
        sourceProvider: 'osm' as const,
        cacheHit: false,
        budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
      }
    })().finally(() => {
      reverseInflight.delete(cacheKey)
    })

    reverseInflight.set(cacheKey, request)
    return request
  } catch {
    return {
      address: 'Location unavailable',
      provider: 'osm',
      sourceProvider: 'osm',
      cacheHit: false,
      budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
    }
  }
}

export async function forwardGeocode(
  query: string | null | undefined,
  userRole: MapProviderRole = 'MEMBER',
): Promise<ForwardGeocodeResult> {
  const normalizedQuery = (query ?? '').trim()
  const budget = await getMapboxBudgetState()
  if (normalizedQuery.length < 2) {
    return {
      suggestions: [],
      provider: 'cache',
      sourceProvider: 'osm',
      cacheHit: false,
      budget: mapboxBudgetSnapshot(budget),
    }
  }

  try {
    const cached = await readSearchCache(normalizedQuery)
    if (cached) {
      return {
        suggestions: cached.suggestions,
        provider: 'cache',
        sourceProvider: cached.provider,
        cacheHit: true,
        budget: mapboxBudgetSnapshot(budget),
      }
    }

    const cacheKey = searchCacheKey(normalizedQuery)
    const inflight = searchInflight.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      let osmSuggestions: LocationSuggestionRecord[] = []

      try {
        osmSuggestions = await searchWithOsm(normalizedQuery)
        const shouldFallbackToMapbox = osmSearchLooksWeak(normalizedQuery, osmSuggestions)

        if (!shouldFallbackToMapbox) {
          await writeSearchCache(normalizedQuery, { suggestions: osmSuggestions, provider: 'osm' })
          return {
            suggestions: osmSuggestions,
            provider: 'osm' as const,
            sourceProvider: 'osm' as const,
            cacheHit: false,
            budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
          }
        }

        const allowMapbox = osmSuggestions.length === 0
          ? canUseMapboxForFallback(userRole, budget)
          : canUseMapboxForWeakSearch(userRole, budget)

        if (allowMapbox) {
          const mapboxSuggestions = await safeMapboxCall(() => searchWithMapbox(normalizedQuery))
          if (mapboxSuggestions && mapboxSuggestions.length > 0) {
            await writeSearchCache(normalizedQuery, { suggestions: mapboxSuggestions, provider: 'mapbox' })
            return {
              suggestions: mapboxSuggestions,
              provider: 'mapbox' as const,
              sourceProvider: 'mapbox' as const,
              cacheHit: false,
              budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
            }
          }
        }

        await writeSearchCache(normalizedQuery, { suggestions: osmSuggestions, provider: 'osm' })
        return {
          suggestions: osmSuggestions,
          provider: 'osm' as const,
          sourceProvider: 'osm' as const,
          cacheHit: false,
          budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
        }
      } catch (error) {
        console.warn('[location][search] osm failed', {
          query: normalizedQuery,
          error: error instanceof Error ? error.message : error,
        })
      }

      await writeSearchCache(normalizedQuery, { suggestions: [], provider: 'osm' })
      return {
        suggestions: [],
        provider: 'osm' as const,
        sourceProvider: 'osm' as const,
        cacheHit: false,
        budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
      }
    })().finally(() => {
      searchInflight.delete(cacheKey)
    })

    searchInflight.set(cacheKey, request)
    return request
  } catch {
    return {
      suggestions: [],
      provider: 'osm',
      sourceProvider: 'osm',
      cacheHit: false,
      budget: mapboxBudgetSnapshot(budget),
    }
  }
}
