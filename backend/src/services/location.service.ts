import type { Request } from 'express'
import { getCacheJson, getCacheString, incrementCacheCounter, setCacheJson } from './cache.service'
import type { LocationReverseGeocodeQuery, LocationSearchQuery } from '../models/transport.schemas'
import type { LocationPoint } from '../models/transport.types'
import { env } from '../utils/env'
import { getTransportAccessRoles } from '../utils/role'

export type LocationAudience = 'admin' | 'driver' | 'member'
export type LocationProvider = 'mapbox' | 'osm' | 'cache'

interface LocationCachePayload {
  address: string
  provider: Exclude<LocationProvider, 'cache'>
}

export interface LocationSuggestionRecord {
  id: string
  label: string
  address: string
  location: LocationPoint
}

interface LocationSearchCachePayload {
  suggestions: LocationSuggestionRecord[]
  provider: Exclude<LocationProvider, 'cache'>
}

export interface MapboxBudgetState {
  dailyCount: number
  monthlyCount: number
  dailyRatio: number
  monthlyRatio: number
  mode: 'healthy' | 'restricted' | 'disabled'
  enabled: boolean
}

const GEO_CACHE_TTL_SECONDS = 24 * 60 * 60
const REQUEST_TIMEOUT_MS = 8_000
const OSM_THROTTLE_MS = 1_000
const MAPBOX_REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse'
const MAPBOX_FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const OSM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const OSM_FORWARD_URL = 'https://nominatim.openstreetmap.org/search'

const reverseInflight = new Map<string, Promise<{ address: string; provider: LocationProvider; cacheHit: boolean; budget: MapboxBudgetState }>>()
const searchInflight = new Map<string, Promise<{ suggestions: LocationSuggestionRecord[]; provider: LocationProvider; cacheHit: boolean; budget: MapboxBudgetState }>>()

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

function normalizeAddress(value: string | null | undefined, fallback: string) {
  const next = value?.trim()
  return next || fallback
}

function roundCoordinate(value: number) {
  return value.toFixed(4)
}

