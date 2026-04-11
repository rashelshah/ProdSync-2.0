import { getCacheJson, setCacheJson } from '../../services/cache.service'
import {
  getMapboxBudgetState,
  getMapProvider,
  hasMapboxToken,
  incrementMapboxUsage,
  mapboxBudgetSnapshot,
} from '../../services/location.service'
import { getMapboxToken, safeMapboxCall, type MapProviderRole } from '../../services/mapboxUsageService'
import { env } from '../../utils/env'

export type DirectionsProvider = 'mapbox' | 'straight_line'

export interface DirectionsPoint {
  latitude: number
  longitude: number
}

export interface DirectionsResult {
  provider: DirectionsProvider
  coordinates: Array<[number, number]>
  distanceKm: number | null
  durationMinutes: number | null
  cacheHit: boolean
  fallback: boolean
  budget: ReturnType<typeof mapboxBudgetSnapshot>
}

const DIRECTIONS_CACHE_TTL_SECONDS = 24 * 60 * 60
const REQUEST_TIMEOUT_MS = 8_000

function normalizePoint(point: DirectionsPoint) {
  return {
    latitude: Number(point.latitude.toFixed(5)),
    longitude: Number(point.longitude.toFixed(5)),
  }
}

function directionsCacheKey(from: DirectionsPoint, to: DirectionsPoint, provider: string) {
  const normalizedFrom = normalizePoint(from)
  const normalizedTo = normalizePoint(to)
  return `map:directions:${provider}:${normalizedFrom.latitude}:${normalizedFrom.longitude}:${normalizedTo.latitude}:${normalizedTo.longitude}`
}

function straightLineCoordinates(from: DirectionsPoint, to: DirectionsPoint) {
  return [
    [from.longitude, from.latitude],
    [to.longitude, to.latitude],
  ] as Array<[number, number]>
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceKm(from: DirectionsPoint, to: DirectionsPoint) {
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const latitudeA = toRadians(from.latitude)
  const latitudeB = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))).toFixed(2))
}

async function fetchMapboxDirections(from: DirectionsPoint, to: DirectionsPoint) {
  const token = getMapboxToken()
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    access_token: token,
  })
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProdSync/2.0 secure-map-proxy',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Directions provider failed with status ${response.status}`)
    }

    const payload = await response.json() as {
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: {
          coordinates?: Array<[number, number]>
        }
      }>
    }
    const route = payload.routes?.[0]
    const routeCoordinates = route?.geometry?.coordinates?.filter(
      point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]),
    ) ?? []

    if (routeCoordinates.length < 2) {
      throw new Error('Directions provider returned no usable route.')
    }

    await incrementMapboxUsage()
    return {
      coordinates: routeCoordinates,
      distanceKm: typeof route?.distance === 'number' ? Number((route.distance / 1000).toFixed(2)) : null,
      durationMinutes: typeof route?.duration === 'number' ? Number((route.duration / 60).toFixed(1)) : null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function getSecureMapRuntimeConfig(userRole: MapProviderRole) {
  const budget = await getMapboxBudgetState()
  const provider = getMapProvider(userRole, budget)

  return {
    provider,
    fallback: provider !== 'mapbox',
    mapboxAvailable: provider === 'mapbox',
    styleUrlConfigured: Boolean(env.mapboxStyleUrl),
    budget: mapboxBudgetSnapshot(budget),
  }
}

export async function getSecureDirections(from: DirectionsPoint, to: DirectionsPoint, userRole: MapProviderRole): Promise<DirectionsResult> {
  const budget = await getMapboxBudgetState()
  const provider = getMapProvider(userRole, budget)
  const canUseMapbox = provider === 'mapbox' && hasMapboxToken()
  const selectedProvider: DirectionsProvider = canUseMapbox ? 'mapbox' : 'straight_line'
  const cacheKey = directionsCacheKey(from, to, selectedProvider)
  const cached = await getCacheJson<Omit<DirectionsResult, 'cacheHit' | 'budget'>>(cacheKey)

  if (cached) {
    return {
      ...cached,
      cacheHit: true,
      budget: mapboxBudgetSnapshot(budget),
    }
  }

  if (canUseMapbox) {
    const mapboxRoute = await safeMapboxCall(() => fetchMapboxDirections(from, to))
    if (mapboxRoute) {
      const result = {
        provider: 'mapbox' as const,
        coordinates: mapboxRoute.coordinates,
        distanceKm: mapboxRoute.distanceKm,
        durationMinutes: mapboxRoute.durationMinutes,
        fallback: false,
      }
      await setCacheJson(cacheKey, result, DIRECTIONS_CACHE_TTL_SECONDS)

      return {
        ...result,
        cacheHit: false,
        budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
      }
    }
  }

  const fallbackDistanceKm = distanceKm(from, to)
  const fallback = {
    provider: 'straight_line' as const,
    coordinates: straightLineCoordinates(from, to),
    distanceKm: fallbackDistanceKm,
    durationMinutes: null,
    fallback: true,
  }

  await setCacheJson(directionsCacheKey(from, to, 'straight_line'), fallback, DIRECTIONS_CACHE_TTL_SECONDS)

  return {
    ...fallback,
    cacheHit: false,
    budget: mapboxBudgetSnapshot(await getMapboxBudgetState()),
  }
}
