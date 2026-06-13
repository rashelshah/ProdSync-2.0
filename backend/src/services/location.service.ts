import type { Request } from 'express'
import type { LocationReverseGeocodeQuery, LocationResolveQuery, LocationSearchQuery } from '../models/transport.schemas'
import { HttpError } from '../utils/httpError'
import { getTransportAccessRoles } from '../utils/role'
import {
  forwardGeocode,
  getMapProvider,
  getMapboxBudgetState,
  hasMapboxToken,
  incrementMapboxUsage,
  mapboxBudgetSnapshot,
  providerOrder,
  reverseGeocode,
  type LocationSuggestionRecord,
  type MapboxBudgetState,
  type MapProviderRole,
} from './locationService'

export type LocationAudience = 'admin' | 'driver' | 'member'
export type LocationProvider = 'mapbox' | 'osm' | 'cache'

export { getMapProvider, getMapboxBudgetState, hasMapboxToken, incrementMapboxUsage, mapboxBudgetSnapshot, providerOrder }
export type { LocationSuggestionRecord, MapboxBudgetState }

type ResolvedLocationInput = {
  projectId: string
  input: string
  address: string
  latitude: number | null
  longitude: number | null
  source: 'coordinates' | 'address' | 'search' | 'url'
  resolvedUrl: string | null
}

const resolvedLocationCache = new Map<string, { expiresAt: number; value: ResolvedLocationInput }>()

function normalizeResolveKey(projectId: string, input: string) {
  return `${projectId}:${input.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

function parseCoordinates(value: string) {
  const directMatch = value.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/)
  if (directMatch) {
    const latitude = Number(directMatch[1])
    const longitude = Number(directMatch[2])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  const atMatch = value.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
  if (atMatch) {
    const latitude = Number(atMatch[1])
    const longitude = Number(atMatch[2])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  const googleLatLng = value.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
  if (googleLatLng) {
    const latitude = Number(googleLatLng[1])
    const longitude = Number(googleLatLng[2])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  return null
}

function candidateUrl(rawInput: string) {
  const trimmed = rawInput.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|google\.com\/maps|mapbox\.com)/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

function extractSearchText(url: URL) {
  const queryCandidates = [
    url.searchParams.get('q'),
    url.searchParams.get('query'),
    url.searchParams.get('destination'),
    url.searchParams.get('daddr'),
    url.searchParams.get('address'),
    url.searchParams.get('ll'),
    url.searchParams.get('place'),
  ].filter((value): value is string => Boolean(value && value.trim()))

  if (queryCandidates.length > 0) {
    return queryCandidates[0].trim()
  }

  const placeMatch = url.pathname.match(/\/place\/([^/]+)/i)
  if (placeMatch?.[1]) {
    return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim()
  }

  return null
}

async function followRedirects(url: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })
    return response.url || url
  } catch {
    return url
  } finally {
    clearTimeout(timeoutId)
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

export function getLocationProviderRole(req: Pick<Request, 'authUser' | 'projectAccess'>): MapProviderRole {
  const roles = getTransportAccessRoles(req as Request)

  if (req.projectAccess?.isOwner || req.authUser?.role === 'EP') {
    return 'ADMIN'
  }

  if (roles.has('LINE_PRODUCER')) {
    return 'PRODUCER'
  }

  if (roles.has('TRANSPORT_CAPTAIN')) {
    return 'CAPTAIN'
  }

  if (roles.has('DRIVER') || req.authUser?.role === 'DRIVER' || req.authUser?.projectRoleTitle === 'Driver') {
    return 'DRIVER'
  }

  return 'MEMBER'
}

export async function reverseGeocodeLocation(query: LocationReverseGeocodeQuery, userRole: MapProviderRole) {
  return reverseGeocode(query.latitude, query.longitude, userRole)
}

export async function searchLocationSuggestions(query: LocationSearchQuery, userRole: MapProviderRole) {
  return forwardGeocode(query.query, userRole === 'ADMIN' || userRole === 'PRODUCER' ? 'MEMBER' : userRole)
}

export async function resolveLocationInput(query: LocationResolveQuery, userRole: MapProviderRole): Promise<ResolvedLocationInput> {
  const normalizedInput = query.input.trim()
  if (!normalizedInput) {
    throw new HttpError(400, 'Paste a Google Maps link, coordinates, or an address to resolve the location.')
  }

  const cacheKey = normalizeResolveKey(query.projectId, normalizedInput)
  const cached = resolvedLocationCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const directCoordinates = parseCoordinates(normalizedInput)
  if (directCoordinates) {
    const addressResult = await reverseGeocodeLocation({
      projectId: query.projectId,
      latitude: directCoordinates.latitude,
      longitude: directCoordinates.longitude,
    }, userRole)

    const resolved = {
      projectId: query.projectId,
      input: normalizedInput,
      address: addressResult.address || 'Location unavailable',
      latitude: directCoordinates.latitude,
      longitude: directCoordinates.longitude,
      source: 'coordinates' as const,
      resolvedUrl: null,
    }
    resolvedLocationCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, value: resolved })
    return resolved
  }

  const urlCandidate = candidateUrl(normalizedInput)
  if (urlCandidate) {
    const resolvedUrl = await followRedirects(urlCandidate)
    const resolvedUrlObject = new URL(resolvedUrl)
    const urlCoordinates = parseCoordinates(`${resolvedUrlObject.href} ${resolvedUrlObject.pathname} ${resolvedUrlObject.search}`)

    if (urlCoordinates) {
      const addressResult = await reverseGeocodeLocation({
        projectId: query.projectId,
        latitude: urlCoordinates.latitude,
        longitude: urlCoordinates.longitude,
      }, userRole)

      const resolved = {
        projectId: query.projectId,
        input: normalizedInput,
        address: addressResult.address || 'Location unavailable',
        latitude: urlCoordinates.latitude,
        longitude: urlCoordinates.longitude,
        source: 'url' as const,
        resolvedUrl,
      }
      resolvedLocationCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, value: resolved })
      return resolved
    }

    const searchText = extractSearchText(resolvedUrlObject)
    if (searchText) {
      const searchResult = await searchLocationSuggestions({
        projectId: query.projectId,
        query: searchText,
      }, userRole)

      const suggestion = searchResult.suggestions?.[0]
      if (suggestion?.location.latitude != null && suggestion?.location.longitude != null) {
        const resolved = {
          projectId: query.projectId,
          input: normalizedInput,
          address: suggestion.label || suggestion.address || searchText,
          latitude: suggestion.location.latitude,
          longitude: suggestion.location.longitude,
          source: 'search' as const,
          resolvedUrl,
        }
        resolvedLocationCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, value: resolved })
        return resolved
      }
    }
  }

  const searchResult = await searchLocationSuggestions({
    projectId: query.projectId,
    query: normalizedInput,
  }, userRole)

  const suggestion = searchResult.suggestions?.[0]
  if (suggestion?.location.latitude != null && suggestion?.location.longitude != null) {
    const resolved = {
      projectId: query.projectId,
      input: normalizedInput,
      address: suggestion.label || suggestion.address || normalizedInput,
      latitude: suggestion.location.latitude,
      longitude: suggestion.location.longitude,
      source: 'address' as const,
      resolvedUrl: null,
    }
    resolvedLocationCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, value: resolved })
    return resolved
  }

  throw new HttpError(400, 'Unsupported location input. Paste a Google Maps link, Mapbox URL, coordinates, or a readable address.')
}
