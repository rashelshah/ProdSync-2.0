import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { PaginatedResult } from '../../models/transport.types'
import { bridgeApproval } from '../../services/approvalBridge.service'
import { reverseGeocode } from '../../services/locationService'
import { HttpError } from '../../utils/httpError'
import { createPagination, rangeFromPagination, toPaginatedResult } from '../../utils/pagination'
import {
  deleteStoredUpload,
  extractGeoCoordinates,
  saveUploadedFile,
  validateUploadedFile,
} from './locations.files'
import type {
  CreateLocationCommentInput,
  CreateLocationCostInput,
  CreateLocationInput,
  CreateLocationPermissionInput,
  CreateLocationTimelineInput,
  LocationDocumentUploadInput,
  LocationMediaUploadInput,
  LocationsListQuery,
  UpdateLocationCostInput,
  UpdateLocationInput,
  UpdateLocationPermissionInput,
  UpsertLocationAmenityInput,
} from './locations.schemas'
import type {
  LocationAmenityRecord,
  LocationCommentRecord,
  LocationCostRecord,
  LocationDashboardRecord,
  LocationDetailRecord,
  LocationDocumentRecord,
  LocationMediaRecord,
  LocationPermissionRecord,
  LocationReadinessRecord,
  LocationRecord,
  LocationReportsRecord,
  LocationStatus,
  LocationTimelineEventType,
  LocationTimelineRecord,
} from './locations.types'

type DbRow = Record<string, unknown>

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBoolean(value: unknown) {
  return value === true
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {}
}

function asDateOnly(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue
  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function asIsoTimestamp(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return new Date().toISOString()
  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function normalizeCoordinate(value: number) {
  return Number(value.toFixed(5))
}

function daysRemaining(expiryDate: string | null) {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(`${expiryDate}T00:00:00.000Z`)
  if (Number.isNaN(expiry.getTime())) return null
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
}

function isExpired(expiryDate: string | null) {
  const remaining = daysRemaining(expiryDate)
  return typeof remaining === 'number' && remaining < 0
}

function toCurrencyAmount(value: unknown) {
  return Number((asNumber(value) ?? 0).toFixed(2))
}

function formatPermissionLabel(row: DbRow) {
  const type = asString(row.permission_type) ?? 'custom'
  if (type === 'custom') {
    return asString(row.custom_label) ?? 'Custom Permission'
  }

  return type
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildUploadUrl(storagePath: string | null) {
  return storagePath ? `/uploads/${storagePath}` : ''
}

async function getUserNameMap(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))]
  if (ids.length === 0) return new Map<string, string>()

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, email')
    .in('id', ids)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [
      String(row.id ?? ''),
      asString(row.full_name) ?? asString(row.email) ?? 'ProdSync User',
    ]),
  )
}

async function getApprovalStatusMap(approvalIds: Array<string | null | undefined>) {
  const ids = [...new Set(approvalIds.filter((approvalId): approvalId is string => Boolean(approvalId)))]
  if (ids.length === 0) return new Map<string, string>()

  const { data, error } = await adminClient
    .from('approvals')
    .select('id, status')
    .in('id', ids)

  if (error) {
    throw error
  }

  return new Map(((data ?? []) as DbRow[]).map(row => [String(row.id ?? ''), asString(row.status) ?? 'pending']))
}

async function logLocationAudit(params: {
  projectId: string
  locationId: string | null
  action: string
  entityType: string
  entityId: string | null
  actorUserId: string | null
  beforeState?: unknown
  afterState?: unknown
  entityLabel?: string | null
  metadata?: Record<string, unknown>
}) {
  const metadata = params.metadata ?? {}

  await adminClient.from('location_audit_logs').insert({
    id: randomUUID(),
    project_id: params.projectId,
    location_id: params.locationId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    actor_user_id: params.actorUserId,
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    metadata,
  })

  await adminClient.from('activity_logs').insert({
    id: randomUUID(),
    project_id: params.projectId,
    user_id: params.actorUserId,
    action: params.action,
    entity: params.entityType,
    entity_id: params.entityId,
    entity_label: params.entityLabel ?? params.entityType,
    old_data: params.beforeState ?? null,
    new_data: params.afterState ?? null,
    context: metadata,
  })
}

async function createTimelineEntry(params: {
  projectId: string
  locationId: string
  actorUserId: string | null
  eventType: LocationTimelineEventType
  title: string
  description?: string | null
  eventAt?: string
  metadata?: Record<string, unknown>
}) {
  await adminClient.from('location_timeline').insert({
    id: randomUUID(),
    project_id: params.projectId,
    location_id: params.locationId,
    event_type: params.eventType,
    title: params.title,
    description: params.description ?? null,
    event_at: params.eventAt ?? new Date().toISOString(),
    created_by: params.actorUserId,
    metadata: params.metadata ?? {},
  })
}

async function ensureLocation(projectId: string, locationId: string) {
  const { data, error } = await adminClient
    .from('locations')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', locationId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Location not found.')
  }

  return data as DbRow
}

async function getCachedReverseAddress(projectId: string, latitude: number, longitude: number) {
  const normalizedLatitude = normalizeCoordinate(latitude)
  const normalizedLongitude = normalizeCoordinate(longitude)
  const cacheKey = `reverse:${normalizedLatitude}:${normalizedLongitude}`

  const { data, error } = await adminClient
    .from('location_geo_cache')
    .select('payload, expires_at')
    .eq('project_id', projectId)
    .eq('cache_kind', 'reverse_geocode')
    .eq('cache_key', cacheKey)
    .maybeSingle()

  if (error) {
    throw error
  }

  const expiresAt = asString(asObject(data).expires_at)
  if (data && (!expiresAt || new Date(expiresAt).getTime() > Date.now())) {
    return asString(asObject(asObject(data).payload).address)
  }

  const result = await reverseGeocode(latitude, longitude, 'MEMBER')
  const nextPayload = {
    address: result.address,
    sourceProvider: result.sourceProvider,
    provider: result.provider,
    cacheHit: result.cacheHit,
  }

  await adminClient
    .from('location_geo_cache')
    .upsert({
      id: randomUUID(),
      project_id: projectId,
      cache_key: cacheKey,
      cache_kind: 'reverse_geocode',
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      provider: result.sourceProvider,
      payload: nextPayload,
      expires_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
    }, { onConflict: 'cache_key' })

  return result.address
}

function mapReadinessRow(row: DbRow): LocationReadinessRecord {
  return {
    recceComplete: asBoolean(row.recce_complete),
    permissionsComplete: asBoolean(row.permissions_complete),
    amenitiesAdded: asBoolean(row.amenities_added),
    documentsUploaded: asBoolean(row.documents_uploaded),
    readinessScore: Number(row.readiness_score ?? 0),
    readinessStatus: (asString(row.readiness_status) ?? 'not_ready') as LocationReadinessRecord['readinessStatus'],
    summary: asString(row.summary) ?? 'Location readiness has not been calculated yet.',
    updatedAt: asIsoTimestamp(row.updated_at),
  }
}