function coordinateFallback(location: { latitude: number; longitude: number }) {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

function reverseCacheKey(location: { latitude: number; longitude: number }) {
  return `geo:${roundCoordinate(location.latitude)}:${roundCoordinate(location.longitude)}`
}

function searchCacheKey(query: string) {
  return `search:${query.trim().toLowerCase()}`
}

function dailyUsageKey() {
  return `mapbox:usage:daily:${new Date().toISOString().slice(0, 10)}`
}

function monthlyUsageKey() {
  return `mapbox:usage:monthly:${new Date().toISOString().slice(0, 7)}`
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

export async function getMapboxBudgetState(): Promise<MapboxBudgetState> {
  if (!env.mapboxAccessToken) {
    return {
      dailyCount: 0,
      monthlyCount: 0,
      dailyRatio: 1,
      monthlyRatio: 1,
      mode: 'disabled',
      enabled: false,
    }
  }

  const [dailyRaw, monthlyRaw] = await Promise.all([
    getCacheString(dailyUsageKey()),
    getCacheString(monthlyUsageKey()),
  ])

  const dailyCount = Number(dailyRaw ?? 0)
  const monthlyCount = Number(monthlyRaw ?? 0)
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
  await Promise.all([
    incrementCacheCounter(dailyUsageKey(), secondsUntilEndOfDay()),
    incrementCacheCounter(monthlyUsageKey(), secondsUntilEndOfMonth()),
  ])
}

export function providerOrder(audience: LocationAudience, budget: MapboxBudgetState): Array<Exclude<LocationProvider, 'cache'>> {
  if (!env.mapboxAccessToken || budget.mode === 'disabled') {
    return ['osm']
  }

  if (budget.mode === 'restricted') {
    return audience === 'admin' ? ['mapbox', 'osm'] : ['osm']
  }

  return audience === 'admin' ? ['mapbox', 'osm'] : ['osm', 'mapbox']
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

async function reverseWithMapbox(location: { latitude: number; longitude: number }) {
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

async function reverseWithOsm(location: { latitude: number; longitude: number }) {
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

    const label = normalizeAddress(item.display_name ?? item.name, 'Unnamed location')
    accumulator.push({
      id: String(item.place_id ?? `${label}-${latitude}-${longitude}-${index}`),
      label,
      address: label,
      location: {
        latitude,
        longitude,
        address: label,
      },
    })
    return accumulator
  }, [])
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

export function getLocationAudience(req: Pick<Request, 'authUser' | 'projectAccess'>): LocationAudience {
  const roles = getTransportAccessRoles(req as Request)
  if (req.projectAccess?.isOwner || roles.has('LINE_PRODUCER') || roles.has('TRANSPORT_CAPTAIN')) {
    return 'admin'
  }

  if (roles.has('DRIVER') || req.authUser?.role === 'DRIVER' || req.authUser?.projectRoleTitle === 'Driver') {
    return 'driver'
  }

  return 'member'
}

export async function reverseGeocodeLocation(query: LocationReverseGeocodeQuery, audience: LocationAudience) {
  const budget = await getMapboxBudgetState()
  const cacheKey = reverseCacheKey({
    latitude: query.latitude,
    longitude: query.longitude,
  })
  const cached = await getCacheJson<LocationCachePayload>(cacheKey)

  if (cached?.address) {
    return {
      address: cached.address,
      provider: 'cache' as const,
      sourceProvider: cached.provider,
      cacheHit: true,
      budget: mapboxBudgetSnapshot(budget),
    }
  }

  const inflight = reverseInflight.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = (async () => {
    const location = {
      latitude: query.latitude,
      longitude: query.longitude,
    }

    for (const provider of providerOrder(audience, budget)) {
      try {
        const address = provider === 'mapbox'
          ? await reverseWithMapbox(location)
          : await reverseWithOsm(location)

        await setCacheJson(cacheKey, {
          address,
          provider,
        } satisfies LocationCachePayload, GEO_CACHE_TTL_SECONDS)

        return {
          address,
          provider,
          sourceProvider: provider,
          cacheHit: false,
          budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
        }
      } catch (error) {
        console.warn('[location][reverse] provider failed', {
          provider,
          latitude: query.latitude,
          longitude: query.longitude,
          error: error instanceof Error ? error.message : error,
        })
      }
    }

    return {
      address: 'Location unavailable',
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
}

export async function searchLocationSuggestions(query: LocationSearchQuery, audience: LocationAudience) {
  const normalizedQuery = query.query.trim()
  const budget = await getMapboxBudgetState()
  if (normalizedQuery.length < 2) {
    return {
      suggestions: [] as LocationSuggestionRecord[],
      provider: 'cache' as const,
      sourceProvider: 'osm' as const,
      cacheHit: false,
      budget: mapboxBudgetSnapshot(budget),
    }
  }

  const cacheKey = searchCacheKey(normalizedQuery)
  const cached = await getCacheJson<LocationSearchCachePayload>(cacheKey)
  if (cached) {
    return {
      suggestions: cached.suggestions,
      provider: 'cache' as const,
      sourceProvider: cached.provider,
      cacheHit: true,
      budget: mapboxBudgetSnapshot(budget),
    }
  }

  const inflight = searchInflight.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = (async () => {
    for (const provider of providerOrder(audience, budget)) {
      try {
        const suggestions = provider === 'mapbox'
          ? await searchWithMapbox(normalizedQuery)
          : await searchWithOsm(normalizedQuery)

        await setCacheJson(cacheKey, {
          suggestions,
          provider,
        } satisfies LocationSearchCachePayload, GEO_CACHE_TTL_SECONDS)

        return {
          suggestions,
          provider,
          sourceProvider: provider,
          cacheHit: false,
          budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
        }
      } catch (error) {
        console.warn('[location][search] provider failed', {
          provider,
          query: normalizedQuery,
          error: error instanceof Error ? error.message : error,
        })
      }
    }

    return {
      suggestions: [] as LocationSuggestionRecord[],
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
}
