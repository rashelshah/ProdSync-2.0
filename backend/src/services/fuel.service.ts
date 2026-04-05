import path from 'node:path'
import { adminClient } from '../config/supabaseClient'
import type { FuelCreateBodyInput, FuelListQuery, FuelReviewInput } from '../models/transport.schemas'
import type { FuelLogRecord, PaginatedResult } from '../models/transport.types'
import { emitTransportEvent } from '../realtime/socket'
import { HttpError } from '../utils/httpError'
import { rangeFromPagination, toPaginatedResult } from '../utils/pagination'
import type { TransportAccessRole } from '../utils/role'
import { createTransportAlert } from './alert.service'
import { assessFuelFraud } from './fraud.service'

type UploadedFiles = Partial<Record<'receiptImage' | 'odometerImage', Express.Multer.File[]>>

function toFuelLogRecord(row: Record<string, unknown>): FuelLogRecord {
  const vehicle = row.vehicle as Record<string, unknown> | null
  const logger = row.logger as Record<string, unknown> | null

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    vehicleId: String(row.vehicle_id),
    vehicleName: vehicle?.name ? String(vehicle.name) : 'Vehicle',
    tripId: row.trip_id ? String(row.trip_id) : null,
    loggedBy: String(row.logged_by),
    loggedByName: logger?.full_name ? String(logger.full_name) : null,
    logDate: String(row.log_date),
    fuelType: String(row.fuel_type),
    liters: Number(row.litres),
    odometerKm: row.odometer_km != null ? Number(row.odometer_km) : null,
    expectedMileage: row.expected_mileage != null ? Number(row.expected_mileage) : null,
    actualMileage: row.actual_mileage != null ? Number(row.actual_mileage) : null,
    cost: row.cost_amount != null ? Number(row.cost_amount) : null,
    currencyCode: String(row.currency_code),
    auditStatus: String(row.audit_status) as FuelLogRecord['auditStatus'],
    notes: row.notes ? String(row.notes) : null,
    receiptFilePath: row.receipt_file_path ? String(row.receipt_file_path) : null,
    odometerImagePath: row.odometer_image_path ? String(row.odometer_image_path) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    approvalNote: row.approval_note ? String(row.approval_note) : null,
    fraudStatus: String(row.fraud_status) as FuelLogRecord['fraudStatus'],
    fraudScore: Number(row.fraud_score ?? 0),
    fraudReason: row.fraud_reason ? String(row.fraud_reason) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function getStoredRelativePath(file?: Express.Multer.File | null) {
  if (!file) {
    return null
  }

  return path.posix.join('transport', path.basename(file.path))
}

async function ensureVehicle(projectId: string, vehicleId: string) {
  const { data, error } = await adminClient
    .from('vehicles')
    .select('id, assigned_driver_user_id')
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

export async function listFuelLogs(query: FuelListQuery): Promise<PaginatedResult<FuelLogRecord>> {
  return listFuelLogsForActor(query, null, new Set<TransportAccessRole>(['LINE_PRODUCER']))
}

export async function listFuelLogsForActor(
  query: FuelListQuery,
  actorUserId: string | null,
  roles: Set<TransportAccessRole>,
): Promise<PaginatedResult<FuelLogRecord>> {
  const { from, to } = rangeFromPagination(query)
  let request = adminClient
    .from('fuel_logs')
    .select('*, vehicle:vehicles(name), logger:users(full_name)', { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query.auditStatus) {
    request = request.eq('audit_status', query.auditStatus)
  }

  if (query.vehicleId) {
    request = request.eq('vehicle_id', query.vehicleId)
  }

  if (query.driverId) {
    request = request.eq('logged_by', query.driverId)
  }

  if (query.dateFrom) {
    request = request.gte('log_date', query.dateFrom)
  }

  if (query.dateTo) {
    request = request.lte('log_date', query.dateTo)
  }

  if (roles.has('DRIVER') && actorUserId && !roles.has('TRANSPORT_CAPTAIN') && !roles.has('LINE_PRODUCER')) {
    request = request.eq('logged_by', actorUserId)
  }

  const { data, error, count } = await request
  if (error) {
    throw error
  }

  return toPaginatedResult((data ?? []).map(item => toFuelLogRecord(item as Record<string, unknown>)), count ?? 0, query)
}

async function insertReceiptRecord(params: {
  projectId: string
  fuelLogId: string
  uploadedBy: string
  receiptFile: Express.Multer.File
  totalAmount?: number
}) {
  const storagePath = getStoredRelativePath(params.receiptFile)
  if (!storagePath) {
    return
  }

  await adminClient.from('receipts').insert({
    project_id: params.projectId,
    fuel_log_id: params.fuelLogId,
    uploaded_by: params.uploadedBy,
    storage_path: storagePath,
    file_name: params.receiptFile.originalname,
    file_mime: params.receiptFile.mimetype,
    file_size_bytes: params.receiptFile.size,
    total_amount: params.totalAmount ?? null,
    extracted_data: {},
  })
}

async function runFraudEvaluation(log: FuelLogRecord) {
  try {
    const assessment = await assessFuelFraud({
      projectId: log.projectId,
      vehicleId: log.vehicleId,
      tripId: log.tripId,
      liters: log.liters,
      expectedMileage: log.expectedMileage,
    })

    const auditStatus = assessment.status === 'NORMAL' ? 'verified' : 'mismatch'
    const { data, error } = await adminClient
      .from('fuel_logs')
      .update({
        actual_mileage: assessment.actualMileage,
        expected_mileage: assessment.expectedMileage,
        fraud_status: assessment.status,
        fraud_score: assessment.score,
        fraud_reason: assessment.reason,
        audit_status: auditStatus,
      })
      .eq('id', log.id)
      .select('*, vehicle:vehicles(name), logger:users(full_name)')
      .single()

    if (error || !data) {
      return
    }

    const updated = toFuelLogRecord(data as Record<string, unknown>)
    if (updated.fraudStatus !== 'NORMAL') {
      const alertType = updated.fraudReason?.toLowerCase().includes('distance')
        ? 'odometer_mismatch'
        : updated.fraudStatus === 'FRAUD'
          ? 'high_fuel_usage'
          : 'low_mileage'
      await createTransportAlert({
        projectId: updated.projectId,
        vehicleId: updated.vehicleId,
        fuelLogId: updated.id,
        tripId: updated.tripId,
        severity: updated.fraudStatus === 'FRAUD' ? 'critical' : 'warning',
        alertType,
        title: updated.fraudStatus === 'FRAUD' ? 'Potential fuel fraud detected' : 'Fuel mismatch detected',
        message: updated.fraudReason ?? 'Fuel variance crossed the review threshold.',
        metadata: {
          fraudStatus: updated.fraudStatus,
          fraudScore: updated.fraudScore,
          actualMileage: updated.actualMileage,
          expectedMileage: updated.expectedMileage,
        },
      })
    }
  } catch {
    return
  }
}

export async function createFuelLog(params: {
  body: FuelCreateBodyInput
  actorUserId: string
  isDriver: boolean
  files?: UploadedFiles
}): Promise<FuelLogRecord> {
  const vehicle = await ensureVehicle(params.body.projectId, params.body.vehicleId)
  if (params.isDriver && vehicle.assigned_driver_user_id && String(vehicle.assigned_driver_user_id) !== params.actorUserId) {
    throw new HttpError(403, 'Drivers can only log fuel for their assigned vehicle.')
  }

  const receiptImage = params.files?.receiptImage?.[0]
  const odometerImage = params.files?.odometerImage?.[0]
  if (!receiptImage || !odometerImage) {
    throw new HttpError(400, 'Receipt image and odometer image are both required.')
  }

  const receiptFilePath = getStoredRelativePath(receiptImage)
  const odometerImagePath = getStoredRelativePath(odometerImage)

  const { data, error } = await adminClient
    .from('fuel_logs')
    .insert({
      project_id: params.body.projectId,
      vehicle_id: params.body.vehicleId,
      trip_id: params.body.tripId ?? null,
      logged_by: params.actorUserId,
      log_date: params.body.logDate ?? new Date().toISOString().slice(0, 10),
      fuel_type: params.body.fuelType,
      litres: params.body.liters,
      odometer_km: params.body.odometerKm ?? null,
      expected_mileage: params.body.expectedMileage ?? null,
      cost_amount: params.body.cost ?? null,
      currency_code: params.body.currencyCode,
      notes: params.body.notes ?? null,
      receipt_file_path: receiptFilePath,
      odometer_image_path: odometerImagePath,
      metadata: {},
    })
    .select('*, vehicle:vehicles(name), logger:users(full_name)')
    .single()

  if (error) {
    throw error
  }

  const record = toFuelLogRecord(data as Record<string, unknown>)
  await insertReceiptRecord({
    projectId: record.projectId,
    fuelLogId: record.id,
    uploadedBy: params.actorUserId,
    receiptFile: receiptImage,
    totalAmount: record.cost ?? undefined,
  })

  emitTransportEvent('fuel_logged', {
    projectId: record.projectId,
    entityId: record.id,
    type: 'fuel_logged',
    data: record,
  })

  void runFraudEvaluation(record)
  return record
}

export async function reviewFuelLog(fuelLogId: string, input: FuelReviewInput, actorUserId: string): Promise<FuelLogRecord> {
  const { data, error } = await adminClient
    .from('fuel_logs')
    .update({
      audit_status: input.auditStatus,
      reviewed_by: actorUserId,
      reviewed_at: new Date().toISOString(),
      approval_note: input.approvalNote ?? null,
    })
    .eq('id', fuelLogId)
    .eq('project_id', input.projectId)
    .select('*, vehicle:vehicles(name), logger:users(full_name)')
    .single()

  if (error) {
    throw error
  }

  const record = toFuelLogRecord(data as Record<string, unknown>)

  emitTransportEvent('fuel_logged', {
    projectId: record.projectId,
    entityId: record.id,
    type: 'fuel_reviewed',
    data: record,
  })

  return record
}