function mapLocationRow(
  row: DbRow,
  readiness: LocationReadinessRecord | null,
  metrics: {
    mediaCount: number
    documentCount: number
    permissionCount: number
    approvedPermissionCount: number
    commentCount: number
    totalCost: number
  },
): LocationRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    name: asString(row.name) ?? '',
    address: asString(row.address) ?? '',
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    locationType: (asString(row.location_type) ?? 'private') as LocationRecord['locationType'],
    shootStartDate: asDateOnly(row.shoot_start_date),
    shootEndDate: asDateOnly(row.shoot_end_date),
    riskLevel: (asString(row.risk_level) ?? 'medium') as LocationRecord['riskLevel'],
    status: (asString(row.status) ?? 'draft') as LocationStatus,
    notes: asString(row.notes),
    createdBy: asString(row.created_by),
    updatedBy: asString(row.updated_by),
    createdAt: asIsoTimestamp(row.created_at),
    updatedAt: asIsoTimestamp(row.updated_at),
    readiness,
    metrics,
  }
}

function mapPermissionRow(row: DbRow): LocationPermissionRecord {
  const expiryDate = asDateOnly(row.expiry_date)
  const normalizedStatus = isExpired(expiryDate)
    ? 'expired'
    : (asString(row.status) ?? 'pending')

  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    permissionType: (asString(row.permission_type) ?? 'custom') as LocationPermissionRecord['permissionType'],
    label: formatPermissionLabel(row),
    authorityName: asString(row.authority_name),
    authorityContact: asString(row.authority_contact),
    status: normalizedStatus as LocationPermissionRecord['status'],
    issueDate: asDateOnly(row.issue_date),
    expiryDate,
    daysRemaining: daysRemaining(expiryDate),
    notes: asString(row.notes),
    createdAt: asIsoTimestamp(row.created_at),
    updatedAt: asIsoTimestamp(row.updated_at),
  }
}

function mapAmenityRow(row: DbRow): LocationAmenityRecord {
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    amenityType: (asString(row.amenity_type) ?? 'hospital') as LocationAmenityRecord['amenityType'],
    name: asString(row.name),
    address: asString(row.address),
    phoneNumber: asString(row.phone_number),
    distanceKm: asNumber(row.distance_km),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    mapLink: asString(row.map_link),
    source: (asString(row.source) ?? 'manual') as LocationAmenityRecord['source'],
    updatedAt: asIsoTimestamp(row.updated_at),
  }
}

function mapTimelineRow(row: DbRow, userNames: Map<string, string>): LocationTimelineRecord {
  const createdBy = asString(row.created_by)
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    eventType: (asString(row.event_type) ?? 'custom') as LocationTimelineRecord['eventType'],
    title: asString(row.title) ?? 'Timeline event',
    description: asString(row.description),
    eventAt: asIsoTimestamp(row.event_at),
    createdBy,
    createdByName: createdBy ? (userNames.get(createdBy) ?? 'ProdSync User') : null,
  }
}

function mapCommentRow(row: DbRow, userNames: Map<string, string>): LocationCommentRecord {
  const userId = asString(row.user_id)
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    userId,
    userName: userId ? (userNames.get(userId) ?? 'ProdSync User') : null,
    message: asString(row.message) ?? '',
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapMediaRow(row: DbRow, userNames: Map<string, string>): LocationMediaRecord {
  const uploadedBy = asString(row.uploaded_by)
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    mediaKind: (asString(row.media_kind) ?? 'image') as LocationMediaRecord['mediaKind'],
    originalName: asString(row.original_name) ?? '',
    storedName: asString(row.stored_name) ?? '',
    url: buildUploadUrl(asString(row.storage_path)),
    mimeType: asString(row.mime_type) ?? '',
    fileExt: asString(row.file_ext) ?? '',
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    uploadTime: asIsoTimestamp(row.upload_time),
    notes: asString(row.notes),
    uploadedBy,
    uploadedByName: uploadedBy ? (userNames.get(uploadedBy) ?? 'ProdSync User') : null,
  }
}

function mapDocumentRow(row: DbRow, userNames: Map<string, string>): LocationDocumentRecord {
  const uploadedBy = asString(row.uploaded_by)
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    permissionId: asString(row.permission_id),
    category: asString(row.document_category) ?? 'other',
    originalName: asString(row.original_name) ?? '',
    storedName: asString(row.stored_name) ?? '',
    url: buildUploadUrl(asString(row.storage_path)),
    mimeType: asString(row.mime_type) ?? '',
    fileExt: asString(row.file_ext) ?? '',
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    notes: asString(row.notes),
    uploadedBy,
    uploadedByName: uploadedBy ? (userNames.get(uploadedBy) ?? 'ProdSync User') : null,
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapCostRow(row: DbRow, approvalStatuses: Map<string, string>): LocationCostRecord {
  const approvalId = asString(row.approval_id)
  const approvalStatus = approvalId ? (approvalStatuses.get(approvalId) ?? 'pending') : null
  return {
    id: String(row.id ?? ''),
    locationId: String(row.location_id ?? ''),
    costType: (asString(row.cost_type) ?? 'other') as LocationCostRecord['costType'],
    label: asString(row.label) ?? 'Untitled Cost',
    amount: toCurrencyAmount(row.amount),
    currencyCode: asString(row.currency_code) ?? 'INR',
    approvalRequested: asBoolean(row.approval_requested),
    approvalId,
    approvalStatus: approvalId
      ? (approvalStatus === 'approved' ? 'approved' : approvalStatus === 'rejected' ? 'rejected' : 'pending')
      : 'not_requested',
    notes: asString(row.notes),
    createdAt: asIsoTimestamp(row.created_at),
    updatedAt: asIsoTimestamp(row.updated_at),
  }
}

async function loadReadinessMap(projectId: string, locationIds: string[]) {
  if (locationIds.length === 0) return new Map<string, LocationReadinessRecord>()

  const { data, error } = await adminClient
    .from('location_shoot_readiness')
    .select('*')
    .eq('project_id', projectId)
    .in('location_id', locationIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [
      String(row.location_id ?? ''),
      mapReadinessRow(row),
    ]),
  )
}

