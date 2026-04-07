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
import { validateOdometerImage } from './transportOcr.service'
import { runReceiptOcr, extractAmount, extractQuantity } from '../modules/art/services/ocrService'

type UploadedFiles = Partial<Record<'receiptImage' | 'odometerImage', Express.Multer.File[]>>
const ODOMETER_OCR_MARGIN_KM = Math.min(10, Math.max(5, Number(process.env.TRANSPORT_ODOMETER_OCR_MARGIN_KM ?? 7)))
const RECEIPT_OCR_TOLERANCE_RATIO = Math.min(0.1, Math.max(0.05, Number(process.env.TRANSPORT_RECEIPT_OCR_TOLERANCE_RATIO ?? 0.08)))

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isMissingDatabaseResourceError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : isObject(error) && typeof error.message === 'string'
      ? error.message
      : ''

  const details = isObject(error) && typeof error.details === 'string'
    ? error.details
    : ''

  const combined = `${message} ${details}`.toLowerCase()
  return combined.includes('does not exist') || combined.includes('relation') || combined.includes('schema cache')
}

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

async function hydrateFuelLogRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return rows
  }

  const vehicleIds = Array.from(new Set(
    rows
      .map(row => toOptionalString(row.vehicle_id))
      .filter((value): value is string => Boolean(value)),
  ))
  const loggerIds = Array.from(new Set(
    rows
      .map(row => toOptionalString(row.logged_by))
      .filter((value): value is string => Boolean(value)),
  ))

  const [vehicleLookupResult, loggerLookupResult] = await Promise.allSettled([
    (async () => {
      if (vehicleIds.length === 0) {
        return new Map<string, string>()
      }

      try {
        const { data, error } = await adminClient
          .from('vehicles')
          .select('id, name')
          .in('id', vehicleIds)

        if (error) {
          throw error
        }

        return new Map(
          (data ?? []).map(item => [String(item.id), typeof item.name === 'string' ? item.name : 'Vehicle']),
        )
      } catch (error) {
        console.warn('[transport][fuel][list] vehicle lookup unavailable', {
          error: error instanceof Error ? error.message : error,
        })
        return new Map<string, string>()
      }
    })(),
    (async () => {
      if (loggerIds.length === 0) {
        return new Map<string, string>()
      }

      try {
        const { data, error } = await adminClient
          .from('users')
          .select('id, full_name')
          .in('id', loggerIds)

        if (error) {
          throw error
        }

        return new Map(
          (data ?? []).map(item => [String(item.id), typeof item.full_name === 'string' ? item.full_name : '']),
        )
      } catch (error) {
        console.warn('[transport][fuel][list] user lookup unavailable', {
          error: error instanceof Error ? error.message : error,
        })
        return new Map<string, string>()
      }
    })(),
  ])

  const vehicleLookup = vehicleLookupResult.status === 'fulfilled' ? vehicleLookupResult.value : new Map<string, string>()
  const loggerLookup = loggerLookupResult.status === 'fulfilled' ? loggerLookupResult.value : new Map<string, string>()

  return rows.map(row => {
    const vehicleId = toOptionalString(row.vehicle_id)
    const loggerId = toOptionalString(row.logged_by)
    const existingVehicle = isObject(row.vehicle) ? row.vehicle : null
    const existingLogger = isObject(row.logger) ? row.logger : null

    return {
      ...row,
      vehicle: {
        ...(existingVehicle ?? {}),
        name: toOptionalString(existingVehicle?.name) ?? (vehicleId ? vehicleLookup.get(vehicleId) ?? 'Vehicle' : 'Vehicle'),
      },
      logger: loggerId
        ? {
          ...(existingLogger ?? {}),
          full_name: toOptionalString(existingLogger?.full_name) ?? loggerLookup.get(loggerId) ?? null,
        }
        : existingLogger,
    }
  })
}

