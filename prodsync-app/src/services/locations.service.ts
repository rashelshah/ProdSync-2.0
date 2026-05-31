import { apiFetch, readApiJson } from '@/lib/api'
import { MAP_CONFIG } from '@/config/map.config'
import type { LocationPoint } from '@/modules/transport/types'
import type {
  CreateLocationCommentInput,
  CreateLocationCostInput,
  CreateLocationInput,
  CreateLocationPermissionInput,
  CreateLocationTimelineInput,
  LocationDashboardRecord,
  LocationDetailRecord,
  LocationDocumentRecord,
  LocationListFilters,
  LocationMediaRecord,
  LocationPermissionRecord,
  LocationReportsRecord,
  LocationRecord,
  LocationSearchSuggestion,
  LocationTimelineRecord,
  NearbyAmenitySuggestion,
  PaginatedLocationDocuments,
  PaginatedLocationMedia,
  PaginatedLocations,
  UpdateLocationCostInput,
  UpdateLocationInput,
  UpsertLocationAmenityInput,
} from '@/modules/locations/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

function toQueryString(projectId: string, filters?: LocationListFilters) {
  const params = new URLSearchParams({ projectId })
  if (filters?.search) params.set('search', filters.search)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel)
  if (filters?.locationType) params.set('locationType', filters.locationType)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  return params.toString()
}

function buildUploadFormData(
  input: Record<string, string | number | boolean | null | undefined>,
  file: File,
) {
  const formData = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, String(value))
  })
  formData.append('file', file)
  return formData
}

type SearchResponseItem = {
  name?: string
  lat?: number | null
  lng?: number | null
}

type MapboxSearchBoxFeature = {
  id?: string
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    name?: string
    name_preferred?: string
    full_address?: string
    place_formatted?: string
    address?: string
    poi_category_ids?: string[]
    feature_type?: string
    phone?: string
    phone_number?: string
    metadata?: Record<string, unknown>
  }
}

const locationSearchCache = new Map<string, LocationSearchSuggestion[]>()
const reverseGeocodeCache = new Map<string, string>()
const nearbyAmenitiesCache = new Map<string, NearbyAmenitySuggestion[]>()
const inflightLocationSearches = new Map<string, Promise<LocationSearchSuggestion[]>>()
const inflightReverseLookups = new Map<string, Promise<string>>()
const inflightNearbyLookups = new Map<string, Promise<NearbyAmenitySuggestion[]>>()

function normalizeCoordinate(value: number) {
  return Number(value.toFixed(5))
}

function coordinateCacheKey(projectId: string, latitude: number, longitude: number) {
  return `${projectId}:${normalizeCoordinate(latitude)}:${normalizeCoordinate(longitude)}`
}

function getLocationSearchKey(projectId: string, query: string) {
  return `${projectId}:${query.trim().toLowerCase()}`
}

function getNearbySearchKey(projectId: string, location: LocationPoint) {
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return null
  }

  return coordinateCacheKey(projectId, location.latitude, location.longitude)
}

function getDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6_371
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180
  const deltaLng = (to.longitude - from.longitude) * Math.PI / 180
  const lat1 = from.latitude * Math.PI / 180
  const lat2 = to.latitude * Math.PI / 180
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeMapboxText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function parseLocationSearchPayload(payload: SearchResponseItem[] | { suggestions?: LocationSearchSuggestion[] }) {
  if (Array.isArray(payload)) {
    return payload
      .filter(item => typeof item.lat === 'number' && typeof item.lng === 'number')
      .map((item, index) => {
        const label = normalizeMapboxText(item.name, 'Location suggestion')
        return {
          id: `${label}-${item.lat}-${item.lng}-${index}`,
          label,
          address: label,
          latitude: Number(item.lat),
          longitude: Number(item.lng),
          source: 'backend' as const,
          meta: { cacheHit: false },
        }
      })
  }

  return payload.suggestions ?? []
}

