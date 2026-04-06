import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { HttpError } from '../../utils/httpError'
import type {
  CameraDamageCreateInput,
  CameraRequestCreateInput,
  CameraRequestUpdateInput,
  CameraScanInput,
  CameraWishlistCreateInput,
  CameraWishlistUpdateInput,
} from './camera.schemas'
import type {
  CameraAlertRecord,
  CameraApprovalStage,
  CameraAssetLogRecord,
  CameraIssueType,
  CameraLogStatus,
  CameraRequestRecord,
  CameraRequestStatus,
  CameraWishlistCategory,
  CameraWishlistRecord,
  DamageReportRecord,
} from './camera.types'

const CAMERA_EVENT_TYPES = ['camera_checkin', 'camera_checkout'] as const
const WISHLIST_SNAPSHOT_TYPE = 'wishlist_item'
const REQUEST_METADATA_TYPE = 'camera_request'
const DAMAGE_ENTITY = 'camera_damage_report'
const DAMAGE_CONTEXT_TYPE = 'damage_report'

type DbRow = Record<string, unknown>

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : value != null ? Number(value) : null
}

function asObject(value: unknown): DbRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as DbRow : {}
}

function isUuid(value: string | undefined | null) {
  if (!value) {
    return false
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function logMetadata(row: DbRow) {
  return asObject(row.metadata)
}

function snapshot(row: DbRow) {
  return asObject(row.snapshot)
}

function requestWorkflowStatus(row: DbRow): CameraRequestStatus {
  const metadata = asObject(row.metadata)
  const workflowStatus = asString(metadata.workflowStatus)

  if (workflowStatus === 'pending_dop' || workflowStatus === 'pending_producer' || workflowStatus === 'approved' || workflowStatus === 'rejected') {
    return workflowStatus
  }

  const baseStatus = asString(row.status)
  if (baseStatus === 'approved') return 'approved'
  if (baseStatus === 'rejected') return 'rejected'
  return 'pending_dop'
}

async function loadUserNames(userIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))]
  if (uniqueIds.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name')
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [String(row.id), asString(row.full_name) ?? 'ProdSync User']),
  )
}

async function loadAssetNames(projectId: string, assetIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(assetIds.filter((assetId): assetId is string => Boolean(assetId)))]
  if (uniqueIds.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await adminClient
    .from('assets')
    .select('id, name')
    .eq('project_id', projectId)
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [String(row.id), asString(row.name) ?? 'Unnamed Asset']),
  )
}

function toWishlistRecord(row: DbRow, userNames: Map<string, string>): CameraWishlistRecord {
  const item = snapshot(row)
  const createdById = asString(row.generated_by)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemName: asString(item.itemName) ?? asString(row.title) ?? 'Unnamed item',
    category: (asString(item.category) ?? 'camera') as CameraWishlistCategory,
    vendorName: asString(item.vendorName),
    estimatedRate: asNumber(item.estimatedRate),
    quantity: Number(item.quantity ?? 1),
    createdById,
    createdByName: createdById ? userNames.get(createdById) ?? 'ProdSync User' : null,
    createdAt: String(row.created_at),
    updatedAt: asString(item.updatedAt),
  }
}

function toRequestRecord(row: DbRow, userNames: Map<string, string>): CameraRequestRecord {
  const metadata = asObject(row.metadata)
  const requestedById = asString(row.requested_by)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemName: asString(row.request_title) ?? 'Unnamed request',
    quantity: Number(metadata.quantity ?? 1),
    requestedById,
    requestedByName: requestedById ? userNames.get(requestedById) ?? 'ProdSync User' : null,
    department: asString(row.department) ?? 'camera',
    status: requestWorkflowStatus(row),
    notes: asString(metadata.notes) ?? asString(row.request_description),
    createdAt: asString(row.submitted_at) ?? String(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function toAssetLogRecord(row: DbRow, userNames: Map<string, string>, assetNames: Map<string, string>): CameraAssetLogRecord {
  const metadata = logMetadata(row)
  const scannedById = asString(row.actor_user_id)
  const assetId = String(row.asset_id)
  const checkInTime = asString(metadata.checkInTime)
  const checkOutTime = asString(metadata.checkOutTime)
  const status = (asString(metadata.status)
    ?? (asString(row.event_type) === 'camera_checkout' ? 'checked_out' : 'checked_in')) as CameraLogStatus

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    assetId,
    assetName: asString(metadata.assetName) ?? assetNames.get(assetId) ?? 'Unnamed Asset',
    checkInTime,
    checkOutTime,
    scannedById,
    scannedByName: scannedById ? userNames.get(scannedById) ?? 'ProdSync User' : null,
    status,
    notes: asString(row.notes),
    createdAt: String(row.created_at),
  }
}

function toDamageReportRecord(row: DbRow, userNames: Map<string, string>, assetNames: Map<string, string>): DamageReportRecord {
  const context = asObject(row.context)
  const reportedById = asString(row.user_id)
  const assetId = asString(context.assetId)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    assetId,
    assetName: asString(context.assetName) ?? asString(row.entity_label) ?? (assetId ? assetNames.get(assetId) : null) ?? 'Unnamed Asset',
    issueType: (asString(context.issueType) ?? 'damaged') as CameraIssueType,
    reportedById,
    reportedByName: reportedById ? userNames.get(reportedById) ?? 'ProdSync User' : null,
    imageUrl: asString(context.imageUrl),
    notes: asString(context.notes),
    createdAt: String(row.created_at),
  }
}

