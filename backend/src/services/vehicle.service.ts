import { adminClient } from '../config/supabaseClient'
import type { VehicleCreateInput, VehicleListQuery, VehicleUpdateInput } from '../models/transport.schemas'
import type { AssignableDriverRecord, PaginatedResult, VehicleRecord } from '../models/transport.types'
import type { TransportAccessRole } from '../utils/role'
import { HttpError } from '../utils/httpError'
import { rangeFromPagination, toPaginatedResult } from '../utils/pagination'

function toVehicleRecord(row: Record<string, unknown>): VehicleRecord {
  const driver = row.assigned_driver as Record<string, unknown> | null

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    vehicleType: String(row.vehicle_type),
    status: String(row.status) as VehicleRecord['status'],
    registrationNumber: row.registration_number ? String(row.registration_number) : null,
    capacity: typeof row.capacity === 'number' ? row.capacity : row.capacity ? Number(row.capacity) : null,
    assignedDriverUserId: row.assigned_driver_user_id ? String(row.assigned_driver_user_id) : null,
    assignedDriverName: driver?.full_name ? String(driver.full_name) : null,
    gpsDeviceId: row.gps_device_id ? String(row.gps_device_id) : null,
    baseLocation: row.base_location ? String(row.base_location) : null,
    notes: row.notes ? String(row.notes) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function ensureVehicleExists(id: string, projectId: string) {
  const { data, error } = await adminClient
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Vehicle not found for the selected project.')
  }
}

export async function listVehicles(query: VehicleListQuery): Promise<PaginatedResult<VehicleRecord>> {
  return listVehiclesForActor(query, null, new Set<TransportAccessRole>(['LINE_PRODUCER']))
}

export async function listVehiclesForActor(
  query: VehicleListQuery,
  actorUserId: string | null,
  roles: Set<TransportAccessRole>,
): Promise<PaginatedResult<VehicleRecord>> {
  const { from, to } = rangeFromPagination(query)
  let request = adminClient
    .from('vehicles')
    .select('*, assigned_driver:users!vehicles_assigned_driver_user_id_fkey(full_name)', { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query.status) {
    request = request.eq('status', query.status)
  }

  if (roles.has('DRIVER') && actorUserId && !roles.has('TRANSPORT_CAPTAIN') && !roles.has('LINE_PRODUCER')) {
    request = request.eq('assigned_driver_user_id', actorUserId)
  }

  const { data, error, count } = await request
  if (error) {
    throw error
  }

  return toPaginatedResult((data ?? []).map(item => toVehicleRecord(item as Record<string, unknown>)), count ?? 0, query)
}

export async function listAssignableDrivers(projectId: string): Promise<AssignableDriverRecord[]> {
  const { data, error } = await adminClient
    .from('project_members')
    .select('user_id, department, access_role, role, user:users!project_members_user_id_fkey(full_name)')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .eq('access_role', 'DRIVER')
    .order('approved_at', { ascending: false })

  if (error) {
    throw error
  }

  const seen = new Set<string>()
  const drivers: AssignableDriverRecord[] = []

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const userId = String(row.user_id ?? '')
    if (!userId || seen.has(userId)) {
      continue
    }

    seen.add(userId)
    const user = row.user as Record<string, unknown> | null
    drivers.push({
      userId,
      fullName: user?.full_name ? String(user.full_name) : 'Driver',
      department: row.department ? String(row.department) : null,
      role: row.role ? String(row.role) : null,
    })
  }

  return drivers
}

export async function createVehicle(input: VehicleCreateInput): Promise<VehicleRecord> {
  const { data, error } = await adminClient
    .from('vehicles')
    .insert({
      project_id: input.projectId,
      name: input.name,
      vehicle_type: input.vehicleType,
      registration_number: input.registrationNumber ?? null,
      status: input.status,
      capacity: input.capacity ?? null,
      assigned_driver_user_id: input.assignedDriverUserId ?? null,
      gps_device_id: input.gpsDeviceId ?? null,
      base_location: input.baseLocation ?? null,
      notes: input.notes ?? null,
      metadata: {},
    })
    .select('*, assigned_driver:users!vehicles_assigned_driver_user_id_fkey(full_name)')
    .single()

  if (error) {
    throw error
  }

  return toVehicleRecord(data as Record<string, unknown>)
}

export async function updateVehicle(vehicleId: string, input: VehicleUpdateInput): Promise<VehicleRecord> {
  await ensureVehicleExists(vehicleId, input.projectId)

  const updatePayload: Record<string, unknown> = {}
  if (input.name !== undefined) updatePayload.name = input.name
  if (input.vehicleType !== undefined) updatePayload.vehicle_type = input.vehicleType
  if (input.registrationNumber !== undefined) updatePayload.registration_number = input.registrationNumber || null
  if (input.status !== undefined) updatePayload.status = input.status
  if (input.capacity !== undefined) updatePayload.capacity = input.capacity
  if (input.assignedDriverUserId !== undefined) updatePayload.assigned_driver_user_id = input.assignedDriverUserId
  if (input.gpsDeviceId !== undefined) updatePayload.gps_device_id = input.gpsDeviceId || null
  if (input.baseLocation !== undefined) updatePayload.base_location = input.baseLocation || null
  if (input.notes !== undefined) updatePayload.notes = input.notes || null

  const { data, error } = await adminClient
    .from('vehicles')
    .update(updatePayload)
    .eq('id', vehicleId)
    .eq('project_id', input.projectId)
    .select('*, assigned_driver:users!vehicles_assigned_driver_user_id_fkey(full_name)')
    .single()

  if (error) {
    throw error
  }

  return toVehicleRecord(data as Record<string, unknown>)
}
