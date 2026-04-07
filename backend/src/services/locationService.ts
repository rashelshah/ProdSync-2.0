import type { LocationPoint } from '../models/transport.types'
import { env } from '../utils/env'
import { getCacheJson, getCacheString, incrementCacheCounter, setCacheJson } from './cache.service'

export type GeocodeProvider = 'cache' | 'osm' | 'mapbox'

export interface LocationSuggestionRecord {
  id: string
  label: string
  address: string
  location: LocationPoint
}

export interface MapboxBudgetState {
  dailyCount: number
  monthlyCount: number
  dailyRatio: number
  monthlyRatio: number
  mode: 'healthy' | 'restricted' | 'disabled'
  enabled: boolean
}

export interface ReverseGeocodeResult {
  address: string
  provider: GeocodeProvider
  sourceProvider: Exclude<GeocodeProvider, 'cache'>
  cacheHit: boolean
  budget: ReturnType<typeof mapboxBudgetSnapshot>
}

export interface ForwardGeocodeResult {
  suggestions: LocationSuggestionRecord[]
  provider: GeocodeProvider
  sourceProvider: Exclude<GeocodeProvider, 'cache'>
  cacheHit: boolean
  budget: ReturnType<typeof mapboxBudgetSnapshot>
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
const MAPBOX_REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse'
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

function dailyUsageKey() {
  return `mapbox:daily_count:${new Date().toISOString().slice(0, 10)}`
}

function monthlyUsageKey() {
  return `mapbox:monthly_count:${new Date().toISOString().slice(0, 7)}`
}

function secondsUntilEndOfDay() {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000))
}

function secondsUntilEndOfMonth() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000))
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

function hasMapboxToken() {
  return env.mapboxAccessToken.trim().length > 0
}

export async function getMapboxBudgetState(): Promise<MapboxBudgetState> {
  if (!hasMapboxToken()) {
    return {
      dailyCount: 0,
      monthlyCount: 0,
      dailyRatio: 1,
      monthlyRatio: 1,
      mode: 'disabled',
      enabled: false,
    }
  }

  const [dailyResult, monthlyResult] = await Promise.allSettled([
    getCacheString(dailyUsageKey()),
    getCacheString(monthlyUsageKey()),
  ])

  const dailyCount = Number(dailyResult.status === 'fulfilled' ? (dailyResult.value ?? 0) : 0)
  const monthlyCount = Number(monthlyResult.status === 'fulfilled' ? (monthlyResult.value ?? 0) : 0)
  const dailyRatio = dailyCount / env.mapboxDailyLimit
  const monthlyRatio = monthlyCount / env.mapboxMonthlyLimit
  const highestRatio = Math.max(dailyRatio, monthlyRatio)

  return {
    dailyCount,
    monthlyCount,
    dailyRatio,
    monthlyRatio,
    mode: highestRatio > 0.9 ? 'disabled' : highestRatio >= 0.7 ? 'restricted' : 'healthy',
    enabled: highestRatio <= 0.9,
  }
}

export async function incrementMapboxUsage() {
  await Promise.allSettled([
    incrementCacheCounter(dailyUsageKey(), secondsUntilEndOfDay()),
    incrementCacheCounter(monthlyUsageKey(), secondsUntilEndOfMonth()),
  ])
}

export function mapboxBudgetSnapshot(budget: MapboxBudgetState) {
  return {
    dailyCount: budget.dailyCount,
    monthlyCount: budget.monthlyCount,
    dailyRatio: Number(budget.dailyRatio.toFixed(4)),
    monthlyRatio: Number(budget.monthlyRatio.toFixed(4)),
    mode: budget.mode,
    enabled: budget.enabled,
  }
}

function canUseMapboxForFallback(budget: MapboxBudgetState) {
  return hasMapboxToken() && budget.mode !== 'disabled'
}

function canUseMapboxForWeakSearch(budget: MapboxBudgetState) {
  return hasMapboxToken() && budget.mode === 'healthy'
}

export function providerOrder(_audience: 'admin' | 'driver' | 'member', budget: MapboxBudgetState): Array<Exclude<GeocodeProvider, 'cache'>> {
  if (!hasMapboxToken() || budget.mode === 'disabled') {
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

async function reverseWithMapbox(location: NormalizedLocation) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    access_token: env.mapboxAccessToken,
    limit: '1',
  })

  const payload = await fetchJson<{
    features?: Array<{
      properties?: Record<string, unknown>
      place_name?: string
      name_preferred?: string
      text?: string
    }>
  }>(`${MAPBOX_REVERSE_URL}?${params.toString()}`)

  const feature = payload.features?.[0]
  if (!feature) {
    throw new Error('Mapbox returned no reverse geocoding result.')
  }

  const properties = feature.properties ?? {}
  const address = normalizeAddress(
    typeof properties.full_address === 'string'
      ? properties.full_address
      : typeof properties.place_formatted === 'string'
        ? properties.place_formatted
        : typeof feature.place_name === 'string'
          ? feature.place_name
          : typeof feature.name_preferred === 'string'
            ? feature.name_preferred
            : typeof feature.text === 'string'
              ? feature.text
              : null,
    coordinateFallback(location),
  )

  await incrementMapboxUsage()
  return address
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
  const params = new URLSearchParams({
    q: query,
    access_token: env.mapboxAccessToken,
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

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
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

      if (canUseMapboxForFallback(budget)) {
        try {
          const address = await reverseWithMapbox(location)
          await writeReverseCache(location, { address, provider: 'mapbox' })
          return {
            address,
            provider: 'mapbox' as const,
            sourceProvider: 'mapbox' as const,
            cacheHit: false,
            budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
          }
        } catch (error) {
          console.warn('[location][reverse] mapbox fallback failed', {
            latitude: location.latitude,
            longitude: location.longitude,
            error: error instanceof Error ? error.message : error,
          })
        }
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

export async function forwardGeocode(query: string | null | undefined): Promise<ForwardGeocodeResult> {
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
          ? canUseMapboxForFallback(budget)
          : canUseMapboxForWeakSearch(budget)

        if (allowMapbox) {
          try {
            const mapboxSuggestions = await searchWithMapbox(normalizedQuery)
            if (mapboxSuggestions.length > 0) {
              await writeSearchCache(normalizedQuery, { suggestions: mapboxSuggestions, provider: 'mapbox' })
              return {
                suggestions: mapboxSuggestions,
                provider: 'mapbox' as const,
                sourceProvider: 'mapbox' as const,
                cacheHit: false,
                budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
              }
            }
          } catch (error) {
            console.warn('[location][search] mapbox fallback failed', {
              query: normalizedQuery,
              error: error instanceof Error ? error.message : error,
            })
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

      if (canUseMapboxForFallback(budget)) {
        try {
          const mapboxSuggestions = await searchWithMapbox(normalizedQuery)
          await writeSearchCache(normalizedQuery, { suggestions: mapboxSuggestions, provider: 'mapbox' })
          return {
            suggestions: mapboxSuggestions,
            provider: 'mapbox' as const,
            sourceProvider: 'mapbox' as const,
            cacheHit: false,
            budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
          }
        } catch (error) {
          console.warn('[location][search] mapbox fallback failed after osm error', {
            query: normalizedQuery,
            error: error instanceof Error ? error.message : error,
          })
        }
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