async function loadLocationMetrics(projectId: string, locationIds: string[]) {
  const metrics = new Map<string, {
    mediaCount: number
    documentCount: number
    permissionCount: number
    approvedPermissionCount: number
    commentCount: number
    totalCost: number
  }>()

  for (const locationId of locationIds) {
    metrics.set(locationId, {
      mediaCount: 0,
      documentCount: 0,
      permissionCount: 0,
      approvedPermissionCount: 0,
      commentCount: 0,
      totalCost: 0,
    })
  }

  const [mediaRows, documentRows, permissionRows, commentRows, costRows] = await Promise.all([
    adminClient.from('location_media').select('location_id').eq('project_id', projectId).in('location_id', locationIds),
    adminClient.from('location_documents').select('location_id').eq('project_id', projectId).in('location_id', locationIds),
    adminClient.from('location_permissions').select('location_id, status, expiry_date').eq('project_id', projectId).in('location_id', locationIds),
    adminClient.from('location_comments').select('location_id').eq('project_id', projectId).in('location_id', locationIds),
    adminClient.from('location_costs').select('location_id, amount').eq('project_id', projectId).in('location_id', locationIds),
  ])

  const settled = [mediaRows, documentRows, permissionRows, commentRows, costRows]
  for (const result of settled) {
    if (result.error) throw result.error
  }

  for (const row of (mediaRows.data ?? []) as DbRow[]) {
    const locationId = String(row.location_id ?? '')
    const entry = metrics.get(locationId)
    if (entry) entry.mediaCount += 1
  }

  for (const row of (documentRows.data ?? []) as DbRow[]) {
    const locationId = String(row.location_id ?? '')
    const entry = metrics.get(locationId)
    if (entry) entry.documentCount += 1
  }

  for (const row of (permissionRows.data ?? []) as DbRow[]) {
    const locationId = String(row.location_id ?? '')
    const entry = metrics.get(locationId)
    if (!entry) continue
    entry.permissionCount += 1
    const permission = mapPermissionRow(row)
    if (permission.status === 'approved') {
      entry.approvedPermissionCount += 1
    }
  }

  for (const row of (commentRows.data ?? []) as DbRow[]) {
    const locationId = String(row.location_id ?? '')
    const entry = metrics.get(locationId)
    if (entry) entry.commentCount += 1
  }

  for (const row of (costRows.data ?? []) as DbRow[]) {
    const locationId = String(row.location_id ?? '')
    const entry = metrics.get(locationId)
    if (entry) entry.totalCost = Number((entry.totalCost + toCurrencyAmount(row.amount)).toFixed(2))
  }

  return metrics
}

function deriveReadinessState(input: {
  recceComplete: boolean
  permissionsComplete: boolean
  amenitiesAdded: boolean
  documentsUploaded: boolean
}) {
  const readinessScore = [input.recceComplete, input.permissionsComplete, input.amenitiesAdded, input.documentsUploaded].filter(Boolean).length
  const readinessStatus = readinessScore >= 4 ? 'ready' : readinessScore >= 2 ? 'almost_ready' : 'not_ready'
  const summary = readinessStatus === 'ready'
    ? 'Shoot ready. Recce, permissions, amenities, and documents are complete.'
    : readinessStatus === 'almost_ready'
      ? 'Almost ready. A few readiness checks still need attention.'
      : 'Not ready. Core recce, permissions, amenity, or document steps are incomplete.'

  return {
    readinessScore,
    readinessStatus,
    summary,
  } as const
}

async function syncLocationPermissionAlert(projectId: string, permissionRow: DbRow) {
  const permission = mapPermissionRow(permissionRow)
  const alertEligibleStatus = permission.status === 'approved' || permission.status === 'submitted' || permission.status === 'expired'
  const shouldAlert = alertEligibleStatus && permission.expiryDate && permission.daysRemaining !== null && permission.daysRemaining <= 30

  const { data: existing, error: existingError } = await adminClient
    .from('alerts')
    .select('id')
    .eq('project_id', projectId)
    .eq('entity_table', 'location_permissions')
    .eq('entity_id', permission.id)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (!shouldAlert) {
    if (existing?.id) {
      await adminClient
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', String(existing.id))
        .eq('project_id', projectId)
    }
    return
  }

  const severity = permission.status === 'expired' || (permission.daysRemaining ?? 999) <= 7 ? 'critical' : 'warning'
  const title = permission.status === 'expired' ? 'Permission Expired' : 'Permission Expiring Soon'
  const message = permission.status === 'expired'
    ? `${permission.label} has expired for this location.`
    : `${permission.label} expires in ${permission.daysRemaining} day${permission.daysRemaining === 1 ? '' : 's'}.`

  const payload = {
    project_id: projectId,
    source: 'locations',
    severity,
    title,
    message,
    status: 'open',
    entity_table: 'location_permissions',
    entity_id: permission.id,
    metadata: {
      permissionId: permission.id,
      locationId: permission.locationId,
      permissionType: permission.permissionType,
      expiryDate: permission.expiryDate,
      daysRemaining: permission.daysRemaining,
    },
  }

  if (existing?.id) {
    const updateResult = await adminClient.from('alerts').update({
      ...payload,
      acknowledged_at: null,
      acknowledged_by: null,
      resolved_at: null,
      resolved_by: null,
    }).eq('id', String(existing.id))

    if (updateResult.error) throw updateResult.error
    return
  }

  const insertResult = await adminClient.from('alerts').insert(payload)
  if (insertResult.error) throw insertResult.error
}

