import { apiFetch, readApiJson } from '@/lib/api'
import type { LocationPoint } from './types'

export interface LocationSuggestion {
  id: string
  label: string
  address: string
  location: LocationPoint
}

const reverseGeocodeCache = new Map<string, string>()
const destinationSearchCache = new Map<string, LocationSuggestion[]>()

function reverseGeocodeCacheKey(projectId: string, location: LocationPoint) {
  return `${projectId}:${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`
}

function destinationSearchCacheKey(projectId: string, query: string) {
  return `${projectId}:${query.trim().toLowerCase()}`
}

export function getCurrentDeviceLocation() {
  return new Promise<LocationPoint>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location services are not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      error => {
        reject(new Error(error.message || 'Location permission is required to continue.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    )
  })
}

export async function reverseGeocode(projectId: string, location: LocationPoint) {
  const cacheKey = reverseGeocodeCacheKey(projectId, location)
  const cachedAddress = reverseGeocodeCache.get(cacheKey)
  if (cachedAddress) {
    return cachedAddress
  }

  const params = new URLSearchParams({
    projectId,
    lat: String(location.latitude),
    lng: String(location.longitude),
  })
  const response = await apiFetch(`/location/reverse?${params.toString()}`)
  const payload = await readApiJson<{ address: string }>(response)
  const address = payload.address?.trim() || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
  reverseGeocodeCache.set(cacheKey, address)
  return address
}

export async function searchDestinationSuggestions(projectId: string, query: string) {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 3) {
    return [] as LocationSuggestion[]
  }

  const cacheKey = destinationSearchCacheKey(projectId, trimmedQuery)
  const cachedSuggestions = destinationSearchCache.get(cacheKey)
  if (cachedSuggestions) {
    return cachedSuggestions
  }

  const params = new URLSearchParams({
    projectId,
    q: trimmedQuery,
  })
  const response = await apiFetch(`/location/search?${params.toString()}`)
  const payload = await readApiJson<{ suggestions: LocationSuggestion[] }>(response)
  const suggestions = payload.suggestions ?? []
  destinationSearchCache.set(cacheKey, suggestions)
  return suggestions
}
