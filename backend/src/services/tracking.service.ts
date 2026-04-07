import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { adminClient } from '../config/supabaseClient'
import type { LiveLocationUpdateInput, TrackingLiveQuery, TrackingMapQuery } from '../models/transport.schemas'
import type { LiveVehicleLocationRecord } from '../models/transport.types'
import { emitTransportEvent } from '../realtime/socket'
import { env } from '../utils/env'
import { HttpError } from '../utils/httpError'
import type { TransportAccessRole } from '../utils/role'
import { getCacheJson, getCacheStrings, setCacheJson } from './cache.service'
import { getMapboxBudgetState, getMapProvider, hasMapboxToken } from './location.service'
import { haversineDistanceKm, roundDistance } from '../utils/location'
import {
  buildHybridTrackingPolicy,
  hasEnteredNearDestinationWindow,
  isHybridTrackingPolicy,
  resolveCheckpointIntervalMs,
  type HybridTrackingPolicy,
} from './trackingPolicy.service'
import { getMapboxToken, incrementMapboxUsage, safeMapboxCall, type MapProviderRole } from './mapboxUsageService'

const LAST_LOCATION_TTL_SECONDS = 24 * 60 * 60
const MAP_IMAGE_TTL_SECONDS = 5 * 60
const ROUTE_CACHE_TTL_SECONDS = 24 * 60 * 60
const STALE_AFTER_MS = 45 * 60 * 1000

type TrackingMode = LiveVehicleLocationRecord['trackingMode']
type MovingStatus = LiveVehicleLocationRecord['movingStatus']

type ActiveTripRow = {
  id: string
  project_id: string
  vehicle_id: string
  driver_user_id: string | null
  start_time: string
  start_location: { latitude?: number; longitude?: number } | null
  metadata?: Record<string, unknown> | null
  vehicle: { name?: string; registration_number?: string | null } | null
  driver: { full_name?: string | null } | null
}

type GpsRow = {
  latitude: number
  longitude: number
  speed_kph: number | null
  heading: number | null
  captured_at: string
  metadata: Record<string, unknown> | null
}

export interface TrackingMapImagePayload {
  contentType: string
  body: Buffer
  provider: 'mapbox' | 'internal'
}

export interface TrackingLiveMeta {
  mapEnabled: boolean
  provider: 'mapbox' | 'osm'
  mode: 'normal' | 'restricted' | 'disabled' | 'fallback'
  fallback: boolean
  reason?: string
  mapboxMode: 'healthy' | 'restricted' | 'disabled'
  mapboxEnabledForAdmin: boolean
  fallbackActive: boolean
}

type TrackingStateRecord = {
  projectId: string
  tripId: string
  vehicleId: string
  vehicleName: string
  registrationNumber: string | null
  driverUserId: string | null
  driverName: string | null
  prevLat: number | null
  prevLng: number | null
  prevCapturedAt: string | null
  lastLat: number
  lastLng: number
  lastUpdatedAt: string
  speedKph: number | null
  heading: number | null
  accuracyMeters: number | null
  updateIntervalMs: number | null
  expectedNextUpdateAt: string | null
  distanceRemainingKm: number | null
  trackingMode: TrackingMode
  movingStatus: MovingStatus
}

type TrackingPlan = {
  destinationLocation?: {
    latitude?: number
    longitude?: number
    address?: string
  } | null
  estimatedDistanceKm?: number | null
  estimatedDurationMinutes?: number | null
  hybridPolicy?: HybridTrackingPolicy | null
}

function liveLocationCacheKey(projectId: string, vehicleId: string) {
  return `tracking:last:${projectId}:${vehicleId}`
}

function liveStateCacheKey(projectId: string, vehicleId: string) {
  return `tracking:state:${projectId}:${vehicleId}`
}

function routeCacheKey(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, provider: string) {
  return `tracking:route:${provider}:${from.latitude.toFixed(4)}:${from.longitude.toFixed(4)}:${to.latitude.toFixed(4)}:${to.longitude.toFixed(4)}`
}

