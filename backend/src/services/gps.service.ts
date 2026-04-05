import { adminClient } from '../config/supabaseClient'
import type { GpsLogsListQuery } from '../models/transport.schemas'
import type { GpsLogRecord, PaginatedResult } from '../models/transport.types'
import { rangeFromPagination, toPaginatedResult } from '../utils/pagination'

function toGpsLogRecord(row: Record<string, unknown>): GpsLogRecord {
  return {
    id: Number(row.id),
    projectId: String(row.project_id),
    vehicleId: String(row.vehicle_id),
    tripId: row.trip_id ? String(row.trip_id) : null,
    capturedAt: String(row.captured_at),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speedKph: row.speed_kph != null ? Number(row.speed_kph) : null,
    heading: row.heading != null ? Number(row.heading) : null,
    geofenceStatus: row.geofence_status ? String(row.geofence_status) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }
}

export async function listGpsLogs(query: GpsLogsListQuery): Promise<PaginatedResult<GpsLogRecord>> {
  const { from, to } = rangeFromPagination(query)
  let request = adminClient
    .from('gps_logs')
    .select('*', { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('captured_at', { ascending: false })
    .range(from, to)

  if (query.tripId) {
    request = request.eq('trip_id', query.tripId)
  }

  if (query.vehicleId) {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  const { data, error, count } = await request
  if (error) {
    throw error
  }

  return toPaginatedResult((data ?? []).map(item => toGpsLogRecord(item as Record<string, unknown>)), count ?? 0, query)
}