async function syncLocationReadiness(projectId: string, locationId: string, actorUserId: string | null) {
  const [locationRow, mediaRows, permissionRows, amenityRows, documentRows, readinessCurrent] = await Promise.all([
    ensureLocation(projectId, locationId),
    adminClient.from('location_media').select('id').eq('project_id', projectId).eq('location_id', locationId),
    adminClient.from('location_permissions').select('id, status, expiry_date').eq('project_id', projectId).eq('location_id', locationId),
    adminClient.from('location_amenities').select('amenity_type').eq('project_id', projectId).eq('location_id', locationId),
    adminClient.from('location_documents').select('id').eq('project_id', projectId).eq('location_id', locationId),
    adminClient.from('location_shoot_readiness').select('*').eq('project_id', projectId).eq('location_id', locationId).maybeSingle(),
  ])

  for (const result of [mediaRows, permissionRows, amenityRows, documentRows, readinessCurrent]) {
    if (result.error) throw result.error
  }

  const permissionRecords = ((permissionRows.data ?? []) as DbRow[]).map(mapPermissionRow)
  const amenityTypes = new Set(((amenityRows.data ?? []) as DbRow[]).map(row => asString(row.amenity_type)).filter(Boolean))
  const recceComplete = ((mediaRows.data ?? []) as DbRow[]).length > 0 || (asString(locationRow.status) ?? 'draft') !== 'draft'
  const permissionsComplete = permissionRecords.length > 0 && permissionRecords.every(permission => permission.status === 'approved')
  const amenitiesAdded = amenityTypes.has('hospital') && amenityTypes.has('police_station') && amenityTypes.has('petrol_bunk')
  const documentsUploaded = ((documentRows.data ?? []) as DbRow[]).length > 0
  const nextReadiness = deriveReadinessState({ recceComplete, permissionsComplete, amenitiesAdded, documentsUploaded })

  const currentReadinessRow = readinessCurrent.data as DbRow | null
  const currentReadiness = currentReadinessRow ? mapReadinessRow(currentReadinessRow) : null

  await adminClient
    .from('location_shoot_readiness')
    .upsert({
      id: currentReadinessRow?.id ?? randomUUID(),
      project_id: projectId,
      location_id: locationId,
      recce_complete: recceComplete,
      permissions_complete: permissionsComplete,
      amenities_added: amenitiesAdded,
      documents_uploaded: documentsUploaded,
      readiness_score: nextReadiness.readinessScore,
      readiness_status: nextReadiness.readinessStatus,
      summary: nextReadiness.summary,
      created_by: currentReadinessRow?.created_by ?? actorUserId,
      updated_by: actorUserId,
    }, { onConflict: 'location_id' })

  let nextLocationStatus = (asString(locationRow.status) ?? 'draft') as LocationStatus
  if (nextLocationStatus !== 'completed') {
    if (nextReadiness.readinessStatus === 'ready') {
      nextLocationStatus = 'shoot_ready'
    } else if (recceComplete && !permissionsComplete) {
      nextLocationStatus = 'permissions_pending'
    } else if (recceComplete) {
      nextLocationStatus = 'recce_complete'
    } else {
      nextLocationStatus = 'draft'
    }
  }

  if (nextLocationStatus !== asString(locationRow.status)) {
    const updateResult = await adminClient
      .from('locations')
      .update({
        status: nextLocationStatus,
        updated_by: actorUserId,
      })
      .eq('project_id', projectId)
      .eq('id', locationId)

    if (updateResult.error) throw updateResult.error

    await createTimelineEntry({
      projectId,
      locationId,
      actorUserId,
      eventType: 'status_changed',
      title: 'Location Status Updated',
      description: `Status changed to ${nextLocationStatus.replace(/_/g, ' ')}.`,
    })

    await logLocationAudit({
      projectId,
      locationId,
      actorUserId,
      action: 'status_changed',
      entityType: 'location_status',
      entityId: locationId,
      beforeState: { status: asString(locationRow.status), readiness: currentReadiness },
      afterState: { status: nextLocationStatus, readiness: nextReadiness },
      entityLabel: asString(locationRow.name),
      metadata: { module: 'locations' },
    })
  }
}

export async function listLocations(query: LocationsListQuery): Promise<PaginatedResult<LocationRecord>> {
  const pagination = createPagination(query)
  const { from, to } = rangeFromPagination(pagination)
  let request = adminClient
    .from('locations')
    .select('*', { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query.status) request = request.eq('status', query.status)
  if (query.riskLevel) request = request.eq('risk_level', query.riskLevel)
  if (query.locationType) request = request.eq('location_type', query.locationType)
  if (query.search) {
    request = request.or(`name.ilike.%${query.search}%,address.ilike.%${query.search}%`)
  }

  const { data, error, count } = await request
  if (error) throw error

  const locationRows = (data ?? []) as DbRow[]
  const locationIds = locationRows.map(row => String(row.id ?? ''))
  const [readinessMap, metricsMap] = await Promise.all([
    loadReadinessMap(query.projectId, locationIds),
    loadLocationMetrics(query.projectId, locationIds),
  ])

  const locations = locationRows.map(row => mapLocationRow(
    row,
    readinessMap.get(String(row.id ?? '')) ?? null,
    metricsMap.get(String(row.id ?? '')) ?? {
      mediaCount: 0,
      documentCount: 0,
      permissionCount: 0,
      approvedPermissionCount: 0,
      commentCount: 0,
      totalCost: 0,
    },
  ))

  return toPaginatedResult(locations, count ?? locations.length, pagination)
}

export async function getLocationDetail(projectId: string, locationId: string): Promise<LocationDetailRecord> {
  const locationRow = await ensureLocation(projectId, locationId)

  const [readinessMap, metricsMap, permissionsResult, amenitiesResult, timelineResult, commentsResult, costsResult] = await Promise.all([
    loadReadinessMap(projectId, [locationId]),
    loadLocationMetrics(projectId, [locationId]),
    adminClient.from('location_permissions').select('*').eq('project_id', projectId).eq('location_id', locationId).order('created_at', { ascending: false }),
    adminClient.from('location_amenities').select('*').eq('project_id', projectId).eq('location_id', locationId).order('amenity_type'),
    adminClient.from('location_timeline').select('*').eq('project_id', projectId).eq('location_id', locationId).order('event_at', { ascending: false }),
    adminClient.from('location_comments').select('*').eq('project_id', projectId).eq('location_id', locationId).order('created_at', { ascending: false }),
    adminClient.from('location_costs').select('*').eq('project_id', projectId).eq('location_id', locationId).order('created_at', { ascending: false }),
  ])

  for (const result of [permissionsResult, amenitiesResult, timelineResult, commentsResult, costsResult]) {
    if (result.error) throw result.error
  }

  const timelineRows = (timelineResult.data ?? []) as DbRow[]
  const commentRows = (commentsResult.data ?? []) as DbRow[]
  const costRows = (costsResult.data ?? []) as DbRow[]
  const userNames = await getUserNameMap([
    ...timelineRows.map(row => asString(row.created_by)),
    ...commentRows.map(row => asString(row.user_id)),
  ])
  const approvalStatuses = await getApprovalStatusMap(costRows.map(row => asString(row.approval_id)))

  return {
    location: mapLocationRow(
      locationRow,
      readinessMap.get(locationId) ?? null,
      metricsMap.get(locationId) ?? {
        mediaCount: 0,
        documentCount: 0,
        permissionCount: 0,
        approvedPermissionCount: 0,
        commentCount: 0,
        totalCost: 0,
      },
    ),
    permissions: ((permissionsResult.data ?? []) as DbRow[]).map(mapPermissionRow),
    amenities: ((amenitiesResult.data ?? []) as DbRow[]).map(mapAmenityRow),
    timeline: timelineRows.map(row => mapTimelineRow(row, userNames)),
    comments: commentRows.map(row => mapCommentRow(row, userNames)),
    costs: costRows.map(row => mapCostRow(row, approvalStatuses)),
  }
}

export async function createLocation(input: CreateLocationInput, actorUserId: string | null) {
  let address = input.address
  if ((!address || address.trim().length < 3) && typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    address = await getCachedReverseAddress(input.projectId, input.latitude, input.longitude)
  }

  const { data, error } = await adminClient
    .from('locations')
    .insert({
      project_id: input.projectId,
      name: input.name,
      address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      location_type: input.locationType,
      shoot_start_date: input.shootStartDate ?? null,
      shoot_end_date: input.shootEndDate ?? null,
      risk_level: input.riskLevel,
      status: input.status,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
      metadata: {
        integrationPrep: {
          transport: {
            routeSupport: Boolean(input.latitude != null && input.longitude != null),
            distanceKm: null,
            travelTimeMinutes: null,
          },
          accommodation: {
            linkedAccommodationIds: [],
          },
        },
      },
    })
    .select('*')
    .single()

  if (error) throw error

  const locationRow = data as DbRow
  await createTimelineEntry({
    projectId: input.projectId,
    locationId: String(locationRow.id ?? ''),
    actorUserId,
    eventType: 'location_created',
    title: 'Location Created',
    description: `${input.name} was added to the locations workspace.`,
  })

  await syncLocationReadiness(input.projectId, String(locationRow.id ?? ''), actorUserId)
  await logLocationAudit({
    projectId: input.projectId,
    locationId: String(locationRow.id ?? ''),
    actorUserId,
    action: 'create',
    entityType: 'location',
    entityId: String(locationRow.id ?? ''),
    afterState: locationRow,
    entityLabel: input.name,
    metadata: { module: 'locations' },
  })

  return getLocationDetail(input.projectId, String(locationRow.id ?? ''))
}

export async function updateLocation(locationId: string, input: UpdateLocationInput, actorUserId: string | null) {
  const current = await ensureLocation(input.projectId, locationId)
  const nextLatitude = input.latitude ?? asNumber(current.latitude)
  const nextLongitude = input.longitude ?? asNumber(current.longitude)
  let nextAddress = input.address ?? asString(current.address) ?? ''

  if ((!nextAddress || nextAddress.trim().length < 3) && typeof nextLatitude === 'number' && typeof nextLongitude === 'number') {
    nextAddress = await getCachedReverseAddress(input.projectId, nextLatitude, nextLongitude)
  }

  const updatePayload: DbRow = {
    updated_by: actorUserId,
  }
  if (input.name !== undefined) updatePayload.name = input.name
  if (input.address !== undefined || nextAddress) updatePayload.address = nextAddress
  if (input.latitude !== undefined) updatePayload.latitude = input.latitude ?? null
  if (input.longitude !== undefined) updatePayload.longitude = input.longitude ?? null
  if (input.locationType !== undefined) updatePayload.location_type = input.locationType
  if (input.shootStartDate !== undefined) updatePayload.shoot_start_date = input.shootStartDate ?? null
  if (input.shootEndDate !== undefined) updatePayload.shoot_end_date = input.shootEndDate ?? null
  if (input.riskLevel !== undefined) updatePayload.risk_level = input.riskLevel
  if (input.status !== undefined) updatePayload.status = input.status
  if (input.notes !== undefined) updatePayload.notes = input.notes ?? null

  const { data, error } = await adminClient
    .from('locations')
    .update(updatePayload)
    .eq('project_id', input.projectId)
    .eq('id', locationId)
    .select('*')
    .single()

  if (error) throw error

  const updated = data as DbRow
  if (input.status && input.status !== asString(current.status)) {
    const title = input.status === 'recce_complete'
      ? 'Recce Completed'
      : input.status === 'shoot_ready'
        ? 'Shoot Ready'
        : 'Location Status Updated'
    await createTimelineEntry({
      projectId: input.projectId,
      locationId,
      actorUserId,
      eventType: input.status === 'recce_complete' ? 'recce_completed' : 'status_changed',
      title,
      description: `${asString(updated.name) ?? 'Location'} is now ${input.status.replace(/_/g, ' ')}.`,
    })
  }

  await syncLocationReadiness(input.projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId: input.projectId,
    locationId,
    actorUserId,
    action: 'update',
    entityType: 'location',
    entityId: locationId,
    beforeState: current,
    afterState: updated,
    entityLabel: asString(updated.name),
    metadata: { module: 'locations' },
  })

  return getLocationDetail(input.projectId, locationId)
}