function trackingMapCacheKey(projectId: string, width: number, height: number, locations: LiveVehicleLocationRecord[], provider: string) {
  const hash = createHash('sha1')
    .update(JSON.stringify({
      provider,
      width,
      height,
      locations: locations.map(location => ({
        vehicleId: location.vehicleId,
        tripId: location.tripId,
        latitude: Number(location.latitude.toFixed(5)),
        longitude: Number(location.longitude.toFixed(5)),
        capturedAt: location.capturedAt,
      })),
    }))
    .digest('hex')

  return `tracking:map:${projectId}:${hash}`
}

function resolveMapProviderRole(roles: Set<TransportAccessRole>): MapProviderRole {
  if (roles.has('LINE_PRODUCER')) {
    return 'PRODUCER'
  }

  if (roles.has('TRANSPORT_CAPTAIN')) {
    return 'CAPTAIN'
  }

  if (roles.has('DRIVER')) {
    return 'DRIVER'
  }

  return 'MEMBER'
}

function extractTrackingPlan(metadata: Record<string, unknown> | null | undefined): TrackingPlan {
  const raw = metadata?.trackingPlan
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const trackingPlan = raw as TrackingPlan
  return {
    ...trackingPlan,
    hybridPolicy: isHybridTrackingPolicy(trackingPlan.hybridPolicy)
      ? trackingPlan.hybridPolicy
      : buildHybridTrackingPolicy({
        estimatedDurationMinutes: trackingPlan.estimatedDurationMinutes ?? null,
        estimatedDistanceKm: trackingPlan.estimatedDistanceKm ?? null,
      }),
  }
}

function buildStraightLineRoute(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, steps = 18) {
  if (from.latitude === to.latitude && from.longitude === to.longitude) {
    return [[from.longitude, from.latitude]] as Array<[number, number]>
  }

  const coordinates: Array<[number, number]> = []
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps
    coordinates.push([
      Number((from.longitude + (to.longitude - from.longitude) * progress).toFixed(6)),
      Number((from.latitude + (to.latitude - from.latitude) * progress).toFixed(6)),
    ])
  }

  return coordinates
}

async function fetchMapboxRoute(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const token = getMapboxToken()
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    access_token: token,
  })
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ProdSync/2.0 transport-live-routing',
    },
  })

  if (!response.ok) {
    throw new Error(`Mapbox directions failed with status ${response.status}`)
  }

  const payload = await response.json() as {
    routes?: Array<{
      geometry?: {
        coordinates?: Array<[number, number]>
      }
    }>
  }
  const route = payload.routes?.[0]?.geometry?.coordinates?.filter(
    point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  ) ?? []

  if (route.length < 2) {
    throw new Error('Mapbox directions returned no usable route.')
  }

  await incrementMapboxUsage()
  return route
}

function deriveTrackingMode(params: {
  speedKph: number | null
  estimatedDurationMinutes: number | null
  distanceRemainingKm: number | null
  nearDestinationRadiusKm: number
}) {
  if (params.distanceRemainingKm != null && params.distanceRemainingKm <= 0.25) {
    return 'arrived' as const
  }

  if (params.distanceRemainingKm != null && params.distanceRemainingKm <= params.nearDestinationRadiusKm) {
    return 'approaching_destination' as const
  }

  if (params.speedKph != null && params.speedKph < 3) {
    return 'idle' as const
  }

  if (params.estimatedDurationMinutes != null && params.estimatedDurationMinutes <= 60) {
    return 'short_trip' as const
  }

  return 'long_trip' as const
}

function deriveMovingStatus(mode: TrackingMode, capturedAt: string) {
  if (Date.now() - new Date(capturedAt).getTime() > STALE_AFTER_MS) {
    return 'stale' as const
  }

  if (mode === 'approaching_destination') {
    return 'approaching_destination' as const
  }

  if (mode === 'arrived') {
    return 'arrived' as const
  }

  if (mode === 'idle') {
    return 'idle' as const
  }

  return 'enroute' as const
}

