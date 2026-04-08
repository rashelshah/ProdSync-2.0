import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { HttpError } from '../../utils/httpError'
import type {
  WardrobeAccessoryCreateInput,
  WardrobeAccessoryUpdateInput,
  WardrobeContinuityCreateInput,
  WardrobeContinuityQuery,
  WardrobeInventoryCreateInput,
  WardrobeInventoryUpdateInput,
  WardrobeLaundryCreateInput,
  WardrobeLaundryUpdateInput,
} from './wardrobe.schemas'

const CONTINUITY_BUCKET = 'wardrobe-continuity'

type DbRow = Record<string, unknown>
type WardrobeInventoryStatus = 'on_set' | 'in_storage' | 'in_laundry' | 'missing'
type WardrobeLaundryStatus = 'sent' | 'in_cleaning' | 'returned' | 'delayed'
type WardrobeAccessoryStatus = 'on_set' | 'in_safe' | 'in_use' | 'missing'
type WardrobeAlertType = 'warning' | 'critical'
type AssetStatus = 'available' | 'checked_out' | 'maintenance' | 'rented' | 'lost'

let bucketReadyPromise: Promise<void> | null = null

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DbRow
    : {}
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.toLowerCase()
  }

  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return ((error as { message: string }).message).toLowerCase()
  }

  return ''
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }

  return null
}

function isMissingColumnError(error: unknown, columnName?: string) {
  const message = errorMessage(error)
  return errorCode(error) === '42703'
    || errorCode(error) === 'PGRST204'
    || (
      message.includes('column')
      && message.includes('does not exist')
      && (!columnName || message.includes(columnName.toLowerCase()))
    )
}

function isMissingRelationError(error: unknown, relationName?: string) {
  const message = errorMessage(error)
  return errorCode(error) === '42P01'
    || errorCode(error) === 'PGRST205'
    || (
      (
        (message.includes('relation') && message.includes('does not exist'))
        || (message.includes('could not find') && message.includes('schema cache'))
        || message.includes('not found in the schema cache')
      )
      && (!relationName || message.includes(relationName.toLowerCase()))
    )
}

function isInvalidEnumValueError(error: unknown) {
  const message = errorMessage(error)
  return errorCode(error) === '22P02' || message.includes('invalid input value for enum')
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNullableDateOnly(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) {
    return null
  }

  const normalized = new Date(stringValue)
  if (Number.isNaN(normalized.getTime())) {
    return null
  }

  return normalized.toISOString().slice(0, 10)
}

function asIsoTimestamp(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) {
    return new Date().toISOString()
  }

  const normalized = new Date(stringValue)
  if (Number.isNaN(normalized.getTime())) {
    return new Date().toISOString()
  }

  return normalized.toISOString()
}