export async function deleteLocation(projectId: string, locationId: string, actorUserId: string | null) {
  const location = await ensureLocation(projectId, locationId)
  const [mediaRows, documentRows] = await Promise.all([
    adminClient.from('location_media').select('storage_path').eq('project_id', projectId).eq('location_id', locationId),
    adminClient.from('location_documents').select('storage_path').eq('project_id', projectId).eq('location_id', locationId),
  ])

  if (mediaRows.error) throw mediaRows.error
  if (documentRows.error) throw documentRows.error

  for (const row of ([...(mediaRows.data ?? []), ...(documentRows.data ?? [])] as DbRow[])) {
    deleteStoredUpload(asString(row.storage_path))
  }

  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'delete',
    entityType: 'location',
    entityId: locationId,
    beforeState: location,
    entityLabel: asString(location.name),
    metadata: { module: 'locations' },
  })

  const { error } = await adminClient
    .from('locations')
    .delete()
    .eq('project_id', projectId)
    .eq('id', locationId)

  if (error) throw error
}

export async function listLocationMedia(projectId: string, locationId: string, page: number, pageSize: number) {
  await ensureLocation(projectId, locationId)
  const pagination = createPagination({ page, pageSize })
  const { from, to } = rangeFromPagination(pagination)

  const { data, error, count } = await adminClient
    .from('location_media')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  const rows = (data ?? []) as DbRow[]
  const userNames = await getUserNameMap(rows.map(row => asString(row.uploaded_by)))
  return toPaginatedResult(rows.map(row => mapMediaRow(row, userNames)), count ?? rows.length, pagination)
}

export async function uploadLocationMedia(projectId: string, locationId: string, input: LocationMediaUploadInput, actorUserId: string | null, file: Express.Multer.File) {
  const location = await ensureLocation(projectId, locationId)
  const { extension, signatureKind } = validateUploadedFile(file, 'media')
  const saved = saveUploadedFile(file, 'media')
  const extractedGeo = extractGeoCoordinates(file)
  const latitude = input.latitude ?? extractedGeo?.latitude ?? null
  const longitude = input.longitude ?? extractedGeo?.longitude ?? null
  const mediaKind = signatureKind === 'mp4' || signatureKind === 'webm' ? 'video' : 'image'

  const { data, error } = await adminClient
    .from('location_media')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      media_kind: mediaKind,
      original_name: file.originalname,
      stored_name: saved.storedName,
      storage_path: saved.storagePath,
      mime_type: file.mimetype,
      file_ext: extension,
      file_size_bytes: file.size,
      file_signature: signatureKind,
      latitude,
      longitude,
      upload_time: input.uploadTime ?? new Date().toISOString(),
      notes: input.notes ?? null,
      uploaded_by: actorUserId,
      metadata: {
        geotagSource: extractedGeo ? 'exif' : latitude != null && longitude != null ? 'manual' : 'none',
      },
    })
    .select('*')
    .single()

  if (error) {
    deleteStoredUpload(saved.storagePath)
    throw error
  }

  await createTimelineEntry({
    projectId,
    locationId,
    actorUserId,
    eventType: 'upload_added',
    title: 'Recce Upload Added',
    description: `${file.originalname} was added to the recce gallery.`,
  })

  await syncLocationReadiness(projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'upload',
    entityType: 'location_media',
    entityId: String((data as DbRow).id ?? ''),
    afterState: data,
    entityLabel: asString(location.name),
    metadata: { module: 'locations', uploadKind: mediaKind },
  })

  return data
}