function buildMapboxSearchUrl(query: string, location: LocationPoint) {
  const params = new URLSearchParams({
    q: query,
    limit: '5',
    auto_complete: 'true',
    access_token: MAP_CONFIG.publicToken,
  })

  if (typeof location.longitude === 'number' && typeof location.latitude === 'number') {
    params.set('proximity', `${location.longitude},${location.latitude}`)
  }

  return `https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`
}

function parseMapboxSearchFeature(feature: MapboxSearchBoxFeature) {
  const coordinates = feature.geometry?.coordinates
  if (!coordinates || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return null
  }

  const properties = feature.properties ?? {}
  const label = normalizeMapboxText(
    properties.name_preferred ?? properties.name ?? properties.full_address ?? properties.place_formatted ?? properties.address,
    'Nearby place',
  )

  return {
    id: String(feature.id ?? `${label}-${coordinates[1]}-${coordinates[0]}`),
    label,
    address: normalizeMapboxText(
      properties.full_address ?? properties.place_formatted ?? properties.address ?? label,
      label,
    ),
    latitude: coordinates[1],
    longitude: coordinates[0],
    source: 'mapbox' as const,
    meta: {
      featureType: properties.feature_type,
      poiCategories: properties.poi_category_ids,
    },
  }
}

async function fetchMapboxNearbySuggestions(query: string, location: LocationPoint, signal?: AbortSignal) {
  if (!MAP_CONFIG.publicToken) {
    return [] as LocationSearchSuggestion[]
  }

  const response = await fetch(buildMapboxSearchUrl(query, location), { signal })
  if (!response.ok) {
    throw new Error(`Mapbox search failed with status ${response.status}`)
  }

  const payload = await response.json() as { features?: MapboxSearchBoxFeature[] }
  return (payload.features ?? [])
    .map(parseMapboxSearchFeature)
    .filter((item): item is NonNullable<ReturnType<typeof parseMapboxSearchFeature>> => Boolean(item))
}

function detectAmenityLabel(amenityType: NearbyAmenitySuggestion['amenityType']) {
  switch (amenityType) {
    case 'hospital':
      return 'hospital'
    case 'police_station':
      return 'police station'
    case 'petrol_bunk':
      return 'petrol pump'
    default:
      return 'nearby place'
  }
}

function toAmenitySuggestion(
  amenityType: NearbyAmenitySuggestion['amenityType'],
  item: LocationSearchSuggestion,
  origin: LocationPoint & { latitude: number; longitude: number },
) {
  const distanceKm = getDistanceKm(origin, { latitude: item.latitude, longitude: item.longitude })
  return {
    id: `${amenityType}:${item.id}`,
    amenityType,
    name: item.label,
    address: item.address,
    phoneNumber: null,
    distanceKm: Number(distanceKm.toFixed(2)),
    latitude: item.latitude,
    longitude: item.longitude,
    mapLink: `https://www.google.com/maps?q=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`,
    source: 'mapbox' as const,
    metadata: item.meta,
  }
}