function generateAssetCode(seed: string) {
  const slug = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'CAM'

  return `${slug}-${randomUUID().slice(0, 8).toUpperCase()}`
}

async function findAssetByReference(projectId: string, reference: string) {
  if (isUuid(reference)) {
    const { data, error } = await adminClient
      .from('assets')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('id', reference)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      return data as DbRow
    }
  }

  const byAssetCode = await adminClient
    .from('assets')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('asset_code', reference)
    .maybeSingle()

  if (byAssetCode.error) {
    throw byAssetCode.error
  }

  if (byAssetCode.data) {
    return byAssetCode.data as DbRow
  }

  const bySerial = await adminClient
    .from('assets')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('serial_number', reference)
    .maybeSingle()

  if (bySerial.error) {
    throw bySerial.error
  }

  return (bySerial.data ?? null) as DbRow | null
}

async function ensureAsset(projectId: string, assetName: string, assetReference?: string | null) {
  if (assetReference) {
    const existingByReference = await findAssetByReference(projectId, assetReference)
    if (existingByReference) {
      return {
        id: String(existingByReference.id),
        name: asString(existingByReference.name) ?? assetName,
      }
    }
  }

  const { data: existingByName, error: existingByNameError } = await adminClient
    .from('assets')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('name', assetName)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingByNameError) {
    throw existingByNameError
  }

  if (existingByName && existingByName[0]) {
    return {
      id: String(existingByName[0].id),
      name: asString(existingByName[0].name) ?? assetName,
    }
  }

  const { data: createdAsset, error: createAssetError } = await adminClient
    .from('assets')
    .insert({
      project_id: projectId,
      department: 'camera',
      asset_code: assetReference?.trim() || generateAssetCode(assetName),
      name: assetName,
      category: 'camera',
      status: 'available',
      metadata: {
        source: 'camera-module',
      },
    })
    .select('id, name')
    .single()

  if (createAssetError) {
    throw createAssetError
  }

  return {
    id: String(createdAsset.id),
    name: asString(createdAsset.name) ?? assetName,
  }
}

function assertRequestTransition(currentStatus: CameraRequestStatus, nextStatus: CameraRequestStatus, approvalStage: CameraApprovalStage) {
  if (currentStatus === 'approved' || currentStatus === 'rejected') {
    throw new HttpError(409, 'This request has already been finalized.')
  }

  if (currentStatus === 'pending_dop') {
    if (nextStatus === 'pending_producer' || nextStatus === 'rejected') {
      return
    }

    throw new HttpError(409, 'Pending DOP requests can only move to producer review or rejection.')
  }

  if (currentStatus === 'pending_producer') {
    if (approvalStage !== 'producer') {
      throw new HttpError(403, 'Only production leadership can finalize camera requests.')
    }

    if (nextStatus === 'approved' || nextStatus === 'rejected') {
      return
    }

    throw new HttpError(409, 'Pending producer requests can only be approved or rejected.')
  }
}

async function findWishlistSnapshot(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('report_snapshots')
    .select('id, project_id, generated_by, title, snapshot, created_at')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || asString(snapshot(data as DbRow).cameraModuleType) !== WISHLIST_SNAPSHOT_TYPE) {
    throw new HttpError(404, 'Wishlist item not found.')
  }

  return data as DbRow
}

async function findCameraRequestApproval(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('approvals')
    .select('*')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const metadata = data ? asObject((data as DbRow).metadata) : {}
  if (!data || (asString(metadata.cameraModuleType) !== REQUEST_METADATA_TYPE && asString((data as DbRow).approvable_table) !== 'camera_requests')) {
    throw new HttpError(404, 'Camera request not found.')
  }

  return data as DbRow
}