export async function deleteLocationMedia(projectId: string, locationId: string, mediaId: string, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_media')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', mediaId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new HttpError(404, 'Media item not found.')

  deleteStoredUpload(asString((data as DbRow).storage_path))
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'delete_upload',
    entityType: 'location_media',
    entityId: mediaId,
    beforeState: data,
    metadata: { module: 'locations' },
  })

  const deleteResult = await adminClient
    .from('location_media')
    .delete()
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', mediaId)

  if (deleteResult.error) throw deleteResult.error

  await createTimelineEntry({
    projectId,
    locationId,
    actorUserId,
    eventType: 'upload_deleted',
    title: 'Recce Upload Removed',
    description: `${asString((data as DbRow).original_name) ?? 'Upload'} was removed from the gallery.`,
  })

  await syncLocationReadiness(projectId, locationId, actorUserId)
}

export async function listLocationDocuments(projectId: string, locationId: string, page: number, pageSize: number) {
  await ensureLocation(projectId, locationId)
  const pagination = createPagination({ page, pageSize })
  const { from, to } = rangeFromPagination(pagination)

  const { data, error, count } = await adminClient
    .from('location_documents')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  const rows = (data ?? []) as DbRow[]
  const userNames = await getUserNameMap(rows.map(row => asString(row.uploaded_by)))
  return toPaginatedResult(rows.map(row => mapDocumentRow(row, userNames)), count ?? rows.length, pagination)
}

export async function uploadLocationDocument(projectId: string, locationId: string, input: LocationDocumentUploadInput, actorUserId: string | null, file: Express.Multer.File) {
  const location = await ensureLocation(projectId, locationId)
  const { extension, signatureKind } = validateUploadedFile(file, 'document')
  const saved = saveUploadedFile(file, 'documents')

  const { data, error } = await adminClient
    .from('location_documents')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      permission_id: input.permissionId ?? null,
      document_category: input.category,
      original_name: file.originalname,
      stored_name: saved.storedName,
      storage_path: saved.storagePath,
      mime_type: file.mimetype,
      file_ext: extension,
      file_size_bytes: file.size,
      notes: input.notes ?? null,
      uploaded_by: actorUserId,
      metadata: {
        signatureKind,
      },
    })
    .select('*')
    .single()

  if (error) {
    deleteStoredUpload(saved.storagePath)
    throw error
  }

  await createTimelineEntry({
    projectId,
    locationId,
    actorUserId,
    eventType: 'document_uploaded',
    title: 'Document Uploaded',
    description: `${file.originalname} was added to the documents repository.`,
  })

  await syncLocationReadiness(projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'document_upload',
    entityType: 'location_document',
    entityId: String((data as DbRow).id ?? ''),
    afterState: data,
    entityLabel: asString(location.name),
    metadata: { module: 'locations' },
  })

  return data
}

export async function deleteLocationDocument(projectId: string, locationId: string, documentId: string, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', documentId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new HttpError(404, 'Document not found.')

  deleteStoredUpload(asString((data as DbRow).storage_path))
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'document_delete',
    entityType: 'location_document',
    entityId: documentId,
    beforeState: data,
    metadata: { module: 'locations' },
  })

  const deleteResult = await adminClient
    .from('location_documents')
    .delete()
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', documentId)

  if (deleteResult.error) throw deleteResult.error

  await createTimelineEntry({
    projectId,
    locationId,
    actorUserId,
    eventType: 'document_deleted',
    title: 'Document Removed',
    description: `${asString((data as DbRow).original_name) ?? 'Document'} was removed from the repository.`,
  })

  await syncLocationReadiness(projectId, locationId, actorUserId)
}

export async function listLocationPermissions(projectId: string, locationId: string) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_permissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapPermissionRow)
}

export async function createLocationPermission(projectId: string, locationId: string, input: CreateLocationPermissionInput, actorUserId: string | null) {
  const location = await ensureLocation(projectId, locationId)
  const normalizedStatus = input.expiryDate && isExpired(input.expiryDate) ? 'expired' : input.status

  const { data, error } = await adminClient
    .from('location_permissions')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      permission_type: input.permissionType,
      custom_label: input.customLabel ?? null,
      authority_name: input.authorityName ?? null,
      authority_contact: input.authorityContact ?? null,
      status: normalizedStatus,
      issue_date: input.issueDate ?? null,
      expiry_date: input.expiryDate ?? null,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
      metadata: {},
    })
    .select('*')
    .single()

  if (error) throw error

  const permission = data as DbRow
  await syncLocationPermissionAlert(projectId, permission)
  if (normalizedStatus === 'submitted' || normalizedStatus === 'approved') {
    await createTimelineEntry({
      projectId,
      locationId,
      actorUserId,
      eventType: normalizedStatus === 'approved' ? 'permission_approved' : 'permission_submitted',
      title: normalizedStatus === 'approved' ? 'Permission Approved' : 'Permission Submitted',
      description: `${formatPermissionLabel(permission)} was marked ${normalizedStatus}.`,
    })
  }
  await syncLocationReadiness(projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'permission_create',
    entityType: 'location_permission',
    entityId: String(permission.id ?? ''),
    afterState: permission,
    entityLabel: asString(location.name),
    metadata: { module: 'locations' },
  })

  return mapPermissionRow(permission)
}