export const locationsService = {
  async getLocations(projectId: string, filters?: LocationListFilters): Promise<PaginatedLocations> {
    const response = await apiFetch(`/locations?${toQueryString(projectId, filters)}`)
    return readApiJson<PaginatedLocations>(response)
  },

  async getLocation(projectId: string, id: string): Promise<LocationDetailRecord> {
    const response = await apiFetch(`/locations/${encodeURIComponent(id)}?${withProjectId(projectId)}`)
    return readApiJson<LocationDetailRecord>(response)
  },

  async createLocation(input: CreateLocationInput): Promise<LocationDetailRecord> {
    const response = await apiFetch('/locations', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return readApiJson<LocationDetailRecord>(response)
  },

  async updateLocation(id: string, input: UpdateLocationInput): Promise<LocationDetailRecord> {
    const response = await apiFetch(`/locations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return readApiJson<LocationDetailRecord>(response)
  },

  async deleteLocation(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/locations/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getDashboard(projectId: string): Promise<LocationDashboardRecord> {
    const response = await apiFetch(`/locations/dashboard?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ dashboard: LocationDashboardRecord }>(response)
    return payload.dashboard
  },

  async getReports(projectId: string): Promise<LocationReportsRecord> {
    const response = await apiFetch(`/locations/reports?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ reports: LocationReportsRecord }>(response)
    return payload.reports
  },

  async getMedia(projectId: string, locationId: string, page = 1, pageSize = 18): Promise<PaginatedLocationMedia> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/media?${withProjectId(projectId)}&page=${page}&pageSize=${pageSize}`)
    return readApiJson<PaginatedLocationMedia>(response)
  },

  async uploadMedia(locationId: string, input: { projectId: string; notes?: string; latitude?: number; longitude?: number; uploadTime?: string }, file: File): Promise<LocationMediaRecord> {
    const formData = buildUploadFormData(input, file)
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/media`, {
      method: 'POST',
      body: formData,
    })
    const payload = await readApiJson<{ media: LocationMediaRecord }>(response)
    return payload.media
  },

  async deleteMedia(projectId: string, locationId: string, mediaId: string): Promise<void> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/media/${encodeURIComponent(mediaId)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getDocuments(projectId: string, locationId: string, page = 1, pageSize = 18): Promise<PaginatedLocationDocuments> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/documents?${withProjectId(projectId)}&page=${page}&pageSize=${pageSize}`)
    return readApiJson<PaginatedLocationDocuments>(response)
  },

  async uploadDocument(locationId: string, input: { projectId: string; category: string; permissionId?: string; notes?: string }, file: File): Promise<LocationDocumentRecord> {
    const formData = buildUploadFormData(input, file)
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/documents`, {
      method: 'POST',
      body: formData,
    })
    const payload = await readApiJson<{ document: LocationDocumentRecord }>(response)
    return payload.document
  },

  async deleteDocument(projectId: string, locationId: string, documentId: string): Promise<void> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/documents/${encodeURIComponent(documentId)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getPermissions(projectId: string, locationId: string): Promise<LocationPermissionRecord[]> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/permissions?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ permissions: LocationPermissionRecord[] }>(response)
    return payload.permissions ?? []
  },

  async createPermission(locationId: string, input: CreateLocationPermissionInput): Promise<LocationPermissionRecord> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/permissions`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ permission: LocationPermissionRecord }>(response)
    return payload.permission
  },

  async updatePermission(locationId: string, permissionId: string, input: Partial<CreateLocationPermissionInput> & { projectId: string }): Promise<LocationPermissionRecord> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/permissions/${encodeURIComponent(permissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ permission: LocationPermissionRecord }>(response)
    return payload.permission
  },

  async deletePermission(projectId: string, locationId: string, permissionId: string): Promise<void> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/permissions/${encodeURIComponent(permissionId)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getAmenities(projectId: string, locationId: string) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/amenities?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ amenities: LocationDetailRecord['amenities'] }>(response)
    return payload.amenities ?? []
  },

  async upsertAmenity(locationId: string, input: UpsertLocationAmenityInput) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/amenities`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ amenity: LocationDetailRecord['amenities'][number] }>(response)
    return payload.amenity
  },

  async getTimeline(projectId: string, locationId: string): Promise<LocationTimelineRecord[]> {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/timeline?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ timeline: LocationTimelineRecord[] }>(response)
    return payload.timeline ?? []
  },

  async createTimeline(locationId: string, input: CreateLocationTimelineInput) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/timeline`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ timelineEvent: unknown }>(response)
    return payload.timelineEvent
  },

  async getComments(projectId: string, locationId: string) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/comments?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ comments: LocationDetailRecord['comments'] }>(response)
    return payload.comments ?? []
  },

  async createComment(locationId: string, input: CreateLocationCommentInput) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ comment: unknown }>(response)
    return payload.comment
  },

  async getCosts(projectId: string, locationId: string) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/costs?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ costs: LocationDetailRecord['costs'] }>(response)
    return payload.costs ?? []
  },

  async createCost(locationId: string, input: CreateLocationCostInput) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/costs`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ cost: unknown }>(response)
    return payload.cost
  },

  async updateCost(locationId: string, costId: string, input: UpdateLocationCostInput) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/costs/${encodeURIComponent(costId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ cost: unknown }>(response)
    return payload.cost
  },

  async deleteCost(projectId: string, locationId: string, costId: string) {
    const response = await apiFetch(`/locations/${encodeURIComponent(locationId)}/costs/${encodeURIComponent(costId)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async searchLocationSuggestions(projectId: string, query: string, signal?: AbortSignal): Promise<LocationSearchSuggestion[]> {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 3) {
      return []
    }

    const cacheKey = getLocationSearchKey(projectId, trimmedQuery)
    const cached = locationSearchCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const inflight = inflightLocationSearches.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      const response = await apiFetch(`/location/search?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(trimmedQuery)}`, { signal })
      const payload = await readApiJson<SearchResponseItem[] | { suggestions?: LocationSearchSuggestion[] }>(response)
      const results = parseLocationSearchPayload(payload)
      locationSearchCache.set(cacheKey, results)
      return results
    })().finally(() => {
      inflightLocationSearches.delete(cacheKey)
    })

    inflightLocationSearches.set(cacheKey, request)
    return request
  },

  async reverseGeocodeLocation(projectId: string, latitude: number, longitude: number, signal?: AbortSignal): Promise<string> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return 'Location unavailable'
    }

    const cacheKey = coordinateCacheKey(projectId, latitude, longitude)
    const cached = reverseGeocodeCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const inflight = inflightReverseLookups.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      const params = new URLSearchParams({
        projectId,
        lat: String(latitude),
        lng: String(longitude),
      })
      const response = await apiFetch(`/location/reverse?${params.toString()}`, { signal })
      const payload = await readApiJson<{ address?: string; name?: string }>(response)
      const address = normalizeMapboxText(payload.name ?? payload.address, `${normalizeCoordinate(latitude)}, ${normalizeCoordinate(longitude)}`)
      reverseGeocodeCache.set(cacheKey, address)
      return address
    })().finally(() => {
      inflightReverseLookups.delete(cacheKey)
    })

    inflightReverseLookups.set(cacheKey, request)
    return request
  },

  async getNearbyAmenities(projectId: string, location: LocationPoint, signal?: AbortSignal): Promise<NearbyAmenitySuggestion[]> {
    const cacheKey = getNearbySearchKey(projectId, location)
    if (!cacheKey) {
      return []
    }

    const cached = nearbyAmenitiesCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const inflight = inflightNearbyLookups.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      const origin = {
        latitude: location.latitude as number,
        longitude: location.longitude as number,
      }

      const amenityQueries: Array<{ amenityType: NearbyAmenitySuggestion['amenityType']; query: string }> = [
        { amenityType: 'hospital', query: detectAmenityLabel('hospital') },
        { amenityType: 'police_station', query: detectAmenityLabel('police_station') },
        { amenityType: 'petrol_bunk', query: detectAmenityLabel('petrol_bunk') },
      ]

      const queryResults = await Promise.allSettled(
        amenityQueries.map(async ({ amenityType, query }) => {
          const results = await fetchMapboxNearbySuggestions(query, origin, signal)
          return results
            .map(item => toAmenitySuggestion(amenityType, item, origin))
            .filter(item => item.distanceKm <= 5)
            .slice(0, 5)
        }),
      )

      const amenityResults: NearbyAmenitySuggestion[] = []
      queryResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          amenityResults.push(...result.value)
          return
        }

        const amenityType = amenityQueries[index]?.amenityType
        if (amenityType) {
          console.warn('[locations][amenities] mapbox lookup failed', {
            projectId,
            amenityType,
            error: result.reason instanceof Error ? result.reason.message : result.reason,
          })
        }
      })

      const unique = Array.from(
        new Map(amenityResults.map(item => [item.id, item])).values(),
      ).sort((left, right) => left.distanceKm - right.distanceKm)

      nearbyAmenitiesCache.set(cacheKey, unique)
      return unique
    })().finally(() => {
      inflightNearbyLookups.delete(cacheKey)
    })

    inflightNearbyLookups.set(cacheKey, request)
    return request
  },
}