async function resolveRouteCoordinates(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number },
  userRole: MapProviderRole,
) {
  if (!from) {
    return {
      routeCoordinates: [[to.longitude, to.latitude]] as Array<[number, number]>,
      routeProvider: 'none' as const,
    }
  }

  return generateRoute(from, to, userRole)
}

async function generateRoute(
  previousLocation: { latitude: number; longitude: number },
  nextLocation: { latitude: number; longitude: number },
  userRole: MapProviderRole,
) {
  const fallbackRoute = buildStraightLineRoute(previousLocation, nextLocation)
  const budget = await getMapboxBudgetState()
  const provider = getMapProvider(userRole, budget)

  if (provider !== 'mapbox') {
    return {
      routeCoordinates: fallbackRoute,
      routeProvider: 'straight_line' as const,
    }
  }

  const cacheKey = routeCacheKey(previousLocation, nextLocation, 'mapbox')
  const cached = await getCacheJson<Array<[number, number]>>(cacheKey)
  if (cached && cached.length > 1) {
    return {
      routeCoordinates: cached,
      routeProvider: 'mapbox' as const,
    }
  }

  const routeCoordinates = await safeMapboxCall(() => fetchMapboxRoute(previousLocation, nextLocation))
  if (!routeCoordinates || routeCoordinates.length < 2) {
    return {
      routeCoordinates: fallbackRoute,
      routeProvider: 'straight_line' as const,
    }
  }

  await setCacheJson(cacheKey, routeCoordinates, ROUTE_CACHE_TTL_SECONDS)
  return {
    routeCoordinates,
    routeProvider: 'mapbox' as const,
  }
}

function buildTrackingMeta(
  roles: Set<TransportAccessRole>,
  budget: Awaited<ReturnType<typeof getMapboxBudgetState>>,
): TrackingLiveMeta {
  const providerRole = resolveMapProviderRole(roles)
  const provider = getMapProvider(providerRole, budget)
  const mapEnabled = provider === 'mapbox'
  const fallback = !mapEnabled
  const legacyMode = budget.mode === 'normal' ? 'healthy' : budget.mode
  const mode = !hasMapboxToken()
    ? 'fallback'
    : budget.mode === 'disabled'
      ? 'disabled'
      : mapEnabled
        ? budget.mode
        : 'fallback'

  return {
    mapEnabled,
    provider: mapEnabled ? 'mapbox' : 'osm',
    mode,
    fallback,
    reason: !hasMapboxToken() ? 'No token' : budget.reason,
    mapboxMode: legacyMode,
    mapboxEnabledForAdmin: mapEnabled,
    fallbackActive: fallback,
  }
}

async function listAccessibleActiveTrips(projectId: string, actorUserId: string | null, roles: Set<TransportAccessRole>) {
  let request = adminClient
    .from('trips')
    .select('id, project_id, vehicle_id, driver_user_id, start_time, start_location, metadata, vehicle:vehicles!trips_vehicle_id_fkey(name, registration_number), driver:users!trips_driver_user_id_fkey(full_name)')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('start_time', { ascending: false })

  if (roles.has('DRIVER') && actorUserId && !roles.has('LINE_PRODUCER') && !roles.has('TRANSPORT_CAPTAIN')) {
    request = request.eq('driver_user_id', actorUserId)
  }

  const { data, error } = await request
  if (error) {
    throw error
  }

  return (data ?? []) as unknown as ActiveTripRow[]
}

async function loadLatestGpsRow(projectId: string, tripId: string, vehicleId: string) {
  const { data, error } = await adminClient
    .from('gps_logs')
    .select('latitude, longitude, speed_kph, heading, captured_at, metadata')
    .eq('project_id', projectId)
    .eq('trip_id', tripId)
    .eq('vehicle_id', vehicleId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as GpsRow | null) ?? null
}

async function loadTrackingState(projectId: string, vehicleId: string) {
  return getCacheJson<TrackingStateRecord>(liveStateCacheKey(projectId, vehicleId))
}