async function findActiveAssetLog(projectId: string, assetId: string) {
  const { data, error } = await adminClient
    .from('asset_logs')
    .select('id, project_id, asset_id, actor_user_id, event_type, notes, metadata, created_at')
    .eq('project_id', projectId)
    .eq('asset_id', assetId)
    .in('event_type', [...CAMERA_EVENT_TYPES])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw error
  }

  const rows = (data ?? []) as DbRow[]
  return rows.find(row => {
    const metadata = logMetadata(row)
    const status = asString(metadata.status) ?? (asString(row.event_type) === 'camera_checkout' ? 'checked_out' : 'checked_in')
    return status === 'checked_in'
  }) ?? null
}

export async function listCameraWishlist(projectId: string): Promise<CameraWishlistRecord[]> {
  const { data, error } = await adminClient
    .from('report_snapshots')
    .select('id, project_id, generated_by, title, snapshot, created_at')
    .eq('project_id', projectId)
    .eq('report_type', 'custom')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const rows = ((data ?? []) as DbRow[]).filter(row => asString(snapshot(row).cameraModuleType) === WISHLIST_SNAPSHOT_TYPE)
  const userNames = await loadUserNames(rows.map(row => asString(row.generated_by)))

  return rows.map(row => toWishlistRecord(row, userNames))
}

export async function createCameraWishlistItem(input: CameraWishlistCreateInput, createdBy: string | null): Promise<CameraWishlistRecord> {
  const updatedAt = new Date().toISOString()
  const { data, error } = await adminClient
    .from('report_snapshots')
    .insert({
      project_id: input.projectId,
      report_type: 'custom',
      generated_by: createdBy,
      title: input.itemName,
      snapshot: {
        cameraModuleType: WISHLIST_SNAPSHOT_TYPE,
        itemName: input.itemName,
        category: input.category,
        vendorName: input.vendorName?.trim() || null,
        estimatedRate: input.estimatedRate ?? null,
        quantity: input.quantity,
        updatedAt,
      },
    })
    .select('id, project_id, generated_by, title, snapshot, created_at')
    .single()

  if (error) {
    throw error
  }

  const userNames = await loadUserNames([createdBy])
  return toWishlistRecord(data as DbRow, userNames)
}

export async function updateCameraWishlistItem(id: string, input: CameraWishlistUpdateInput): Promise<CameraWishlistRecord> {
  const existing = await findWishlistSnapshot(input.projectId, id)
  const current = snapshot(existing)
  const nextSnapshot = {
    ...current,
    cameraModuleType: WISHLIST_SNAPSHOT_TYPE,
    itemName: input.itemName ?? asString(current.itemName) ?? asString(existing.title) ?? 'Unnamed item',
    category: input.category ?? (asString(current.category) ?? 'camera'),
    vendorName: input.vendorName !== undefined ? input.vendorName?.trim() || null : asString(current.vendorName),
    estimatedRate: input.estimatedRate !== undefined ? input.estimatedRate ?? null : asNumber(current.estimatedRate),
    quantity: input.quantity ?? Number(current.quantity ?? 1),
    updatedAt: new Date().toISOString(),
  }

  const { data, error } = await adminClient
    .from('report_snapshots')
    .update({
      title: String(nextSnapshot.itemName),
      snapshot: nextSnapshot,
    })
    .eq('id', id)
    .eq('project_id', input.projectId)
    .select('id, project_id, generated_by, title, snapshot, created_at')
    .single()

  if (error) {
    throw error
  }

  const userNames = await loadUserNames([asString((data as DbRow).generated_by)])
  return toWishlistRecord(data as DbRow, userNames)
}

export async function deleteCameraWishlistItem(id: string, projectId: string): Promise<void> {
  await findWishlistSnapshot(projectId, id)

  const { error } = await adminClient
    .from('report_snapshots')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId)

  if (error) {
    throw error
  }
}

export async function listCameraRequests(projectId: string): Promise<CameraRequestRecord[]> {
  const { data, error } = await adminClient
    .from('approvals')
    .select('*')
    .eq('project_id', projectId)
    .eq('department', 'camera')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const rows = ((data ?? []) as DbRow[]).filter(row => {
    const metadata = asObject(row.metadata)
    return asString(metadata.cameraModuleType) === REQUEST_METADATA_TYPE || asString(row.approvable_table) === 'camera_requests'
  })
  const userNames = await loadUserNames(rows.map(row => asString(row.requested_by)))

  return rows.map(row => toRequestRecord(row, userNames))
}

