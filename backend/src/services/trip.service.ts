import { adminClient } from '../config/supabaseClient'
import type { TripEndInput, TripListQuery, TripStartInput } from '../models/transport.schemas'
import type { LocationPoint, PaginatedResult, TripRecord } from '../models/transport.types'
import { emitTransportEvent } from '../realtime/socket'
import { HttpError } from '../utils/httpError'
import { haversineDistanceKm, roundDistance } from '../utils/location'
import { rangeFromPagination, toPaginatedResult } from '../utils/pagination'
import type { TransportAccessRole } from '../utils/role'
import { createTransportAlert } from './alert.service'

const tripSelectClause = '*, vehicle:vehicles!trips_vehicle_id_fkey(name), driver:users!trips_driver_user_id_fkey(full_name)'

function toLocation(value: unknown): LocationPoint | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const latitude = typeof raw.latitude === 'number' ? raw.latitude : Number(raw.latitude)
  const longitude = typeof raw.longitude === 'number' ? raw.longitude : Number(raw.longitude)

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  return {
    latitude,
    longitude,
    address: typeof raw.address === 'string' ? raw.address : undefined,
  }
}

function toTripRecord(row: Record<string, unknown>): TripRecord {
  const vehicle = row.vehicle as Record<string, unknown> | null
  const driver = row.driver as Record<string, unknown> | null

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    vehicleId: String(row.vehicle_id),
    vehicleName: vehicle?.name ? String(vehicle.name) : 'Vehicle',
    driverUserId: row.driver_user_id ? String(row.driver_user_id) : null,
    driverName: driver?.full_name ? String(driver.full_name) : null,
    startTime: String(row.start_time),
    endTime: row.end_time ? String(row.end_time) : null,
    startLocation: toLocation(row.start_location),
    endLocation: toLocation(row.end_location),
    startOdometerKm: row.start_odometer_km != null ? Number(row.start_odometer_km) : null,
    endOdometerKm: row.end_odometer_km != null ? Number(row.end_odometer_km) : null,
    distanceKm: Number(row.distance_km ?? 0),
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    idleMinutes: row.idle_minutes != null ? Number(row.idle_minutes) : null,
    origin: row.origin ? String(row.origin) : null,
    destination: row.destination ? String(row.destination) : null,
    purpose: row.purpose ? String(row.purpose) : null,
    status: String(row.status) as TripRecord['status'],
    outstationFlag: Boolean(row.outstation),
    abnormalityScore: Number(row.abnormality_score ?? 0),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function ensureVehicle(projectId: string, vehicleId: string) {
  const { data, error } = await adminClient
    .from('vehicles')
    .select('id, name, assigned_driver_user_id')
    .eq('project_id', projectId)
    .eq('id', vehicleId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Vehicle not found for the selected project.')
  }

  return data as Record<string, unknown>
}

async function insertGpsLog(projectId: string, vehicleId: string, tripId: string, location: LocationPoint) {
  await adminClient.from('gps_logs').insert({
    project_id: projectId,
    vehicle_id: vehicleId,
    trip_id: tripId,
    latitude: location.latitude,
    longitude: location.longitude,
    geofence_status: 'captured',
    metadata: {},
  })
}

async function getGeofence(projectId: string) {
  const { data, error } = await adminClient
    .from('project_settings')
    .select('geofence_center_latitude, geofence_center_longitude, geofence_radius_km, outstation_threshold_km')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || data.geofence_center_latitude == null || data.geofence_center_longitude == null) {
    return null
  }

  return {
    center: {
      latitude: Number(data.geofence_center_latitude),
      longitude: Number(data.geofence_center_longitude),
    },
    radiusKm: data.geofence_radius_km != null ? Number(data.geofence_radius_km) : Number(data.outstation_threshold_km ?? 80),
  }
}

function durationMinutes(startTime: string, endTime: string) {
  return Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000))
}

function estimateIdleMinutes(distanceKm: number, totalDurationMinutes: number) {
  if (distanceKm <= 0 || totalDurationMinutes <= 0) {
    return totalDurationMinutes
  }

  const estimatedMovingMinutes = (distanceKm / 30) * 60
  return Math.max(0, Math.round(totalDurationMinutes - estimatedMovingMinutes))
}