function mapTripToLiveLocation(
  trip: ActiveTripRow,
  gps: GpsRow | null,
  source: LiveVehicleLocationRecord['source'],
  state?: TrackingStateRecord | null,
): LiveVehicleLocationRecord | null {
  const latitude = gps?.latitude ?? trip.start_location?.latitude
  const longitude = gps?.longitude ?? trip.start_location?.longitude

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null
  }

  const trackingPlan = extractTrackingPlan(trip.metadata)
  const destinationLocation = trackingPlan.destinationLocation
  const hybridPolicy = trackingPlan.hybridPolicy ?? buildHybridTrackingPolicy({
    estimatedDurationMinutes: trackingPlan.estimatedDurationMinutes ?? null,
    estimatedDistanceKm: trackingPlan.estimatedDistanceKm ?? null,
  })
  const distanceRemainingKm = state?.distanceRemainingKm
    ?? (destinationLocation?.latitude != null && destinationLocation?.longitude != null
      ? roundDistance(haversineDistanceKm(
        { latitude, longitude },
        { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude },
      ))
      : null)
  const trackingMode = state?.trackingMode
    ?? deriveTrackingMode({
      speedKph: gps?.speed_kph ?? null,
      estimatedDurationMinutes: trackingPlan.estimatedDurationMinutes ?? null,
      distanceRemainingKm,
      nearDestinationRadiusKm: hybridPolicy.nearDestinationRadiusKm,
    })
  const updateIntervalMs = state?.updateIntervalMs
    ?? resolveCheckpointIntervalMs(hybridPolicy, distanceRemainingKm)
  const capturedAt = gps?.captured_at ?? trip.start_time

  return {
    projectId: trip.project_id,
    tripId: trip.id,
    vehicleId: trip.vehicle_id,
    vehicleName: trip.vehicle?.name ?? 'Vehicle',
    registrationNumber: trip.vehicle?.registration_number ?? null,
    driverUserId: trip.driver_user_id,
    driverName: trip.driver?.full_name ?? null,
    latitude,
    longitude,
    speedKph: gps?.speed_kph ?? null,
    heading: gps?.heading ?? null,
    accuracyMeters: typeof gps?.metadata?.accuracyMeters === 'number' ? gps.metadata.accuracyMeters : null,
    capturedAt,
    source,
    previousLatitude: state?.prevLat ?? null,
    previousLongitude: state?.prevLng ?? null,
    previousCapturedAt: state?.prevCapturedAt ?? null,
    routeCoordinates: [[longitude, latitude]],
    routeProvider: 'none',
    updateIntervalMs,
    expectedNextUpdateAt: state?.expectedNextUpdateAt
      ?? (updateIntervalMs != null ? new Date(new Date(capturedAt).getTime() + updateIntervalMs).toISOString() : null),
    distanceRemainingKm,
    trackingMode,
    movingStatus: state?.movingStatus ?? deriveMovingStatus(trackingMode, capturedAt),
  }
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTrackingSvg(locations: LiveVehicleLocationRecord[], width: number, height: number) {
  const padding = 48
  const contentWidth = width - padding * 2
  const contentHeight = height - padding * 2

  if (locations.length === 0) {
    const empty = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="28" fill="url(#bg)"/>
        <text x="50%" y="48%" text-anchor="middle" fill="#1f2937" font-size="24" font-family="Arial, sans-serif" font-weight="700">Live tracking is ready</text>
        <text x="50%" y="58%" text-anchor="middle" fill="#64748b" font-size="15" font-family="Arial, sans-serif">No active vehicles are streaming right now.</text>
      </svg>
    `

    return Buffer.from(empty)
  }

  const latitudes = locations.map(location => location.latitude)
  const longitudes = locations.map(location => location.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)
  const latSpan = Math.max(0.02, maxLat - minLat)
  const lngSpan = Math.max(0.02, maxLng - minLng)

  const points = locations.map((location, index) => {
    const x = padding + ((location.longitude - minLng) / lngSpan) * contentWidth
    const y = padding + (1 - ((location.latitude - minLat) / latSpan)) * contentHeight
    const label = `${index + 1}`
    const title = escapeSvg(`${location.vehicleName} | ${location.driverName ?? 'Driver'} | ${location.registrationNumber ?? 'No number'}`)

    return `
      <g>
        <title>${title}</title>
        <circle cx="${x}" cy="${y}" r="10" fill="#f97316" opacity="0.28"/>
        <circle cx="${x}" cy="${y}" r="6" fill="#ea580c"/>
        <text x="${x}" y="${y - 14}" text-anchor="middle" fill="#111827" font-size="12" font-family="Arial, sans-serif" font-weight="700">${label}</text>
      </g>
    `
  }).join('')

  const legend = locations.slice(0, 6).map((location, index) => `
      <tspan x="${padding}" dy="${index === 0 ? 0 : 18}">${index + 1}. ${escapeSvg(location.vehicleName)} • ${escapeSvg(location.driverName ?? 'Driver')}</tspan>
    `).join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="panel" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#fff7ed"/>
          <stop offset="100%" stop-color="#fffbeb"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="28" fill="#fff"/>
      <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="24" fill="url(#panel)" stroke="#fdba74"/>
      <rect x="${padding}" y="${padding}" width="${contentWidth}" height="${contentHeight}" rx="20" fill="#ffffff" stroke="#fed7aa"/>
      <path d="M ${padding} ${padding + contentHeight / 2} H ${padding + contentWidth}" stroke="#fde68a" stroke-dasharray="6 6"/>
      <path d="M ${padding + contentWidth / 2} ${padding} V ${padding + contentHeight}" stroke="#fde68a" stroke-dasharray="6 6"/>
      ${points}
      <text x="${padding}" y="${height - 34}" fill="#475569" font-size="13" font-family="Arial, sans-serif" font-weight="700">Fallback tracking view</text>
      <text x="${padding}" y="${height - 14}" fill="#64748b" font-size="12" font-family="Arial, sans-serif">Mapbox is unavailable or throttled, so the live fleet is rendered from backend coordinates.</text>
      <text x="${width - padding}" y="${padding}" text-anchor="end" fill="#111827" font-size="18" font-family="Arial, sans-serif" font-weight="700">Live Fleet</text>
      <text x="${padding}" y="${padding - 14}" fill="#64748b" font-size="12" font-family="Arial, sans-serif">Hybrid checkpoints keep tracking smooth while keeping map usage low.</text>
      <text x="${padding}" y="${padding + contentHeight + 24}" fill="#334155" font-size="12" font-family="Arial, sans-serif">${legend}</text>
    </svg>
  `

  return Buffer.from(svg)
}

async function fetchMapboxStaticMap(locations: LiveVehicleLocationRecord[], width: number, height: number) {
  const token = getMapboxToken()
  const markers = locations.slice(0, 10).map((location, index) => {
    const label = `${(index + 1) % 10}`
    return `pin-s-${label}+f97316(${location.longitude},${location.latitude})`
  }).join(',')

  const url = `https://api.mapbox.com/styles/v1/${encodeURIComponent(env.mapboxStaticStyleOwner)}/${encodeURIComponent(env.mapboxStaticStyleId)}/static/${markers || 'auto'}/auto/${width}x${height}?padding=48&access_token=${encodeURIComponent(token)}`
  const response = await fetch(url, {
    headers: {
      Accept: 'image/png',
      'User-Agent': 'ProdSync/2.0 transport-live-tracking',
    },
  })

  if (!response.ok) {
    throw new Error(`Mapbox static map failed with status ${response.status}`)
  }

  await incrementMapboxUsage()
  return Buffer.from(await response.arrayBuffer())
}

async function getCachedLiveLocations(projectId: string, vehicleIds: string[]) {
  const cacheKeys = vehicleIds.map(vehicleId => liveLocationCacheKey(projectId, vehicleId))
  const cachedEntries = await getCacheStrings(cacheKeys)
  const lookup = new Map<string, LiveVehicleLocationRecord>()

  cachedEntries.forEach((entry, index) => {
    if (!entry) {
      return
    }

    try {
      const parsed = JSON.parse(entry) as LiveVehicleLocationRecord
      lookup.set(vehicleIds[index], parsed)
    } catch {
      return
    }
  })

  return lookup
}

export async function listLiveVehicleLocationsForActor(
  query: TrackingLiveQuery,
  actorUserId: string | null,
  roles: Set<TransportAccessRole>,
) {
  const providerRole = resolveMapProviderRole(roles)
  const activeTrips = await listAccessibleActiveTrips(query.projectId, actorUserId, roles)
  if (activeTrips.length === 0) {
    return [] as LiveVehicleLocationRecord[]
  }

  const cachedLookup = await getCachedLiveLocations(query.projectId, activeTrips.map(trip => trip.vehicle_id))
  const liveLocationResults = await Promise.allSettled(activeTrips.map(async trip => {
    const cached = cachedLookup.get(trip.vehicle_id)
    if (cached && cached.tripId === trip.id) {
        const resolvedRoute = await resolveRouteCoordinates(
          cached.previousLatitude != null && cached.previousLongitude != null
            ? { latitude: cached.previousLatitude, longitude: cached.previousLongitude }
            : null,
          { latitude: cached.latitude, longitude: cached.longitude },
          providerRole,
        )

      return {
        ...cached,
        source: 'cache' as const,
        routeCoordinates: resolvedRoute.routeCoordinates,
        routeProvider: resolvedRoute.routeProvider,
        movingStatus: deriveMovingStatus(cached.trackingMode ?? 'long_trip', cached.capturedAt),
      }
    }

    const state = await loadTrackingState(query.projectId, trip.vehicle_id)
    const gps = await loadLatestGpsRow(query.projectId, trip.id, trip.vehicle_id)
    const mapped = mapTripToLiveLocation(trip, gps, 'database', state)
    if (mapped) {
      const resolvedRoute = await resolveRouteCoordinates(
        mapped.previousLatitude != null && mapped.previousLongitude != null
          ? { latitude: mapped.previousLatitude, longitude: mapped.previousLongitude }
          : null,
        { latitude: mapped.latitude, longitude: mapped.longitude },
        providerRole,
      )
      mapped.routeCoordinates = resolvedRoute.routeCoordinates
      mapped.routeProvider = resolvedRoute.routeProvider
      mapped.movingStatus = deriveMovingStatus(mapped.trackingMode, mapped.capturedAt)
      await setCacheJson(liveLocationCacheKey(query.projectId, trip.vehicle_id), mapped, LAST_LOCATION_TTL_SECONDS)
    }
    return mapped
  }))

  return liveLocationResults.flatMap(result => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : []
    }

    console.warn('[tracking][live] item fallback', {
      projectId: query.projectId,
      error: result.reason instanceof Error ? result.reason.message : result.reason,
    })
    return []
  })
}