export async function updateLocationPermission(projectId: string, locationId: string, permissionId: string, input: UpdateLocationPermissionInput, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data: current, error: currentError } = await adminClient
    .from('location_permissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', permissionId)
    .maybeSingle()

  if (currentError) throw currentError
  if (!current) throw new HttpError(404, 'Permission entry not found.')

  const currentRow = current as DbRow
  const nextStatus = input.expiryDate && isExpired(input.expiryDate)
    ? 'expired'
    : input.status ?? asString(currentRow.status) ?? 'pending'

  const updatePayload: DbRow = {
    updated_by: actorUserId,
    status: nextStatus,
  }
  if (input.permissionType !== undefined) updatePayload.permission_type = input.permissionType
  if (input.customLabel !== undefined) updatePayload.custom_label = input.customLabel ?? null
  if (input.authorityName !== undefined) updatePayload.authority_name = input.authorityName ?? null
  if (input.authorityContact !== undefined) updatePayload.authority_contact = input.authorityContact ?? null
  if (input.issueDate !== undefined) updatePayload.issue_date = input.issueDate ?? null
  if (input.expiryDate !== undefined) updatePayload.expiry_date = input.expiryDate ?? null
  if (input.notes !== undefined) updatePayload.notes = input.notes ?? null

  const { data, error } = await adminClient
    .from('location_permissions')
    .update(updatePayload)
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', permissionId)
    .select('*')
    .single()

  if (error) throw error

  const updated = data as DbRow
  await syncLocationPermissionAlert(projectId, updated)
  if (asString(currentRow.status) !== nextStatus && (nextStatus === 'submitted' || nextStatus === 'approved')) {
    await createTimelineEntry({
      projectId,
      locationId,
      actorUserId,
      eventType: nextStatus === 'approved' ? 'permission_approved' : 'permission_submitted',
      title: nextStatus === 'approved' ? 'Permission Approved' : 'Permission Submitted',
      description: `${formatPermissionLabel(updated)} was marked ${nextStatus}.`,
    })
  }
  await syncLocationReadiness(projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'permission_update',
    entityType: 'location_permission',
    entityId: permissionId,
    beforeState: currentRow,
    afterState: updated,
    metadata: { module: 'locations' },
  })

  return mapPermissionRow(updated)
}

export async function deleteLocationPermission(projectId: string, locationId: string, permissionId: string, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_permissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', permissionId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new HttpError(404, 'Permission entry not found.')

  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'permission_delete',
    entityType: 'location_permission',
    entityId: permissionId,
    beforeState: data,
    metadata: { module: 'locations' },
  })

  await adminClient
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('entity_table', 'location_permissions')
    .eq('entity_id', permissionId)

  const deleteResult = await adminClient
    .from('location_permissions')
    .delete()
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', permissionId)

  if (deleteResult.error) throw deleteResult.error
  await syncLocationReadiness(projectId, locationId, actorUserId)
}

export async function listLocationAmenities(projectId: string, locationId: string) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_amenities')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('amenity_type')

  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapAmenityRow)
}

export async function upsertLocationAmenity(projectId: string, locationId: string, input: UpsertLocationAmenityInput, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data: existing, error: existingError } = await adminClient
    .from('location_amenities')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('amenity_type', input.amenityType)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    id: existing?.id ?? randomUUID(),
    project_id: projectId,
    location_id: locationId,
    amenity_type: input.amenityType,
    name: input.name ?? null,
    address: input.address ?? null,
    phone_number: input.phoneNumber ?? null,
    distance_km: input.distanceKm ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    map_link: input.mapLink ?? null,
    source: input.source,
    created_by: asString(asObject(existing).created_by) ?? actorUserId,
    updated_by: actorUserId,
    metadata: {},
  }

  const { data, error } = await adminClient
    .from('location_amenities')
    .upsert(payload, { onConflict: 'location_id,amenity_type' })
    .select('*')
    .single()

  if (error) throw error
  await syncLocationReadiness(projectId, locationId, actorUserId)
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: existing ? 'amenity_update' : 'amenity_create',
    entityType: 'location_amenity',
    entityId: String((data as DbRow).id ?? ''),
    beforeState: existing ?? null,
    afterState: data,
    metadata: { module: 'locations' },
  })
  return mapAmenityRow(data as DbRow)
}

export async function createLocationTimelineEvent(projectId: string, locationId: string, input: CreateLocationTimelineInput, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_timeline')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      event_at: input.eventAt ?? new Date().toISOString(),
      created_by: actorUserId,
      metadata: {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listLocationTimeline(projectId: string, locationId: string) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_timeline')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('event_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as DbRow[]
  const userNames = await getUserNameMap(rows.map(row => asString(row.created_by)))
  return rows.map(row => mapTimelineRow(row, userNames))
}

export async function createLocationComment(projectId: string, locationId: string, input: CreateLocationCommentInput, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_comments')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      user_id: actorUserId,
      message: input.message,
      metadata: {},
    })
    .select('*')
    .single()

  if (error) throw error
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'comment_create',
    entityType: 'location_comment',
    entityId: String((data as DbRow).id ?? ''),
    afterState: data,
    metadata: { module: 'locations' },
  })
  return data
}

export async function listLocationComments(projectId: string, locationId: string) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_comments')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as DbRow[]
  const userNames = await getUserNameMap(rows.map(row => asString(row.user_id)))
  return rows.map(row => mapCommentRow(row, userNames))
}

export async function listLocationCosts(projectId: string, locationId: string) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_costs')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as DbRow[]
  const approvalStatuses = await getApprovalStatusMap(rows.map(row => asString(row.approval_id)))
  return rows.map(row => mapCostRow(row, approvalStatuses))
}

function mapLocationCostApprovalType(costType: string) {
  return costType === 'rent' ? 'rental' : 'other'
}

export async function createLocationCost(projectId: string, locationId: string, input: CreateLocationCostInput, actorUserId: string | null) {
  const location = await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_costs')
    .insert({
      id: randomUUID(),
      project_id: projectId,
      location_id: locationId,
      cost_type: input.costType,
      label: input.label ?? null,
      amount: input.amount,
      currency_code: input.currencyCode,
      approval_requested: input.approvalRequested,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
      metadata: {},
    })
    .select('*')
    .single()

  if (error) throw error

  let nextRow = data as DbRow
  if (input.approvalRequested && actorUserId) {
    const approvalId = await bridgeApproval({
      projectId,
      type: mapLocationCostApprovalType(input.costType),
      department: 'production',
      requestedBy: actorUserId,
      title: `${input.label ?? 'Location cost'} approval`,
      description: `Location cost for ${asString(location.name) ?? 'location'} (${input.costType.replace(/_/g, ' ')})`,
      amount: input.amount,
      sourceModule: 'locations',
      approvableTable: 'location_costs',
      approvableId: String((data as DbRow).id ?? ''),
      metadata: {
        locationId,
        locationName: asString(location.name),
        costType: input.costType,
      },
    })

    if (approvalId) {
      const updateResult = await adminClient
        .from('location_costs')
        .update({ approval_id: approvalId })
        .eq('project_id', projectId)
        .eq('id', String((data as DbRow).id ?? ''))
        .select('*')
        .single()

      if (updateResult.error) throw updateResult.error
      nextRow = updateResult.data as DbRow
    }
  }

  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'cost_create',
    entityType: 'location_cost',
    entityId: String(nextRow.id ?? ''),
    afterState: nextRow,
    metadata: { module: 'locations' },
  })

  return nextRow
}