function computeTripAbnormality(params: { distanceKm: number; startLocation: LocationPoint | null; endLocation: LocationPoint | null; durationMinutes: number }) {
  const crowFlightKm = params.startLocation && params.endLocation
    ? haversineDistanceKm(params.startLocation, params.endLocation)
    : null

  let score = 0
  let reason: string | null = null

  if (params.durationMinutes >= 16 * 60) {
    score += 45
    reason = 'Trip duration exceeded the safe operating threshold.'
  }

  if (crowFlightKm && params.distanceKm > Math.max(15, crowFlightKm * 4)) {
    score += 40
    reason = reason ?? 'Recorded distance is abnormally high for the captured route.'
  }

  return {
    score: Math.min(100, roundDistance(score, 0)),
    reason,
  }
}

export async function listTrips(query: TripListQuery): Promise<PaginatedResult<TripRecord>> {
  return listTripsForActor(query, null, new Set<TransportAccessRole>(['LINE_PRODUCER']))
}

export async function listTripsForActor(
  query: TripListQuery,
  actorUserId: string | null,
  roles: Set<TransportAccessRole>,
): Promise<PaginatedResult<TripRecord>> {
  const { from, to } = rangeFromPagination(query)
  let request = adminClient
    .from('trips')
    .select(tripSelectClause, { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('start_time', { ascending: false })
    .range(from, to)

  if (query.status) {
    request = request.eq('status', query.status)
  }

  if (query.vehicleId) {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.driverId) {
    request = request.eq('driver_user_id', query.driverId)
  }

  if (query.dateFrom) {
    request = request.gte('start_time', `${query.dateFrom}T00:00:00.000Z`)
  }

  if (query.dateTo) {
    request = request.lte('start_time', `${query.dateTo}T23:59:59.999Z`)
  }

  if (roles.has('DRIVER') && actorUserId && !roles.has('TRANSPORT_CAPTAIN') && !roles.has('LINE_PRODUCER')) {
    request = request.eq('driver_user_id', actorUserId)
  }

  const { data, error, count } = await request
  if (error) {
    console.error('[transport][trips][list] query failed', {
      projectId: query.projectId,
      actorUserId,
      roles: Array.from(roles),
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw error
  }

  return toPaginatedResult((data ?? []).map(item => toTripRecord(item as Record<string, unknown>)), count ?? 0, query)
}

export async function startTrip(input: TripStartInput, actorUserId: string, isDriver: boolean): Promise<TripRecord> {
  const vehicle = await ensureVehicle(input.projectId, input.vehicleId)
  const driverId = isDriver ? actorUserId : input.driverId ?? (vehicle.assigned_driver_user_id ? String(vehicle.assigned_driver_user_id) : actorUserId)

  if (isDriver && vehicle.assigned_driver_user_id && String(vehicle.assigned_driver_user_id) !== actorUserId) {
    throw new HttpError(403, 'Drivers can only start trips for vehicles assigned to them.')
  }

  const { data, error } = await adminClient
    .from('trips')
    .insert({
      project_id: input.projectId,
      vehicle_id: input.vehicleId,
      driver_user_id: driverId,
      origin: input.origin ?? input.startLocation.address ?? null,
      destination: input.destination ?? null,
      start_time: input.startTime ?? new Date().toISOString(),
      start_location: input.startLocation,
      start_odometer_km: input.odometerKm ?? null,
      purpose: input.purpose ?? null,
      call_sheet_reference: input.callSheetReference ?? null,
      status: 'active',
      created_by: actorUserId,
      metadata: {},
    })
    .select(tripSelectClause)
    .single()

  if (error) {
    throw error
  }

  const trip = toTripRecord(data as Record<string, unknown>)
  await adminClient
    .from('vehicles')
    .update({ status: 'active' })
    .eq('id', input.vehicleId)
    .eq('project_id', input.projectId)
  await insertGpsLog(input.projectId, input.vehicleId, trip.id, input.startLocation)

  emitTransportEvent('trip_started', {
    projectId: trip.projectId,
    entityId: trip.id,
    type: 'trip_started',
    data: trip,
  })

  return trip
}

export async function endTrip(input: TripEndInput, actorUserId: string, isDriver: boolean): Promise<TripRecord> {
  const { data: existing, error: fetchError } = await adminClient
    .from('trips')
    .select(tripSelectClause)
    .eq('id', input.tripId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!existing) {
    throw new HttpError(404, 'Trip not found for the selected project.')
  }

  const trip = toTripRecord(existing as Record<string, unknown>)
  if (trip.status !== 'active') {
    throw new HttpError(409, 'Only active trips can be ended.')
  }

  if (isDriver && trip.driverUserId !== actorUserId) {
    throw new HttpError(403, 'Drivers can only end their own trips.')
  }

  const endTime = input.endTime ?? new Date().toISOString()
  const minutes = durationMinutes(trip.startTime, endTime)
  const odometerDistance = trip.startOdometerKm != null ? input.odometerKm - trip.startOdometerKm : null
  const geodesicDistance = trip.startLocation ? haversineDistanceKm(trip.startLocation, input.endLocation) : 0
  const distanceKm = roundDistance(odometerDistance != null && odometerDistance >= 0 ? odometerDistance : geodesicDistance)

  if (odometerDistance != null && odometerDistance < 0) {
    throw new HttpError(400, 'End odometer cannot be lower than the starting odometer.')
  }

  const geofence = await getGeofence(input.projectId)
  const outstationFlag = geofence
    ? haversineDistanceKm(geofence.center, input.endLocation) > geofence.radiusKm
    : trip.startLocation
      ? haversineDistanceKm(trip.startLocation, input.endLocation) > 80
      : false

  const abnormality = computeTripAbnormality({
    distanceKm,
    startLocation: trip.startLocation,
    endLocation: input.endLocation,
    durationMinutes: minutes,
  })

  const nextStatus = abnormality.score >= 60 ? 'flagged' : 'completed'
  const idleMinutes = estimateIdleMinutes(distanceKm, minutes)

  const { data: updated, error: updateError } = await adminClient
    .from('trips')
    .update({
      end_time: endTime,
      end_location: input.endLocation,
      end_odometer_km: input.odometerKm,
      destination: input.destination ?? input.endLocation.address ?? trip.destination,
      distance_km: distanceKm,
      duration_minutes: minutes,
      idle_minutes: idleMinutes,
      outstation: outstationFlag,
      abnormality_score: abnormality.score,
      status: nextStatus,
    })
    .eq('id', input.tripId)
    .eq('project_id', input.projectId)
    .select(tripSelectClause)
    .single()

  if (updateError) {
    throw updateError
  }

  const completedTrip = toTripRecord(updated as Record<string, unknown>)
  await adminClient
    .from('vehicles')
    .update({ status: outstationFlag ? 'active' : 'idle' })
    .eq('id', trip.vehicleId)
    .eq('project_id', input.projectId)
  await insertGpsLog(input.projectId, trip.vehicleId, trip.id, input.endLocation)

  if (abnormality.score >= 60 && abnormality.reason) {
    await createTransportAlert({
      projectId: input.projectId,
      vehicleId: trip.vehicleId,
      tripId: trip.id,
      severity: 'warning',
      alertType: 'abnormal_trip',
      title: 'Abnormal trip detected',
      message: abnormality.reason,
      metadata: {
        abnormalityScore: abnormality.score,
        distanceKm,
        durationMinutes: minutes,
        idleMinutes,
      },
    })
  }

  if (outstationFlag) {
    await createTransportAlert({
      projectId: input.projectId,
      vehicleId: trip.vehicleId,
      tripId: trip.id,
      severity: 'info',
      alertType: 'outstation_trip',
      title: 'Outstation trip detected',
      message: 'Vehicle crossed the configured project boundary.',
      metadata: {
        endLocation: input.endLocation,
        distanceKm,
        idleMinutes,
      },
    })
  }

  emitTransportEvent('trip_ended', {
    projectId: completedTrip.projectId,
    entityId: completedTrip.id,
    type: completedTrip.status,
    data: completedTrip,
  })

  return completedTrip
}