export async function getTrackingLiveMetaForRoles(roles: Set<TransportAccessRole>): Promise<TrackingLiveMeta> {
  if (!hasMapboxToken()) {
    return {
      mapEnabled: false,
      provider: 'osm',
      mode: 'fallback',
      fallback: true,
      reason: 'No token',
      mapboxMode: 'disabled',
      mapboxEnabledForAdmin: false,
      fallbackActive: true,
    }
  }

  const budget = await getMapboxBudgetState()
  return buildTrackingMeta(roles, budget)
}

export async function recordVehicleLocationUpdate(
  input: LiveLocationUpdateInput,
  actorUserId: string,
  roles: Set<TransportAccessRole>,
) {
  const { data, error } = await adminClient
    .from('trips')
    .select('id, project_id, vehicle_id, driver_user_id, status, metadata, vehicle:vehicles!trips_vehicle_id_fkey(name, registration_number), driver:users!trips_driver_user_id_fkey(full_name)')
    .eq('id', input.tripId)
    .eq('project_id', input.projectId)
    .eq('vehicle_id', input.vehicleId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Active trip not found for the provided vehicle.')
  }

  if (String((data as Record<string, unknown>).status ?? '') !== 'active') {
    throw new HttpError(409, 'Live tracking is only available for active trips.')
  }

  const driverUserId = (data as Record<string, unknown>).driver_user_id ? String((data as Record<string, unknown>).driver_user_id) : null
  if (roles.has('DRIVER') && driverUserId && driverUserId !== actorUserId) {
    throw new HttpError(403, 'Drivers can only stream location for their own active trip.')
  }

  const capturedAt = input.capturedAt ?? new Date().toISOString()
  const trackingPlan = extractTrackingPlan(((data as Record<string, unknown>).metadata as Record<string, unknown> | null) ?? null)
  const hybridPolicy = trackingPlan.hybridPolicy ?? buildHybridTrackingPolicy({
    estimatedDurationMinutes: trackingPlan.estimatedDurationMinutes ?? null,
    estimatedDistanceKm: trackingPlan.estimatedDistanceKm ?? null,
  })
  const previousState = await loadTrackingState(input.projectId, input.vehicleId)
  const destinationLocation = trackingPlan.destinationLocation
  const computedDistanceRemainingKm = destinationLocation?.latitude != null && destinationLocation?.longitude != null
    ? roundDistance(haversineDistanceKm(
      { latitude: input.latitude, longitude: input.longitude },
      { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude },
    ))
    : null
  const distanceRemainingKm = computedDistanceRemainingKm ?? previousState?.distanceRemainingKm ?? null
  const trackingMode = deriveTrackingMode({
    speedKph: input.speedKph ?? null,
    estimatedDurationMinutes: trackingPlan.estimatedDurationMinutes ?? null,
    distanceRemainingKm,
    nearDestinationRadiusKm: hybridPolicy.nearDestinationRadiusKm,
  })
  const movingStatus = deriveMovingStatus(trackingMode, capturedAt)
  const updateIntervalMs = resolveCheckpointIntervalMs(hybridPolicy, distanceRemainingKm)
  const expectedNextUpdateAt = updateIntervalMs != null
    ? new Date(new Date(capturedAt).getTime() + updateIntervalMs).toISOString()
    : null
  const metadata = {
    source: 'hybrid_checkpoint',
    accuracyMeters: input.accuracyMeters ?? null,
    updatesPausedNearDestination: hasEnteredNearDestinationWindow(distanceRemainingKm, hybridPolicy),
  }

  const { error: insertError } = await adminClient
    .from('gps_logs')
    .insert({
      project_id: input.projectId,
      vehicle_id: input.vehicleId,
      trip_id: input.tripId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed_kph: input.speedKph ?? null,
      heading: input.heading ?? null,
      captured_at: capturedAt,
      geofence_status: 'live',
      metadata,
    })

  if (insertError) {
    throw insertError
  }

  const vehicle = (data as Record<string, unknown>).vehicle as Record<string, unknown> | null
  const driver = (data as Record<string, unknown>).driver as Record<string, unknown> | null

  const previousLocation = previousState?.lastLat != null && previousState?.lastLng != null
    ? { latitude: previousState.lastLat, longitude: previousState.lastLng }
    : null
  const currentLocation = { latitude: input.latitude, longitude: input.longitude }
  const providerRole = resolveMapProviderRole(roles)
  const route = await resolveRouteCoordinates(previousLocation, currentLocation, providerRole)

  const payload: LiveVehicleLocationRecord = {
    projectId: input.projectId,
    tripId: input.tripId,
    vehicleId: input.vehicleId,
    vehicleName: vehicle?.name ? String(vehicle.name) : 'Vehicle',
    registrationNumber: vehicle?.registration_number ? String(vehicle.registration_number) : null,
    driverUserId,
    driverName: driver?.full_name ? String(driver.full_name) : null,
    latitude: input.latitude,
    longitude: input.longitude,
    speedKph: input.speedKph ?? null,
    heading: input.heading ?? null,
    accuracyMeters: input.accuracyMeters ?? null,
    capturedAt,
    source: 'stream',
    previousLatitude: previousState?.lastLat ?? null,
    previousLongitude: previousState?.lastLng ?? null,
    previousCapturedAt: previousState?.lastUpdatedAt ?? null,
    routeCoordinates: route.routeCoordinates,
    routeProvider: route.routeProvider,
    updateIntervalMs,
    expectedNextUpdateAt,
    distanceRemainingKm,
    trackingMode,
    movingStatus,
  }

  const nextState: TrackingStateRecord = {
    projectId: input.projectId,
    tripId: input.tripId,
    vehicleId: input.vehicleId,
    vehicleName: payload.vehicleName,
    registrationNumber: payload.registrationNumber,
    driverUserId,
    driverName: payload.driverName,
    prevLat: previousState?.lastLat ?? null,
    prevLng: previousState?.lastLng ?? null,
    prevCapturedAt: previousState?.lastUpdatedAt ?? null,
    lastLat: input.latitude,
    lastLng: input.longitude,
    lastUpdatedAt: capturedAt,
    speedKph: input.speedKph ?? null,
    heading: input.heading ?? null,
    accuracyMeters: input.accuracyMeters ?? null,
    updateIntervalMs,
    expectedNextUpdateAt,
    distanceRemainingKm,
    trackingMode,
    movingStatus,
  }

  await setCacheJson(liveStateCacheKey(input.projectId, input.vehicleId), nextState, LAST_LOCATION_TTL_SECONDS)
  await setCacheJson(liveLocationCacheKey(input.projectId, input.vehicleId), payload, LAST_LOCATION_TTL_SECONDS)

  emitTransportEvent('vehicle_location_update', {
    projectId: input.projectId,
    entityId: input.vehicleId,
    type: 'vehicle_location_update',
    data: payload,
  })

  return payload
}