export async function updateLocationCost(projectId: string, locationId: string, costId: string, input: UpdateLocationCostInput, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data: current, error: currentError } = await adminClient
    .from('location_costs')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', costId)
    .maybeSingle()

  if (currentError) throw currentError
  if (!current) throw new HttpError(404, 'Location cost entry not found.')

  const updatePayload: DbRow = { updated_by: actorUserId }
  if (input.costType !== undefined) updatePayload.cost_type = input.costType
  if (input.label !== undefined) updatePayload.label = input.label ?? null
  if (input.amount !== undefined) updatePayload.amount = input.amount
  if (input.currencyCode !== undefined) updatePayload.currency_code = input.currencyCode
  if (input.approvalRequested !== undefined) updatePayload.approval_requested = input.approvalRequested
  if (input.notes !== undefined) updatePayload.notes = input.notes ?? null

  const { data, error } = await adminClient
    .from('location_costs')
    .update(updatePayload)
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', costId)
    .select('*')
    .single()

  if (error) throw error
  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'cost_update',
    entityType: 'location_cost',
    entityId: costId,
    beforeState: current,
    afterState: data,
    metadata: { module: 'locations' },
  })
  return data
}

export async function deleteLocationCost(projectId: string, locationId: string, costId: string, actorUserId: string | null) {
  await ensureLocation(projectId, locationId)
  const { data, error } = await adminClient
    .from('location_costs')
    .select('*')
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', costId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new HttpError(404, 'Location cost entry not found.')

  await logLocationAudit({
    projectId,
    locationId,
    actorUserId,
    action: 'cost_delete',
    entityType: 'location_cost',
    entityId: costId,
    beforeState: data,
    metadata: { module: 'locations' },
  })

  const deleteResult = await adminClient
    .from('location_costs')
    .delete()
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('id', costId)

  if (deleteResult.error) throw deleteResult.error
}

export async function getLocationsDashboard(projectId: string): Promise<LocationDashboardRecord> {
  const [locationsResult, permissionsResult, recentTimelineResult] = await Promise.all([
    adminClient.from('locations').select('id, status').eq('project_id', projectId),
    adminClient.from('location_permissions').select('id, location_id, status, expiry_date').eq('project_id', projectId),
    adminClient.from('location_timeline').select('*').eq('project_id', projectId).order('event_at', { ascending: false }).limit(6),
  ])

  for (const result of [locationsResult, permissionsResult, recentTimelineResult]) {
    if (result.error) throw result.error
  }

  const locations = (locationsResult.data ?? []) as DbRow[]
  const permissions = ((permissionsResult.data ?? []) as DbRow[]).map(mapPermissionRow)
  const readinessMap = await loadReadinessMap(projectId, locations.map(row => String(row.id ?? '')))
  const recentRows = (recentTimelineResult.data ?? []) as DbRow[]
  const userNames = await getUserNameMap(recentRows.map(row => asString(row.created_by)))

  return {
    activeLocations: locations.filter(row => (asString(row.status) ?? 'draft') !== 'completed').length,
    shootReadyLocations: [...readinessMap.values()].filter(readiness => readiness.readinessStatus === 'ready').length,
    pendingPermissions: permissions.filter(permission => permission.status === 'pending' || permission.status === 'submitted').length,
    expiringPermissions30Days: permissions.filter(permission => permission.daysRemaining !== null && permission.daysRemaining >= 0 && permission.daysRemaining <= 30).length,
    expiringPermissions7Days: permissions.filter(permission => permission.daysRemaining !== null && permission.daysRemaining >= 0 && permission.daysRemaining <= 7).length,
    expiredPermissions: permissions.filter(permission => permission.status === 'expired').length,
    recentActivity: recentRows.map(row => mapTimelineRow(row, userNames)),
  }
}

export async function getLocationsReports(projectId: string): Promise<LocationReportsRecord> {
  const [permissionsResult, costsResult, readinessResult, timelineResult, mediaResult, documentsResult] = await Promise.all([
    adminClient.from('location_permissions').select('*').eq('project_id', projectId),
    adminClient.from('location_costs').select('*').eq('project_id', projectId),
    adminClient.from('location_shoot_readiness').select('*').eq('project_id', projectId),
    adminClient.from('location_timeline').select('*').eq('project_id', projectId).order('event_at', { ascending: false }).limit(12),
    adminClient.from('location_media').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(8),
    adminClient.from('location_documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(8),
  ])

  for (const result of [permissionsResult, costsResult, readinessResult, timelineResult, mediaResult, documentsResult]) {
    if (result.error) throw result.error
  }

  const permissions = ((permissionsResult.data ?? []) as DbRow[]).map(mapPermissionRow)
  const costRows = (costsResult.data ?? []) as DbRow[]
  const approvalStatuses = await getApprovalStatusMap(costRows.map(row => asString(row.approval_id)))
  const costs = costRows.map(row => mapCostRow(row, approvalStatuses))
  const readinessRows = ((readinessResult.data ?? []) as DbRow[]).map(mapReadinessRow)
  const timelineRows = (timelineResult.data ?? []) as DbRow[]
  const mediaRows = (mediaResult.data ?? []) as DbRow[]
  const documentRows = (documentsResult.data ?? []) as DbRow[]
  const userNames = await getUserNameMap([
    ...timelineRows.map(row => asString(row.created_by)),
    ...mediaRows.map(row => asString(row.uploaded_by)),
    ...documentRows.map(row => asString(row.uploaded_by)),
  ])

  return {
    permissionCompliance: {
      total: permissions.length,
      approved: permissions.filter(permission => permission.status === 'approved').length,
      pending: permissions.filter(permission => permission.status === 'pending').length,
      submitted: permissions.filter(permission => permission.status === 'submitted').length,
      rejected: permissions.filter(permission => permission.status === 'rejected').length,
      expired: permissions.filter(permission => permission.status === 'expired').length,
    },
    locationSpend: {
      total: Number(costs.reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)),
      rent: Number(costs.filter(cost => cost.costType === 'rent').reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)),
      permitFee: Number(costs.filter(cost => cost.costType === 'permit_fee').reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)),
      securityFee: Number(costs.filter(cost => cost.costType === 'security_fee').reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)),
      other: Number(costs.filter(cost => cost.costType === 'other').reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)),
      pendingApprovalCount: costs.filter(cost => cost.approvalStatus === 'pending').length,
    },
    readinessStatus: {
      ready: readinessRows.filter(readiness => readiness.readinessStatus === 'ready').length,
      almostReady: readinessRows.filter(readiness => readiness.readinessStatus === 'almost_ready').length,
      notReady: readinessRows.filter(readiness => readiness.readinessStatus === 'not_ready').length,
    },
    locationActivity: {
      recent: timelineRows.map(row => mapTimelineRow(row, userNames)),
      totalEvents: timelineRows.length,
    },
    uploadActivity: {
      mediaCount: Number(mediaResult.count ?? mediaRows.length),
      documentCount: Number(documentsResult.count ?? documentRows.length),
      recentMedia: mediaRows.map(row => mapMediaRow(row, userNames)),
      recentDocuments: documentRows.map(row => mapDocumentRow(row, userNames)),
    },
  }
}