export async function createCameraRequest(input: CameraRequestCreateInput, requestedBy: string | null): Promise<CameraRequestRecord> {
  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from('approvals')
    .insert({
      project_id: input.projectId,
      type: 'other',
      department: 'camera',
      requested_by: requestedBy,
      request_title: input.itemName,
      request_description: input.notes?.trim() || null,
      status: 'pending',
      approvable_table: 'camera_requests',
      metadata: {
        cameraModuleType: REQUEST_METADATA_TYPE,
        workflowStatus: 'pending_dop',
        quantity: input.quantity,
        notes: input.notes?.trim() || null,
        createdAt: now,
      },
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const userNames = await loadUserNames([requestedBy])
  return toRequestRecord(data as DbRow, userNames)
}

export async function updateCameraRequestStatus(
  id: string,
  input: CameraRequestUpdateInput,
  approvalStage: CameraApprovalStage,
  actedBy: string | null,
): Promise<CameraRequestRecord> {
  const existing = await findCameraRequestApproval(input.projectId, id)
  const currentStatus = requestWorkflowStatus(existing)
  assertRequestTransition(currentStatus, input.status, approvalStage)

  const currentMetadata = asObject(existing.metadata)
  const nextBaseStatus = asString(existing.status) ?? 'pending'
  const now = new Date().toISOString()

  const { data, error } = await adminClient
    .from('approvals')
    .update({
      status: nextBaseStatus,
      approved_by: input.status === 'approved' || input.status === 'rejected' ? actedBy : asString(existing.approved_by),
      approved_at: input.status === 'approved' ? now : null,
      rejected_at: input.status === 'rejected' ? now : null,
      request_description: input.notes !== undefined ? input.notes?.trim() || null : asString(existing.request_description),
      rejection_reason: input.status === 'rejected' ? input.notes?.trim() || null : null,
      metadata: {
        ...currentMetadata,
        cameraModuleType: REQUEST_METADATA_TYPE,
        workflowStatus: input.status,
        quantity: Number(currentMetadata.quantity ?? 1),
        notes: input.notes !== undefined ? input.notes?.trim() || null : asString(currentMetadata.notes) ?? asString(existing.request_description),
        updatedAt: now,
        actedBy,
      },
    })
    .eq('id', id)
    .eq('project_id', input.projectId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const userNames = await loadUserNames([asString((data as DbRow).requested_by)])
  return toRequestRecord(data as DbRow, userNames)
}

export async function listCameraLogs(projectId: string): Promise<CameraAssetLogRecord[]> {
  const { data, error } = await adminClient
    .from('asset_logs')
    .select('id, project_id, asset_id, actor_user_id, event_type, notes, metadata, created_at')
    .eq('project_id', projectId)
    .in('event_type', [...CAMERA_EVENT_TYPES])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw error
  }

  const rows = (data ?? []) as DbRow[]
  const userNames = await loadUserNames(rows.map(row => asString(row.actor_user_id)))
  const assetNames = await loadAssetNames(projectId, rows.map(row => asString(row.asset_id)))

  return rows.map(row => toAssetLogRecord(row, userNames, assetNames))
}

export async function createCameraCheckin(input: CameraScanInput, scannedBy: string | null): Promise<CameraAssetLogRecord> {
  const asset = await ensureAsset(input.projectId, input.assetName, input.assetId)
  const activeLog = await findActiveAssetLog(input.projectId, asset.id)

  if (activeLog) {
    throw new HttpError(409, 'This asset is already checked in.')
  }

  const metadata = {
    module: 'camera',
    assetName: asset.name,
    checkInTime: new Date().toISOString(),
    checkOutTime: null,
    status: 'checked_in',
  }

  const { data, error } = await adminClient
    .from('asset_logs')
    .insert({
      project_id: input.projectId,
      asset_id: asset.id,
      actor_user_id: scannedBy,
      event_type: 'camera_checkin',
      notes: input.notes?.trim() || null,
      metadata,
    })
    .select('id, project_id, asset_id, actor_user_id, event_type, notes, metadata, created_at')
    .single()

  if (error) {
    throw error
  }

  await adminClient
    .from('assets')
    .update({ status: 'available' })
    .eq('id', asset.id)
    .eq('project_id', input.projectId)

  const userNames = await loadUserNames([scannedBy])
  const assetNames = await loadAssetNames(input.projectId, [asset.id])

  return toAssetLogRecord(data as DbRow, userNames, assetNames)
}

export async function createCameraCheckout(input: CameraScanInput, scannedBy: string | null): Promise<CameraAssetLogRecord> {
  const asset = await ensureAsset(input.projectId, input.assetName, input.assetId)
  const activeLog = await findActiveAssetLog(input.projectId, asset.id)

  if (!activeLog) {
    throw new HttpError(404, 'This asset is not currently checked in.')
  }

  const currentMetadata = logMetadata(activeLog)
  const metadata = {
    ...currentMetadata,
    module: 'camera',
    assetName: asset.name,
    checkInTime: asString(currentMetadata.checkInTime) ?? new Date().toISOString(),
    checkOutTime: new Date().toISOString(),
    status: 'checked_out',
  }

  const { data, error } = await adminClient
    .from('asset_logs')
    .update({
      actor_user_id: scannedBy,
      event_type: 'camera_checkout',
      notes: input.notes !== undefined ? input.notes?.trim() || null : asString(activeLog.notes),
      metadata,
    })
    .eq('id', String(activeLog.id))
    .eq('project_id', input.projectId)
    .select('id, project_id, asset_id, actor_user_id, event_type, notes, metadata, created_at')
    .single()

  if (error) {
    throw error
  }

  await adminClient
    .from('assets')
    .update({ status: 'checked_out' })
    .eq('id', asset.id)
    .eq('project_id', input.projectId)

  const userNames = await loadUserNames([scannedBy])
  const assetNames = await loadAssetNames(input.projectId, [asset.id])

  return toAssetLogRecord(data as DbRow, userNames, assetNames)
}

export async function listDamageReports(projectId: string): Promise<DamageReportRecord[]> {
  const { data, error } = await adminClient
    .from('activity_logs')
    .select('id, project_id, user_id, entity, entity_label, context, created_at')
    .eq('project_id', projectId)
    .eq('entity', DAMAGE_ENTITY)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw error
  }

  const rows = ((data ?? []) as DbRow[]).filter(row => asString(asObject(row.context).cameraModuleType) === DAMAGE_CONTEXT_TYPE)
  const userNames = await loadUserNames(rows.map(row => asString(row.user_id)))
  const assetNames = await loadAssetNames(projectId, rows.map(row => asString(asObject(row.context).assetId)))

  return rows.map(row => toDamageReportRecord(row, userNames, assetNames))
}

export async function createDamageReport(input: CameraDamageCreateInput, reportedBy: string | null): Promise<DamageReportRecord> {
  const asset = await ensureAsset(input.projectId, input.assetName, input.assetId)

  const { data, error } = await adminClient
    .from('activity_logs')
    .insert({
      project_id: input.projectId,
      user_id: reportedBy,
      action: 'reported',
      entity: DAMAGE_ENTITY,
      entity_id: asset.id,
      entity_label: asset.name,
      context: {
        cameraModuleType: DAMAGE_CONTEXT_TYPE,
        assetId: asset.id,
        assetName: asset.name,
        issueType: input.issueType,
        imageUrl: input.imageUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    })
    .select('id, project_id, user_id, entity, entity_label, context, created_at')
    .single()

  if (error) {
    throw error
  }

  const nextAssetStatus = input.issueType === 'lost' ? 'lost' : 'maintenance'
  await adminClient
    .from('assets')
    .update({ status: nextAssetStatus })
    .eq('id', asset.id)
    .eq('project_id', input.projectId)

  const userNames = await loadUserNames([reportedBy])
  const assetNames = await loadAssetNames(input.projectId, [asset.id])

  return toDamageReportRecord(data as DbRow, userNames, assetNames)
}

export async function listCameraAlerts(projectId: string): Promise<CameraAlertRecord[]> {
  const [requests, logs, damageReports] = await Promise.all([
    listCameraRequests(projectId),
    listCameraLogs(projectId),
    listDamageReports(projectId),
  ])

  const alerts: CameraAlertRecord[] = []

  for (const request of requests) {
    if (request.status !== 'pending_dop' && request.status !== 'pending_producer') {
      continue
    }

    alerts.push({
      type: 'warning',
      message: `${request.itemName} is awaiting ${request.status === 'pending_dop' ? 'DOP' : 'producer'} approval.`,
      timestamp: request.createdAt,
    })
  }

  for (const log of logs) {
    if (log.status !== 'checked_in') {
      continue
    }

    alerts.push({
      type: 'warning',
      message: `${log.assetName} is checked in and still open in the movement log.`,
      timestamp: log.checkInTime ?? log.createdAt,
    })
  }

  for (const report of damageReports) {
    alerts.push({
      type: report.issueType === 'lost' ? 'critical' : 'warning',
      message: `${report.assetName} was reported as ${report.issueType.replace(/_/g, ' ')}.`,
      timestamp: report.createdAt,
    })
  }

  return alerts.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
}