function toDayStartIso(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString()
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function buildCostumeCode() {
  return `WM-${randomUUID().slice(0, 8).toUpperCase()}`
}

function buildLaundryBatchId() {
  return `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function buildAccessoryAssetCode() {
  return `ACC-${randomUUID().slice(0, 8).toUpperCase()}`
}

function normalizeCostumeStatus(value: unknown): WardrobeInventoryStatus {
  const normalized = asString(value)?.trim().toLowerCase()

  if (normalized === 'on_set') {
    return 'on_set'
  }

  if (normalized === 'in_laundry' || normalized === 'laundry') {
    return 'in_laundry'
  }

  if (normalized === 'missing') {
    return 'missing'
  }

  return 'in_storage'
}

function mapInventoryStatusToDb(status: WardrobeInventoryStatus) {
  if (status === 'in_laundry') {
    return 'in_laundry'
  }

  if (status === 'in_storage') {
    return 'in_storage'
  }

  return status
}

function mapInventoryStatusToLegacyDb(status: WardrobeInventoryStatus) {
  if (status === 'in_storage') {
    return 'available'
  }

  if (status === 'in_laundry') {
    return 'laundry'
  }

  if (status === 'missing') {
    return 'repair'
  }

  return 'on_set'
}

function normalizeLaundryStatus(value: unknown, expectedReturnDate: string | null, actualReturnDate: string | null): WardrobeLaundryStatus {
  const normalized = asString(value)?.trim().toLowerCase()

  if (actualReturnDate || normalized === 'returned' || normalized === 'ready' || normalized === 'delivered') {
    return 'returned'
  }

  if (expectedReturnDate && expectedReturnDate < todayDateOnly()) {
    return 'delayed'
  }

  if (normalized === 'in_cleaning' || normalized === 'washing' || normalized === 'drying') {
    return 'in_cleaning'
  }

  return 'sent'
}

function mapLaundryStatusToDb(status: WardrobeLaundryStatus) {
  return status
}

function mapLaundryStatusToLegacyDb(status: WardrobeLaundryStatus) {
  if (status === 'returned') {
    return 'ready'
  }

  if (status === 'in_cleaning' || status === 'delayed') {
    return 'washing'
  }

  return 'queued'
}

function normalizeAccessoryStatus(value: unknown): WardrobeAccessoryStatus {
  const normalized = asString(value)?.trim().toLowerCase()

  if (normalized === 'on_set' || normalized === 'in_safe' || normalized === 'in_use' || normalized === 'missing') {
    return normalized
  }

  return 'in_safe'
}

function mapAccessoryStatusToAssetStatus(status: WardrobeAccessoryStatus): AssetStatus {
  if (status === 'in_safe') {
    return 'available'
  }

  if (status === 'missing') {
    return 'lost'
  }

  return 'checked_out'
}

function normalizeAccessoryAssetStatus(value: unknown): WardrobeAccessoryStatus {
  const normalized = asString(value)?.trim().toLowerCase()

  if (normalized === 'lost') {
    return 'missing'
  }

  if (normalized === 'checked_out') {
    return 'on_set'
  }

  if (normalized === 'maintenance' || normalized === 'rented') {
    return 'in_use'
  }

  return 'in_safe'
}

function isAccessoryCategory(value: unknown): value is 'jewellery' | 'accessory' {
  return value === 'jewellery' || value === 'accessory'
}

async function ensureContinuityBucket() {
  if (bucketReadyPromise) {
    return bucketReadyPromise
  }

  bucketReadyPromise = (async () => {
    const created = await adminClient.storage.createBucket(CONTINUITY_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    })

    if (created.error) {
      const message = created.error.message?.toLowerCase() ?? ''
      if (!message.includes('already exists') && !message.includes('duplicate')) {
        throw created.error
      }
    }
  })()

  return bucketReadyPromise
}

function buildContinuityImageUrl(referencePath: string | null) {
  if (!referencePath) {
    return null
  }

  if (/^https?:\/\//i.test(referencePath)) {
    return referencePath
  }

  const { data } = adminClient.storage.from(CONTINUITY_BUCKET).getPublicUrl(referencePath)
  return data.publicUrl || null
}

function extractStoragePath(referencePath: string | null) {
  if (!referencePath || /^https?:\/\//i.test(referencePath)) {
    return null
  }

  return referencePath
}

function mapContinuityRow(row: DbRow) {
  const referencePath = asString(row.reference_image_path)
  const metadata = asObject(row.metadata)

  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    sceneNumber: asString(row.scene_number) ?? '',
    characterName: asString(row.character_name) ?? '',
    actorName: asString(row.actor_name) ?? asString(metadata.actorName),
    imageUrl: buildContinuityImageUrl(referencePath),
    notes: asString(row.notes),
    createdById: asString(row.logged_by),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapInventoryRow(row: DbRow) {
  const metadata = asObject(row.metadata)
  const canonicalStatus = asString(metadata.inventoryStatus)

  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    costumeName: asString(row.title) ?? '',
    characterName: asString(row.character_name),
    actorName: asString(row.actor_name),
    status: normalizeCostumeStatus(canonicalStatus ?? row.status),
    lastUsedScene: asString(row.last_used_scene) ?? asString(metadata.lastUsedScene),
    assetCode: asString(row.costume_code),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapAccessoryRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    itemName: asString(row.item_name) ?? '',
    category: (asString(row.category) ?? 'accessory') as 'jewellery' | 'accessory',
    assignedCharacter: asString(row.assigned_character),
    status: normalizeAccessoryStatus(row.status),
    lastCheckinTime: asString(row.last_checkin_time),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function isAccessoryAssetRow(row: DbRow) {
  const metadata = asObject(row.metadata)
  const tracked = metadata.accessoryTracked === true
  const metadataCategory = asString(metadata.accessoryCategory)
  const rowCategory = asString(row.category)

  return tracked || isAccessoryCategory(metadataCategory) || isAccessoryCategory(rowCategory)
}

function mapAccessoryAssetRow(row: DbRow) {
  const metadata = asObject(row.metadata)
  const category = asString(metadata.accessoryCategory) ?? asString(row.category) ?? 'accessory'
  const lastCheckinTime = asString(metadata.lastCheckinTime)

  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    itemName: asString(row.name) ?? '',
    category: (isAccessoryCategory(category) ? category : 'accessory') as 'jewellery' | 'accessory',
    assignedCharacter: asString(metadata.assignedCharacter),
    status: normalizeAccessoryStatus(asString(metadata.accessoryStatus) ?? normalizeAccessoryAssetStatus(row.status)),
    lastCheckinTime,
    createdAt: asIsoTimestamp(row.created_at),
  }
}

async function listAccessoriesFromAssets(projectId: string) {
  const { data, error } = await adminClient
    .from('assets')
    .select('id, project_id, name, category, status, metadata, created_at')
    .eq('project_id', projectId)
    .eq('department', 'wardrobe')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as DbRow[])
    .filter(isAccessoryAssetRow)
    .map(mapAccessoryAssetRow)
}

async function createAccessoryInAssets(input: WardrobeAccessoryCreateInput) {
  const lastCheckinTime = input.status === 'in_safe' ? new Date().toISOString() : null

  const created = await adminClient
    .from('assets')
    .insert({
      project_id: input.projectId,
      department: 'wardrobe',
      asset_code: buildAccessoryAssetCode(),
      name: input.itemName,
      category: input.category,
      status: mapAccessoryStatusToAssetStatus(input.status),
      metadata: {
        accessoryTracked: true,
        accessoryCategory: input.category,
        accessoryStatus: input.status,
        assignedCharacter: input.assignedCharacter ?? null,
        lastCheckinTime,
      },
    })
    .select('id, project_id, name, category, status, metadata, created_at')
    .single()

  if (created.error) {
    throw created.error
  }

  return mapAccessoryAssetRow(created.data as DbRow)
}

async function updateAccessoryInAssets(id: string, input: WardrobeAccessoryUpdateInput) {
  const existing = await adminClient
    .from('assets')
    .select('id, project_id, name, category, status, metadata, created_at')
    .eq('project_id', input.projectId)
    .eq('department', 'wardrobe')
    .eq('id', id)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (!existing.data) {
    throw new HttpError(404, 'Accessory item not found.')
  }

  const row = existing.data as DbRow
  const metadata = asObject(row.metadata)
  const lastCheckinTime = input.status === 'in_safe'
    ? new Date().toISOString()
    : asString(metadata.lastCheckinTime)

  const updated = await adminClient
    .from('assets')
    .update({
      status: mapAccessoryStatusToAssetStatus(input.status),
      metadata: {
        ...metadata,
        accessoryTracked: true,
        accessoryCategory: asString(metadata.accessoryCategory) ?? asString(row.category) ?? 'accessory',
        accessoryStatus: input.status,
        assignedCharacter: input.assignedCharacter ?? null,
        lastCheckinTime,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', input.projectId)
    .eq('department', 'wardrobe')
    .eq('id', id)
    .select('id, project_id, name, category, status, metadata, created_at')
    .maybeSingle()

  if (updated.error) {
    throw updated.error
  }

  if (!updated.data) {
    throw new HttpError(404, 'Accessory item not found.')
  }

  return mapAccessoryAssetRow(updated.data as DbRow)
}

async function getCostumeTitles(costumeIds: string[]) {
  if (costumeIds.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await adminClient
    .from('costumes')
    .select('id, title')
    .in('id', costumeIds)

  if (error) {
    throw error
  }

  const mapping = new Map<string, string>()
  for (const row of (data ?? []) as DbRow[]) {
    mapping.set(String(row.id ?? ''), asString(row.title) ?? 'Unnamed costume')
  }

  return mapping
}

async function findOrCreateCostume(projectId: string, costumeName: string) {
  const existing = await adminClient
    .from('costumes')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('title', costumeName)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data) {
    return existing.data as DbRow
  }

  const created = await adminClient
    .from('costumes')
    .insert({
      project_id: projectId,
      costume_code: buildCostumeCode(),
      title: costumeName,
      status: 'in_laundry',
      metadata: {
        inventoryStatus: 'in_laundry',
      },
    })
    .select('*')
    .single()

  if (!created.error) {
    return created.data as DbRow
  }

  if (!isInvalidEnumValueError(created.error) && !isMissingColumnError(created.error, 'metadata')) {
    throw created.error
  }

  const fallback = await adminClient
    .from('costumes')
    .insert({
      project_id: projectId,
      costume_code: buildCostumeCode(),
      title: costumeName,
      status: 'laundry',
    })
    .select('*')
    .single()

  if (fallback.error) {
    throw fallback.error
  }

  return fallback.data as DbRow
}

async function updateCostumeStatuses(projectId: string, costumeIds: string[], status: WardrobeInventoryStatus) {
  const modernUpdate = await adminClient
    .from('costumes')
    .update({
      status: mapInventoryStatusToDb(status),
      metadata: {
        inventoryStatus: status,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .in('id', costumeIds)

  if (!modernUpdate.error) {
    return
  }

  if (!isInvalidEnumValueError(modernUpdate.error) && !isMissingColumnError(modernUpdate.error, 'metadata')) {
    throw modernUpdate.error
  }

  const legacyUpdate = await adminClient
    .from('costumes')
    .update({
      status: mapInventoryStatusToLegacyDb(status),
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .in('id', costumeIds)

  if (legacyUpdate.error) {
    throw legacyUpdate.error
  }
}

async function getLaundryRowsForProject(projectId: string) {
  const modernQuery = await adminClient
    .from('laundry_logs')
    .select('id, project_id, costume_id, batch_number, status, sent_at, returned_at, vendor_name, expected_return_date, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (!modernQuery.error) {
    return (modernQuery.data ?? []) as DbRow[]
  }

  if (!isMissingColumnError(modernQuery.error, 'expected_return_date')) {
    throw modernQuery.error
  }

  const fallbackQuery = await adminClient
    .from('laundry_logs')
    .select('id, project_id, costume_id, batch_number, status, sent_at, returned_at, vendor_name, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (fallbackQuery.error) {
    throw fallbackQuery.error
  }

  return (fallbackQuery.data ?? []) as DbRow[]
}

function groupLaundryRows(rows: DbRow[], costumeTitles: Map<string, string>) {
  const grouped = new Map<string, {
    id: string
    projectId: string
    batchId: string
    items: string[]
    vendorName: string | null
    sentDate: string | null
    expectedReturnDate: string | null
    actualReturnDate: string | null
    createdAt: string
    rowStatuses: WardrobeLaundryStatus[]
  }>()

  for (const row of rows) {
    const metadata = asObject(row.metadata)
    const batchId = asString(row.batch_number) ?? String(row.id ?? '')
    const costumeId = asString(row.costume_id)
    const expectedReturnDate = asNullableDateOnly(row.expected_return_date) ?? asNullableDateOnly(metadata.expectedReturnDate)
    const actualReturnDate = asNullableDateOnly(row.returned_at)
    const normalizedStatus = normalizeLaundryStatus(asString(metadata.laundryStatus) ?? row.status, expectedReturnDate, actualReturnDate)
    const itemName = costumeId ? (costumeTitles.get(costumeId) ?? 'Unnamed costume') : 'Unnamed costume'
    const current = grouped.get(batchId) ?? {
      id: batchId,
      projectId: String(row.project_id ?? ''),
      batchId,
      items: [],
      vendorName: asString(row.vendor_name),
      sentDate: asNullableDateOnly(row.sent_at),
      expectedReturnDate,
      actualReturnDate,
      createdAt: asIsoTimestamp(row.created_at),
      rowStatuses: [],
    }

    current.items.push(itemName)
    current.rowStatuses.push(normalizedStatus)
    if (!current.sentDate) {
      current.sentDate = asNullableDateOnly(row.sent_at)
    }
    if (!current.expectedReturnDate) {
      current.expectedReturnDate = expectedReturnDate
    }
    if (!current.actualReturnDate && actualReturnDate) {
      current.actualReturnDate = actualReturnDate
    }

    grouped.set(batchId, current)
  }

  return Array.from(grouped.values())
    .map(group => {
      const status = group.rowStatuses.includes('delayed')
        ? 'delayed'
        : group.rowStatuses.every(item => item === 'returned')
          ? 'returned'
          : group.rowStatuses.includes('in_cleaning')
            ? 'in_cleaning'
            : 'sent'

      return {
        id: group.id,
        projectId: group.projectId,
        batchId: group.batchId,
        items: group.items,
        vendorName: group.vendorName,
        sentDate: group.sentDate,
        expectedReturnDate: group.expectedReturnDate,
        actualReturnDate: group.actualReturnDate,
        status: status as WardrobeLaundryStatus,
        createdAt: group.createdAt,
      }
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function listContinuityLogs(projectId: string, filters?: Pick<WardrobeContinuityQuery, 'scene' | 'character'>) {
  let query = adminClient
    .from('continuity_logs')
    .select('id, project_id, scene_number, character_name, actor_name, reference_image_path, notes, metadata, logged_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.scene) {
    query = query.eq('scene_number', filters.scene)
  }

  if (filters?.character) {
    query = query.ilike('character_name', `%${filters.character}%`)
  }

  const { data, error } = await query

  if (!error) {
    return ((data ?? []) as DbRow[]).map(mapContinuityRow)
  }

  if (!isMissingColumnError(error, 'actor_name')) {
    throw error
  }

  let fallbackQuery = adminClient
    .from('continuity_logs')
    .select('id, project_id, scene_number, character_name, reference_image_path, notes, metadata, logged_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.scene) {
    fallbackQuery = fallbackQuery.eq('scene_number', filters.scene)
  }

  if (filters?.character) {
    fallbackQuery = fallbackQuery.ilike('character_name', `%${filters.character}%`)
  }

  const fallback = await fallbackQuery
  if (fallback.error) {
    throw fallback.error
  }

  return ((fallback.data ?? []) as DbRow[]).map(mapContinuityRow)
}

export async function getContinuityLogById(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('continuity_logs')
    .select('id, project_id, scene_number, character_name, actor_name, reference_image_path, notes, metadata, logged_by, created_at')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle()

  if (!error) {
    if (!data) {
      throw new HttpError(404, 'Continuity log not found.')
    }

    return mapContinuityRow(data as DbRow)
  }

  if (!isMissingColumnError(error, 'actor_name')) {
    throw error
  }

  const fallback = await adminClient
    .from('continuity_logs')
    .select('id, project_id, scene_number, character_name, reference_image_path, notes, metadata, logged_by, created_at')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle()

  if (fallback.error) {
    throw fallback.error
  }

  if (!fallback.data) {
    throw new HttpError(404, 'Continuity log not found.')
  }

  return mapContinuityRow(fallback.data as DbRow)
}

export async function createContinuityLog(input: WardrobeContinuityCreateInput, userId: string | null, file?: Express.Multer.File) {
  if (!file) {
    throw new HttpError(400, 'A continuity image is required.')
  }

  await ensureContinuityBucket()

  const objectPath = `${input.projectId}/${randomUUID()}-${safeFileName(file.originalname)}`
  const uploaded = await adminClient.storage
    .from(CONTINUITY_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (uploaded.error) {
    throw uploaded.error
  }

  const payload = {
    project_id: input.projectId,
    costume_id: input.costumeId ?? null,
    scene_number: input.sceneNumber,
    character_name: input.characterName,
    actor_name: input.actorName ?? null,
    reference_image_path: objectPath,
    notes: input.notes ?? null,
    metadata: {
      actorName: input.actorName ?? null,
    },
    logged_by: userId,
  }

  const created = await adminClient
    .from('continuity_logs')
    .insert(payload)
    .select('id, project_id, scene_number, character_name, actor_name, reference_image_path, notes, metadata, logged_by, created_at')
    .single()

  if (!created.error) {
    return mapContinuityRow(created.data as DbRow)
  }

  if (!isMissingColumnError(created.error, 'actor_name')) {
    await adminClient.storage.from(CONTINUITY_BUCKET).remove([objectPath])
    throw created.error
  }

  const fallback = await adminClient
    .from('continuity_logs')
    .insert({
      project_id: input.projectId,
      costume_id: input.costumeId ?? null,
      scene_number: input.sceneNumber,
      character_name: input.characterName,
      reference_image_path: objectPath,
      notes: input.notes ?? null,
      metadata: {
        actorName: input.actorName ?? null,
      },
      logged_by: userId,
    })
    .select('id, project_id, scene_number, character_name, reference_image_path, notes, metadata, logged_by, created_at')
    .single()

  if (fallback.error) {
    await adminClient.storage.from(CONTINUITY_BUCKET).remove([objectPath])
    throw fallback.error
  }

  return mapContinuityRow(fallback.data as DbRow)
}

export async function deleteContinuityLog(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('continuity_logs')
    .select('id, project_id, reference_image_path')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Continuity log not found.')
  }

  const storagePath = extractStoragePath(asString((data as DbRow).reference_image_path))
  if (storagePath) {
    await adminClient.storage.from(CONTINUITY_BUCKET).remove([storagePath])
  }

  const deleted = await adminClient
    .from('continuity_logs')
    .delete()
    .eq('project_id', projectId)
    .eq('id', id)

  if (deleted.error) {
    throw deleted.error
  }
}

export async function listWardrobeInventory(projectId: string) {
  const { data, error } = await adminClient
    .from('costumes')
    .select('id, project_id, costume_code, title, character_name, actor_name, status, last_used_scene, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (!error) {
    return ((data ?? []) as DbRow[]).map(mapInventoryRow)
  }

  if (!isMissingColumnError(error, 'last_used_scene')) {
    throw error
  }

  const fallback = await adminClient
    .from('costumes')
    .select('id, project_id, costume_code, title, character_name, actor_name, status, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (fallback.error) {
    throw fallback.error
  }

  return ((fallback.data ?? []) as DbRow[]).map(mapInventoryRow)
}

export async function createWardrobeInventoryItem(input: WardrobeInventoryCreateInput) {
  const payload = {
    project_id: input.projectId,
    costume_code: buildCostumeCode(),
    title: input.costumeName,
    character_name: input.characterName ?? null,
    actor_name: input.actorName ?? null,
    status: mapInventoryStatusToDb(input.status),
    last_used_scene: input.lastUsedScene ?? null,
    metadata: {
      inventoryStatus: input.status,
      lastUsedScene: input.lastUsedScene ?? null,
    },
  }

  const created = await adminClient
    .from('costumes')
    .insert(payload)
    .select('id, project_id, costume_code, title, character_name, actor_name, status, last_used_scene, metadata, created_at')
    .single()

  if (!created.error) {
    return mapInventoryRow(created.data as DbRow)
  }

  if (!isMissingColumnError(created.error, 'last_used_scene') && !isInvalidEnumValueError(created.error)) {
    throw created.error
  }

  const fallback = await adminClient
    .from('costumes')
    .insert({
      project_id: input.projectId,
      costume_code: buildCostumeCode(),
      title: input.costumeName,
      character_name: input.characterName ?? null,
      actor_name: input.actorName ?? null,
      status: mapInventoryStatusToLegacyDb(input.status),
      metadata: {
        inventoryStatus: input.status,
        lastUsedScene: input.lastUsedScene ?? null,
      },
    })
    .select('id, project_id, costume_code, title, character_name, actor_name, status, metadata, created_at')
    .single()

  if (fallback.error) {
    throw fallback.error
  }

  return mapInventoryRow(fallback.data as DbRow)
}

export async function updateWardrobeInventoryItem(id: string, input: WardrobeInventoryUpdateInput) {
  const updated = await adminClient
    .from('costumes')
    .update({
      status: mapInventoryStatusToDb(input.status),
      last_used_scene: input.lastUsedScene ?? null,
      metadata: {
        inventoryStatus: input.status,
        lastUsedScene: input.lastUsedScene ?? null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', input.projectId)
    .eq('id', id)
    .select('id, project_id, costume_code, title, character_name, actor_name, status, last_used_scene, metadata, created_at')
    .maybeSingle()

  if (!updated.error) {
    if (!updated.data) {
      throw new HttpError(404, 'Wardrobe inventory item not found.')
    }

    return mapInventoryRow(updated.data as DbRow)
  }

  if (!isMissingColumnError(updated.error, 'last_used_scene') && !isInvalidEnumValueError(updated.error)) {
    throw updated.error
  }

  const fallback = await adminClient
    .from('costumes')
    .update({
      status: mapInventoryStatusToLegacyDb(input.status),
      metadata: {
        inventoryStatus: input.status,
        lastUsedScene: input.lastUsedScene ?? null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', input.projectId)
    .eq('id', id)
    .select('id, project_id, costume_code, title, character_name, actor_name, status, metadata, created_at')
    .maybeSingle()

  if (fallback.error) {
    throw fallback.error
  }

  if (!fallback.data) {
    throw new HttpError(404, 'Wardrobe inventory item not found.')
  }

  return mapInventoryRow(fallback.data as DbRow)
}

export async function listLaundryBatches(projectId: string) {
  const rows = await getLaundryRowsForProject(projectId)
  const costumeTitles = await getCostumeTitles(
    rows
      .map(row => asString(row.costume_id))
      .filter((value): value is string => Boolean(value)),
  )

  return groupLaundryRows(rows, costumeTitles)
}

export async function createLaundryBatch(input: WardrobeLaundryCreateInput, userId: string | null) {
  const batchId = input.batchId ?? buildLaundryBatchId()
  const uniqueItems = Array.from(new Set(input.items.map(item => item.trim()).filter(Boolean)))
  const costumes = await Promise.all(uniqueItems.map(item => findOrCreateCostume(input.projectId, String(item))))
  const costumeIds = costumes.map(costume => String(costume.id ?? ''))
  const sentAt = toDayStartIso(input.sentDate)
  const actualReturnDate = input.status === 'returned'
    ? toDayStartIso(input.expectedReturnDate)
    : null

  const inserted = await adminClient
    .from('laundry_logs')
    .insert(
      costumeIds.map(costumeId => ({
        project_id: input.projectId,
        costume_id: costumeId,
        logged_by: userId,
        batch_number: batchId,
        status: mapLaundryStatusToDb(input.status),
        sent_at: sentAt,
        returned_at: actualReturnDate,
        vendor_name: input.vendorName,
        expected_return_date: input.expectedReturnDate,
        metadata: {
          expectedReturnDate: input.expectedReturnDate,
          laundryStatus: input.status,
        },
      })),
    )

  if (inserted.error) {
    if (!isMissingColumnError(inserted.error, 'expected_return_date') && !isInvalidEnumValueError(inserted.error)) {
      throw inserted.error
    }

    const fallbackInsert = await adminClient
      .from('laundry_logs')
      .insert(
        costumeIds.map(costumeId => ({
          project_id: input.projectId,
          costume_id: costumeId,
          logged_by: userId,
          batch_number: batchId,
          status: mapLaundryStatusToLegacyDb(input.status),
          sent_at: sentAt,
          returned_at: actualReturnDate,
          vendor_name: input.vendorName,
          metadata: {
            expectedReturnDate: input.expectedReturnDate,
            laundryStatus: input.status,
          },
        })),
      )

    if (fallbackInsert.error) {
      throw fallbackInsert.error
    }
  }

  const costumeStatus = input.status === 'returned' ? 'in_storage' : 'in_laundry'
  await updateCostumeStatuses(input.projectId, costumeIds, costumeStatus)

  const batches = await listLaundryBatches(input.projectId)
  const batch = batches.find(item => item.batchId === batchId)

  if (!batch) {
    throw new HttpError(500, 'Laundry batch was created but could not be reloaded.')
  }

  return batch
}

export async function updateLaundryBatchStatus(batchId: string, input: WardrobeLaundryUpdateInput) {
  const existingRows = await getLaundryRowsForProject(input.projectId)
  const matchingRows = existingRows.filter(row => (asString(row.batch_number) ?? String(row.id ?? '')) === batchId)

  if (matchingRows.length === 0) {
    throw new HttpError(404, 'Laundry batch not found.')
  }

  const actualReturnDate = input.status === 'returned'
    ? toDayStartIso(input.actualReturnDate ?? todayDateOnly())
    : null

  const updated = await adminClient
    .from('laundry_logs')
    .update({
      status: mapLaundryStatusToDb(input.status),
      returned_at: actualReturnDate,
      metadata: {
        laundryStatus: input.status,
        actualReturnDate: input.actualReturnDate ?? null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', input.projectId)
    .eq('batch_number', batchId)

  if (updated.error) {
    if (!isMissingColumnError(updated.error, 'expected_return_date') && !isInvalidEnumValueError(updated.error)) {
      throw updated.error
    }

    const fallbackUpdate = await adminClient
      .from('laundry_logs')
      .update({
        status: mapLaundryStatusToLegacyDb(input.status),
        returned_at: actualReturnDate,
        metadata: {
          laundryStatus: input.status,
          actualReturnDate: input.actualReturnDate ?? null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', input.projectId)
      .eq('batch_number', batchId)

    if (fallbackUpdate.error) {
      throw fallbackUpdate.error
    }
  }

  const costumeIds = matchingRows
    .map(row => asString(row.costume_id))
    .filter((value): value is string => Boolean(value))

  const costumeStatus = input.status === 'returned' ? 'in_storage' : 'in_laundry'
  await updateCostumeStatuses(input.projectId, costumeIds, costumeStatus)

  const batches = await listLaundryBatches(input.projectId)
  const batch = batches.find(item => item.batchId === batchId)

  if (!batch) {
    throw new HttpError(500, 'Laundry batch was updated but could not be reloaded.')
  }

  return batch
}

export async function listAccessories(projectId: string) {
  const { data, error } = await adminClient
    .from('accessory_inventory')
    .select('id, project_id, item_name, category, assigned_character, status, last_checkin_time, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingRelationError(error, 'accessory_inventory')) {
      return listAccessoriesFromAssets(projectId)
    }

    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapAccessoryRow)
}

export async function createAccessoryItem(input: WardrobeAccessoryCreateInput) {
  const created = await adminClient
    .from('accessory_inventory')
    .insert({
      project_id: input.projectId,
      item_name: input.itemName,
      category: input.category,
      assigned_character: input.assignedCharacter ?? null,
      status: input.status,
      last_checkin_time: input.status === 'in_safe' ? new Date().toISOString() : null,
    })
    .select('id, project_id, item_name, category, assigned_character, status, last_checkin_time, created_at')
    .single()

  if (created.error) {
    if (isMissingRelationError(created.error, 'accessory_inventory')) {
      return createAccessoryInAssets(input)
    }

    throw created.error
  }

  return mapAccessoryRow(created.data as DbRow)
}

export async function updateAccessoryItem(id: string, input: WardrobeAccessoryUpdateInput) {
  const updated = await adminClient
    .from('accessory_inventory')
    .update({
      status: input.status,
      assigned_character: input.assignedCharacter ?? null,
      last_checkin_time: input.status === 'in_safe' ? new Date().toISOString() : undefined,
    })
    .eq('project_id', input.projectId)
    .eq('id', id)
    .select('id, project_id, item_name, category, assigned_character, status, last_checkin_time, created_at')
    .maybeSingle()

  if (updated.error) {
    if (isMissingRelationError(updated.error, 'accessory_inventory')) {
      return updateAccessoryInAssets(id, input)
    }

    throw updated.error
  }

  if (!updated.data) {
    throw new HttpError(404, 'Accessory item not found.')
  }

  return mapAccessoryRow(updated.data as DbRow)
}

function buildAlert(type: WardrobeAlertType, message: string, timestamp: string) {
  return {
    type,
    message,
    timestamp,
  }
}

export async function listWardrobeAlerts(projectId: string) {
  const [inventory, accessories, laundry, continuity] = await Promise.all([
    listWardrobeInventory(projectId),
    listAccessories(projectId),
    listLaundryBatches(projectId),
    listContinuityLogs(projectId),
  ])

  const alerts: Array<{ type: WardrobeAlertType; message: string; timestamp: string }> = []

  for (const item of inventory.filter(entry => entry.status === 'missing')) {
    alerts.push(buildAlert(
      'critical',
      `${item.costumeName} is marked missing${item.characterName ? ` for ${item.characterName}` : ''}.`,
      item.createdAt,
    ))
  }

  for (const item of accessories.filter(entry => entry.category === 'jewellery' && entry.status !== 'in_safe')) {
    alerts.push(buildAlert(
      item.status === 'missing' ? 'critical' : 'warning',
      `${item.itemName} has not been returned to the safe.`,
      item.lastCheckinTime ?? item.createdAt,
    ))
  }

  for (const batch of laundry.filter(entry => entry.status === 'delayed')) {
    alerts.push(buildAlert(
      'critical',
      `Laundry batch ${batch.batchId} is delayed beyond ${batch.expectedReturnDate ?? 'its return date'}.`,
      batch.createdAt,
    ))
  }

  const continuityScenes = new Set(continuity.map(item => item.sceneNumber.trim()).filter(Boolean))
  const expectedScenes = Array.from(new Set(
    inventory
      .map(item => item.lastUsedScene?.trim() ?? '')
      .filter(Boolean),
  ))

  for (const scene of expectedScenes) {
    if (!continuityScenes.has(scene)) {
      alerts.push(buildAlert(
        'warning',
        `Continuity logs are missing for scene ${scene}.`,
        new Date().toISOString(),
      ))
    }
  }

  return alerts
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 20)
}