export async function buildTrackingMapImageForActor(
  query: TrackingMapQuery,
  actorUserId: string | null,
  roles: Set<TransportAccessRole>,
): Promise<TrackingMapImagePayload> {
  const locations = await listLiveVehicleLocationsForActor({ projectId: query.projectId, page: 1, pageSize: 100 }, actorUserId, roles)
  const budget = await getMapboxBudgetState()
  const providerRole = resolveMapProviderRole(roles)
  const canUseMapbox = getMapProvider(providerRole, budget) === 'mapbox'
  const provider = canUseMapbox ? 'mapbox' : 'internal'
  const cacheKey = trackingMapCacheKey(query.projectId, query.width, query.height, locations, provider)
  const cached = await getCacheJson<{ contentType: string; bodyBase64: string; provider: 'mapbox' | 'internal' }>(cacheKey)

  if (cached?.bodyBase64) {
    return {
      contentType: cached.contentType,
      body: Buffer.from(cached.bodyBase64, 'base64'),
      provider: cached.provider,
    }
  }

  try {
    if (provider === 'mapbox' && locations.length > 0) {
      const body = await safeMapboxCall(() => fetchMapboxStaticMap(locations, query.width, query.height))
      if (body) {
        await setCacheJson(cacheKey, {
          contentType: 'image/png',
          bodyBase64: body.toString('base64'),
          provider: 'mapbox',
        }, MAP_IMAGE_TTL_SECONDS)

        return {
          contentType: 'image/png',
          body,
          provider: 'mapbox',
        }
      }
    }
  } catch (error) {
    console.warn('[tracking][map] mapbox render failed, falling back to internal svg', {
      projectId: query.projectId,
      error: error instanceof Error ? error.message : error,
    })
  }

  const body = renderTrackingSvg(locations, query.width, query.height)
  await setCacheJson(cacheKey, {
    contentType: 'image/svg+xml',
    bodyBase64: body.toString('base64'),
    provider: 'internal',
  }, MAP_IMAGE_TTL_SECONDS)

  return {
    contentType: 'image/svg+xml',
    body,
    provider: 'internal',
  }
}