async function fetchFuelLogById(fuelLogId: string, projectId?: string) {
  let request = adminClient
    .from('fuel_logs')
    .select('*')
    .eq('id', fuelLogId)

  if (projectId) {
    request = request.eq('project_id', projectId)
  }

  const { data, error } = await request.maybeSingle()
  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const [hydratedRow] = await hydrateFuelLogRows([data as Record<string, unknown>])
  return toFuelLogRecord(hydratedRow)
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
    .select('*', { count: 'exact' })
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
    if (isMissingDatabaseResourceError(error)) {
      console.warn('[transport][fuel][list] fuel_logs unavailable, returning empty data', {
        projectId: query.projectId,
        error: error instanceof Error ? error.message : error,
      })
      return toPaginatedResult([], 0, query)
    }

    throw error
  }

  const hydratedRows = await hydrateFuelLogRows((data ?? []) as Record<string, unknown>[])
  return toPaginatedResult(hydratedRows.map(item => toFuelLogRecord(item)), count ?? 0, query)
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

  try {
    const { error } = await adminClient.from('receipts').insert({
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

    if (error) {
      throw error
    }
  } catch (error) {
    console.warn('[transport][fuel][create] receipt record insert skipped', {
      fuelLogId: params.fuelLogId,
      error: error instanceof Error ? error.message : error,
    })
  }
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
    const { error } = await adminClient
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

    if (error) {
      return
    }

    const updated = await fetchFuelLogById(log.id, log.projectId)
    if (!updated) {
      return
    }

    if (updated.fraudStatus !== 'NORMAL') {
      const alertType = updated.fraudReason?.toLowerCase().includes('distance')
        ? 'odometer_mismatch'
        : updated.fraudStatus === 'FRAUD'
          ? 'high_fuel_usage'
          : 'fuel_mismatch'
      await createTransportAlert({
        projectId: updated.projectId,
        vehicleId: updated.vehicleId,
        fuelLogId: updated.id,
        tripId: updated.tripId,
        requestedBy: updated.loggedBy,
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

async function runFuelOcrValidation(params: {
  record: FuelLogRecord
  receiptImage: Express.Multer.File
  odometerImage: Express.Multer.File
  manualCost: number | null
  manualLiters: number | null
  manualOdometerKm: number | null
}) {
  const [receiptResult, odometerValidation] = await Promise.allSettled([
    runReceiptOcr(params.receiptImage, {
      manualAmount: params.manualCost ?? undefined,
      manualQuantity: params.manualLiters ?? undefined,
    }),
    validateOdometerImage({
      file: params.odometerImage,
      manualOdometerKm: params.manualOdometerKm,
      marginKm: ODOMETER_OCR_MARGIN_KM,
    }),
  ])

  const receiptValidation = receiptResult.status === 'fulfilled'
    ? (() => {
      const extractedCost = params.manualCost != null
        ? extractAmount(receiptResult.value.text, params.manualCost)
        : (receiptResult.value.extractedAmount || 0)
      const extractedLiters = params.manualLiters != null
        ? extractQuantity(receiptResult.value.text, params.manualLiters)
        : receiptResult.value.extractedQuantity
      const allowedCostDelta = params.manualCost != null ? Math.max(1, params.manualCost * RECEIPT_OCR_TOLERANCE_RATIO) : null
      const allowedLitersDelta = params.manualLiters != null ? Math.max(0.5, params.manualLiters * RECEIPT_OCR_TOLERANCE_RATIO) : null
      const costDelta = params.manualCost != null && extractedCost > 0 ? Math.abs(extractedCost - params.manualCost) : null
      const litersDelta = params.manualLiters != null && extractedLiters != null ? Math.abs(extractedLiters - params.manualLiters) : null
      const flagged = (costDelta != null && allowedCostDelta != null && costDelta > allowedCostDelta)
        || (litersDelta != null && allowedLitersDelta != null && litersDelta > allowedLitersDelta)

      return {
        success: receiptResult.value.success,
        text: receiptResult.value.text,
        previewText: receiptResult.value.previewText,
        extractedCost: extractedCost > 0 ? extractedCost : null,
        extractedLiters,
        manualCost: params.manualCost,
        manualLiters: params.manualLiters,
        costDelta,
        litersDelta,
        allowedCostDelta,
        allowedLitersDelta,
        flagged,
        errorMessage: receiptResult.value.errorMessage,
        extractionSource: 'tesseract' as const,
      }
    })()
    : {
      success: false,
      text: '',
      previewText: 'OCR processing failed.',
      extractedCost: null,
      extractedLiters: null,
      manualCost: params.manualCost,
      manualLiters: params.manualLiters,
      costDelta: null,
      litersDelta: null,
      allowedCostDelta: params.manualCost != null ? Math.max(1, params.manualCost * RECEIPT_OCR_TOLERANCE_RATIO) : null,
      allowedLitersDelta: params.manualLiters != null ? Math.max(0.5, params.manualLiters * RECEIPT_OCR_TOLERANCE_RATIO) : null,
      flagged: false,
      errorMessage: receiptResult.reason instanceof Error ? receiptResult.reason.message : 'OCR processing failed.',
      extractionSource: 'tesseract' as const,
    }

  const odometerResult = odometerValidation.status === 'fulfilled'
    ? odometerValidation.value
    : {
      success: false,
      text: '',
      previewText: 'OCR processing failed.',
      extractedOdometerKm: null,
      manualOdometerKm: params.manualOdometerKm,
      deltaKm: null,
      marginKm: ODOMETER_OCR_MARGIN_KM,
      withinMargin: null,
      flagged: false,
      errorMessage: odometerValidation.reason instanceof Error ? odometerValidation.reason.message : 'OCR processing failed.',
      extractionSource: 'tesseract' as const,
    }

  const nextMetadata = {
    ...params.record.metadata,
    receiptValidation,
    odometerValidation: odometerResult,
    ocrStatus: 'completed',
  }

  await adminClient
    .from('fuel_logs')
    .update({
      metadata: nextMetadata,
    })
    .eq('project_id', params.record.projectId)
    .eq('id', params.record.id)

  if (odometerResult.flagged && odometerResult.deltaKm != null) {
    await createTransportAlert({
      projectId: params.record.projectId,
      vehicleId: params.record.vehicleId,
      fuelLogId: params.record.id,
      tripId: params.record.tripId,
      requestedBy: params.record.loggedBy,
      severity: 'warning',
      alertType: 'odometer_mismatch',
      title: 'Fuel log odometer mismatch',
      message: `OCR extracted ${odometerResult.extractedOdometerKm ?? 'an unreadable'} km while the manual entry was ${odometerResult.manualOdometerKm ?? 'not provided'} km.`,
      metadata: {
        odometerValidation: odometerResult,
      },
    })
  }

  if (receiptValidation.flagged) {
    await createTransportAlert({
      projectId: params.record.projectId,
      vehicleId: params.record.vehicleId,
      fuelLogId: params.record.id,
      tripId: params.record.tripId,
      requestedBy: params.record.loggedBy,
      severity: 'warning',
      alertType: 'fuel_mismatch',
      title: 'Possible fuel fraud',
      message: 'Receipt OCR differs from the entered litres or cost beyond the allowed tolerance.',
      metadata: {
        receiptValidation,
      },
    })
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
      metadata: {
        ocrStatus: 'processing',
      },
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(500, 'Fuel log was created but no record was returned.')
  }

  const record = await fetchFuelLogById(String((data as Record<string, unknown>).id), params.body.projectId)
  if (!record) {
    throw new HttpError(500, 'Fuel log was created but could not be loaded.')
  }

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

  void runFuelOcrValidation({
    record,
    receiptImage,
    odometerImage,
    manualCost: params.body.cost ?? null,
    manualLiters: params.body.liters ?? null,
    manualOdometerKm: params.body.odometerKm ?? null,
  }).catch(error => {
    console.warn('[transport][fuel][ocr] async validation failed', {
      projectId: record.projectId,
      fuelLogId: record.id,
      error: error instanceof Error ? error.message : error,
    })
  })

  void runFraudEvaluation(record)
  return record
}

export async function reviewFuelLog(fuelLogId: string, input: FuelReviewInput, actorUserId: string): Promise<FuelLogRecord> {
  const { error } = await adminClient
    .from('fuel_logs')
    .update({
      audit_status: input.auditStatus,
      reviewed_by: actorUserId,
      reviewed_at: new Date().toISOString(),
      approval_note: input.approvalNote ?? null,
    })
    .eq('id', fuelLogId)
    .eq('project_id', input.projectId)

  if (error) {
    throw error
  }

  const record = await fetchFuelLogById(fuelLogId, input.projectId)
  if (!record) {
    throw new HttpError(404, 'Fuel log not found.')
  }

  emitTransportEvent('fuel_logged', {
    projectId: record.projectId,
    entityId: record.id,
    type: 'fuel_reviewed',
    data: record,
  })

  return record
}
