import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { HttpError } from '../../utils/httpError'
import type {
  ActorLookCreateInput,
  ActorLookQueryInput,
  ActorPaymentCreateInput,
  ActorPaymentUpdateInput,
  CallSheetCreateInput,
  JuniorArtistCreateInput,
  JuniorArtistQueryInput,
} from './actors.schemas'

const ACTOR_LOOKS_BUCKET = 'actor-looks'
const FALLBACK_JUNIOR_ENTITY = 'actors_junior_log'
const FALLBACK_CALL_SHEET_ENTITY = 'actors_call_sheet'
const FALLBACK_PAYMENT_ENTITY = 'actors_payment'
const FALLBACK_LOOK_ENTITY = 'actors_look'

type DbRow = Record<string, unknown>
type ActorAlertType = 'warning' | 'critical'

let lookBucketReadyPromise: Promise<void> | null = null

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

function throwActorsModuleNotReady(error: unknown) {
  throw new HttpError(
    503,
    'Actor & Juniors database setup is incomplete. Apply the latest database migration and try again.',
    {
      code: errorCode(error),
      message: errorMessage(error) || 'Unknown database error.',
    },
  )
}

function fallbackRecordId() {
  return randomUUID()
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DbRow
    : {}
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function asIsoTimestamp(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) {
    return new Date().toISOString()
  }

  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function asDateOnly(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) {
    return new Date().toISOString().slice(0, 10)
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue
  }

  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return parsed.toISOString().slice(0, 10)
}

function asTime(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) {
    return null
  }

  const match = stringValue.match(/^(\d{2}:\d{2})(?::\d{2})?$/)
  return match ? match[1] : stringValue.slice(0, 5)
}

function normalizeTimeForDb(time: string) {
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

async function ensureActorLooksBucket() {
  if (lookBucketReadyPromise) {
    return lookBucketReadyPromise
  }

  lookBucketReadyPromise = (async () => {
    const created = await adminClient.storage.createBucket(ACTOR_LOOKS_BUCKET, {
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

  return lookBucketReadyPromise
}

function buildActorLookUrl(imageUrl: string | null) {
  if (!imageUrl) {
    return null
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl
  }

  const { data } = adminClient.storage.from(ACTOR_LOOKS_BUCKET).getPublicUrl(imageUrl)
  return data.publicUrl || null
}

function extractActorLookStoragePath(imageUrl: string | null) {
  if (!imageUrl) {
    return null
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    return imageUrl
  }

  const match = imageUrl.match(new RegExp(`/storage/v1/object/public/${ACTOR_LOOKS_BUCKET}/(.+)$`, 'i'))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function normalizeActorKey(value: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function mapJuniorArtistRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    shootDate: asDateOnly(row.shoot_date),
    agentName: asString(row.agent_name) ?? '',
    numberOfArtists: Math.max(0, Math.round(asNumber(row.number_of_artists))),
    ratePerArtist: roundMoney(asNumber(row.rate_per_artist)),
    totalCost: roundMoney(asNumber(row.total_cost)),
    createdById: asString(row.created_by),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapJuniorArtistFallbackRow(row: DbRow) {
  const payload = asObject(row.new_data)
  return {
    id: asString(payload.id) ?? asString(row.entity_id) ?? String(row.id ?? ''),
    projectId: asString(payload.projectId) ?? asString(row.project_id) ?? '',
    shootDate: asDateOnly(payload.shootDate),
    agentName: asString(payload.agentName) ?? '',
    numberOfArtists: Math.max(0, Math.round(asNumber(payload.numberOfArtists))),
    ratePerArtist: roundMoney(asNumber(payload.ratePerArtist)),
    totalCost: roundMoney(asNumber(payload.totalCost)),
    createdById: asString(payload.createdById) ?? asString(row.user_id),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapCallSheetRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    shootDate: asDateOnly(row.shoot_date),
    location: asString(row.location) ?? '',
    callTime: asTime(row.call_time) ?? '',
    actorName: asString(row.actor_name) ?? '',
    characterName: asString(row.character_name),
    notes: asString(row.notes),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapCallSheetFallbackRow(row: DbRow) {
  const payload = asObject(row.new_data)
  return {
    id: asString(payload.id) ?? asString(row.entity_id) ?? String(row.id ?? ''),
    projectId: asString(payload.projectId) ?? asString(row.project_id) ?? '',
    shootDate: asDateOnly(payload.shootDate),
    location: asString(payload.location) ?? '',
    callTime: asTime(payload.callTime) ?? '',
    actorName: asString(payload.actorName) ?? '',
    characterName: asString(payload.characterName),
    notes: asString(payload.notes),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapActorPaymentRow(row: DbRow) {
  const paymentType = asString(row.payment_type)?.toLowerCase() === 'remuneration' ? 'remuneration' : 'batta'
  const status = asString(row.status)?.toLowerCase() === 'paid' ? 'paid' : 'pending'

  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    actorName: asString(row.actor_name) ?? '',
    paymentType,
    amount: roundMoney(asNumber(row.amount)),
    paymentDate: asDateOnly(row.payment_date),
    status,
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapActorPaymentFallbackRow(row: DbRow) {
  const payload = asObject(row.new_data)
  const paymentType = asString(payload.paymentType)?.toLowerCase() === 'remuneration' ? 'remuneration' : 'batta'
  const status = asString(payload.status)?.toLowerCase() === 'paid' ? 'paid' : 'pending'

  return {
    id: asString(payload.id) ?? asString(row.entity_id) ?? String(row.id ?? ''),
    projectId: asString(payload.projectId) ?? asString(row.project_id) ?? '',
    actorName: asString(payload.actorName) ?? '',
    paymentType,
    amount: roundMoney(asNumber(payload.amount)),
    paymentDate: asDateOnly(payload.paymentDate),
    status,
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapActorLookRow(row: DbRow) {
  const metadata = asObject(row.metadata)
  const imageUrl = asString(row.image_url) ?? asString(metadata.imageUrl)

  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    actorName: asString(row.actor_name) ?? '',
    characterName: asString(row.character_name),
    imageUrl: buildActorLookUrl(imageUrl),
    notes: asString(row.notes),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapActorLookFallbackRow(row: DbRow) {
  const payload = asObject(row.new_data)
  return {
    id: asString(payload.id) ?? asString(row.entity_id) ?? String(row.id ?? ''),
    projectId: asString(payload.projectId) ?? asString(row.project_id) ?? '',
    actorName: asString(payload.actorName) ?? '',
    characterName: asString(payload.characterName),
    imageUrl: buildActorLookUrl(asString(payload.imageUrl)),
    notes: asString(payload.notes),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

async function insertActorsFallbackRecord(params: {
  projectId: string
  userId?: string | null
  entity: string
  entityLabel?: string | null
  payload: DbRow
}) {
  const id = fallbackRecordId()
  const { data, error } = await adminClient
    .from('activity_logs')
    .insert({
      project_id: params.projectId,
      user_id: params.userId ?? null,
      action: 'tracked',
      entity: params.entity,
      entity_id: id,
      entity_label: params.entityLabel ?? null,
      new_data: {
        id,
        ...params.payload,
      },
      context: {
        module: 'actors',
        fallbackStore: true,
      },
    })
    .select('id, project_id, user_id, entity, entity_id, entity_label, new_data, context, created_at')
    .single()

  if (error) {
    throw error
  }

  return data as DbRow
}

async function listActorsFallbackRecords(projectId: string, entity: string) {
  const { data, error } = await adminClient
    .from('activity_logs')
    .select('id, project_id, user_id, entity, entity_id, entity_label, new_data, context, created_at')
    .eq('project_id', projectId)
    .eq('entity', entity)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as DbRow[]
}

async function getActorsFallbackRecord(projectId: string, entity: string, id: string) {
  const { data, error } = await adminClient
    .from('activity_logs')
    .select('id, project_id, user_id, entity, entity_id, entity_label, new_data, context, created_at')
    .eq('project_id', projectId)
    .eq('entity', entity)
    .eq('entity_id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as DbRow | null
}

async function updateActorsFallbackRecord(params: {
  projectId: string
  entity: string
  id: string
  payload: DbRow
  entityLabel?: string | null
}) {
  const existing = await getActorsFallbackRecord(params.projectId, params.entity, params.id)
  if (!existing) {
    throw new HttpError(404, 'Actor record not found.')
  }

  const currentPayload = asObject(existing.new_data)
  const { data, error } = await adminClient
    .from('activity_logs')
    .update({
      entity_label: params.entityLabel ?? asString(existing.entity_label),
      new_data: {
        ...currentPayload,
        ...params.payload,
        id: params.id,
      },
    })
    .eq('project_id', params.projectId)
    .eq('entity', params.entity)
    .eq('entity_id', params.id)
    .select('id, project_id, user_id, entity, entity_id, entity_label, new_data, context, created_at')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Actor record not found.')
  }

  return data as DbRow
}

async function deleteActorsFallbackRecord(projectId: string, entity: string, id: string) {
  const deleted = await adminClient
    .from('activity_logs')
    .delete()
    .eq('project_id', projectId)
    .eq('entity', entity)
    .eq('entity_id', id)
    .select('id')
    .maybeSingle()

  if (deleted.error) {
    throw deleted.error
  }

  if (!deleted.data) {
    throw new HttpError(404, 'Actor record not found.')
  }
}

function buildAlert(type: ActorAlertType, message: string, timestamp: string) {
  return { type, message, timestamp }
}

function groupCallSheetsByDate(callSheets: Array<ReturnType<typeof mapCallSheetRow> | ReturnType<typeof mapCallSheetFallbackRow>>) {
  return Array.from(
    callSheets.reduce((map, sheet) => {
      const existing = map.get(sheet.shootDate) ?? []
      existing.push(sheet)
      map.set(sheet.shootDate, existing)
      return map
    }, new Map<string, Array<ReturnType<typeof mapCallSheetRow> | ReturnType<typeof mapCallSheetFallbackRow>>>()),
  ).map(([shootDate, entries]) => ({
    shootDate,
    entries,
  }))
}

export async function createJuniorArtistLog(input: JuniorArtistCreateInput, userId: string | null) {
  const totalCost = roundMoney(input.numberOfArtists * input.ratePerArtist)

  const { data, error } = await adminClient
    .from('junior_artists_logs')
    .insert({
      project_id: input.projectId,
      shoot_date: input.shootDate,
      agent_name: input.agentName,
      number_of_artists: input.numberOfArtists,
      rate_per_artist: roundMoney(input.ratePerArtist),
      total_cost: totalCost,
      created_by: userId,
    })
    .select('id, project_id, shoot_date, agent_name, number_of_artists, rate_per_artist, total_cost, created_by, created_at')
    .single()

  if (error) {
    if (isMissingRelationError(error, 'junior_artists_logs')) {
      const fallback = await insertActorsFallbackRecord({
        projectId: input.projectId,
        userId,
        entity: FALLBACK_JUNIOR_ENTITY,
        entityLabel: input.agentName,
        payload: {
          projectId: input.projectId,
          shootDate: input.shootDate,
          agentName: input.agentName,
          numberOfArtists: input.numberOfArtists,
          ratePerArtist: roundMoney(input.ratePerArtist),
          totalCost,
          createdById: userId,
        },
      })

      return mapJuniorArtistFallbackRow(fallback)
    }

    throw error
  }

  return mapJuniorArtistRow(data as DbRow)
}

export async function listJuniorArtistLogs(projectId: string, filters?: Pick<JuniorArtistQueryInput, 'shootDate'>) {
  let query = adminClient
    .from('junior_artists_logs')
    .select('id, project_id, shoot_date, agent_name, number_of_artists, rate_per_artist, total_cost, created_by, created_at')
    .eq('project_id', projectId)
    .order('shoot_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.shootDate) {
    query = query.eq('shoot_date', filters.shootDate)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingRelationError(error, 'junior_artists_logs')) {
      const fallbackRows = await listActorsFallbackRecords(projectId, FALLBACK_JUNIOR_ENTITY)
      const logs = fallbackRows.map(mapJuniorArtistFallbackRow)

      if (filters?.shootDate) {
        return logs.filter(log => log.shootDate === filters.shootDate)
      }

      return logs
    }

    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapJuniorArtistRow)
}

export async function deleteJuniorArtistLog(projectId: string, id: string) {
  const deleted = await adminClient
    .from('junior_artists_logs')
    .delete()
    .eq('project_id', projectId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (deleted.error) {
    if (isMissingRelationError(deleted.error, 'junior_artists_logs')) {
      await deleteActorsFallbackRecord(projectId, FALLBACK_JUNIOR_ENTITY, id)
      return
    }

    throw deleted.error
  }

  if (!deleted.data) {
    throw new HttpError(404, 'Junior artist log not found.')
  }
}

export async function createCallSheet(input: CallSheetCreateInput) {
  const { data, error } = await adminClient
    .from('call_sheets')
    .insert({
      project_id: input.projectId,
      shoot_date: input.shootDate,
      location: input.location,
      call_time: normalizeTimeForDb(input.callTime),
      actor_name: input.actorName,
      character_name: input.characterName ?? null,
      notes: input.notes ?? null,
    })
    .select('id, project_id, shoot_date, location, call_time, actor_name, character_name, notes, created_at')
    .single()

  if (error) {
    if (isMissingRelationError(error, 'call_sheets')) {
      const fallback = await insertActorsFallbackRecord({
        projectId: input.projectId,
        entity: FALLBACK_CALL_SHEET_ENTITY,
        entityLabel: input.actorName,
        payload: {
          projectId: input.projectId,
          shootDate: input.shootDate,
          location: input.location,
          callTime: input.callTime,
          actorName: input.actorName,
          characterName: input.characterName ?? null,
          notes: input.notes ?? null,
        },
      })

      return mapCallSheetFallbackRow(fallback)
    }

    throw error
  }

  return mapCallSheetRow(data as DbRow)
}

export async function listCallSheets(projectId: string) {
  const { data, error } = await adminClient
    .from('call_sheets')
    .select('id, project_id, shoot_date, location, call_time, actor_name, character_name, notes, created_at')
    .eq('project_id', projectId)
    .order('shoot_date', { ascending: true })
    .order('call_time', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'call_sheets')) {
      const fallbackRows = await listActorsFallbackRecords(projectId, FALLBACK_CALL_SHEET_ENTITY)
      const callSheets = fallbackRows
        .map(mapCallSheetFallbackRow)
        .sort((left, right) => {
          const dateDelta = left.shootDate.localeCompare(right.shootDate)
          if (dateDelta !== 0) {
            return dateDelta
          }

          const timeDelta = left.callTime.localeCompare(right.callTime)
          if (timeDelta !== 0) {
            return timeDelta
          }

          return left.createdAt.localeCompare(right.createdAt)
        })

      return {
        callSheets,
        groupedByDate: groupCallSheetsByDate(callSheets),
      }
    }

    throw error
  }

  const callSheets = ((data ?? []) as DbRow[]).map(mapCallSheetRow)
  const groupedByDate = groupCallSheetsByDate(callSheets)

  return {
    callSheets,
    groupedByDate,
  }
}

export async function getCallSheetById(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('call_sheets')
    .select('id, project_id, shoot_date, location, call_time, actor_name, character_name, notes, created_at')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error, 'call_sheets')) {
      const fallback = await getActorsFallbackRecord(projectId, FALLBACK_CALL_SHEET_ENTITY, id)
      if (!fallback) {
        throw new HttpError(404, 'Call sheet not found.')
      }

      return mapCallSheetFallbackRow(fallback)
    }

    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Call sheet not found.')
  }

  return mapCallSheetRow(data as DbRow)
}

export async function createActorPayment(input: ActorPaymentCreateInput) {
  const { data, error } = await adminClient
    .from('actor_payments')
    .insert({
      project_id: input.projectId,
      actor_name: input.actorName,
      payment_type: input.paymentType,
      amount: roundMoney(input.amount),
      payment_date: input.paymentDate,
      status: input.status,
    })
    .select('id, project_id, actor_name, payment_type, amount, payment_date, status, created_at')
    .single()

  if (error) {
    if (isMissingRelationError(error, 'actor_payments')) {
      const fallback = await insertActorsFallbackRecord({
        projectId: input.projectId,
        entity: FALLBACK_PAYMENT_ENTITY,
        entityLabel: input.actorName,
        payload: {
          projectId: input.projectId,
          actorName: input.actorName,
          paymentType: input.paymentType,
          amount: roundMoney(input.amount),
          paymentDate: input.paymentDate,
          status: input.status,
        },
      })

      return mapActorPaymentFallbackRow(fallback)
    }

    throw error
  }

  return mapActorPaymentRow(data as DbRow)
}

export async function listActorPayments(projectId: string) {
  const { data, error } = await adminClient
    .from('actor_payments')
    .select('id, project_id, actor_name, payment_type, amount, payment_date, status, created_at')
    .eq('project_id', projectId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingRelationError(error, 'actor_payments')) {
      return (await listActorsFallbackRecords(projectId, FALLBACK_PAYMENT_ENTITY))
        .map(mapActorPaymentFallbackRow)
        .sort((left, right) => {
          const dateDelta = right.paymentDate.localeCompare(left.paymentDate)
          if (dateDelta !== 0) {
            return dateDelta
          }

          return right.createdAt.localeCompare(left.createdAt)
        })
    }

    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapActorPaymentRow)
}

export async function updateActorPaymentStatus(id: string, input: ActorPaymentUpdateInput) {
  const { data, error } = await adminClient
    .from('actor_payments')
    .update({
      status: input.status,
    })
    .eq('project_id', input.projectId)
    .eq('id', id)
    .select('id, project_id, actor_name, payment_type, amount, payment_date, status, created_at')
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error, 'actor_payments')) {
      const fallback = await updateActorsFallbackRecord({
        projectId: input.projectId,
        entity: FALLBACK_PAYMENT_ENTITY,
        id,
        entityLabel: null,
        payload: {
          status: input.status,
        },
      })

      return mapActorPaymentFallbackRow(fallback)
    }

    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Actor payment not found.')
  }

  return mapActorPaymentRow(data as DbRow)
}

export async function createActorLook(input: ActorLookCreateInput, file?: Express.Multer.File) {
  if (!file) {
    throw new HttpError(400, 'A look test image is required.')
  }

  await ensureActorLooksBucket()

  const objectPath = `${input.projectId}/${randomUUID()}-${safeFileName(file.originalname)}`
  const uploaded = await adminClient.storage
    .from(ACTOR_LOOKS_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (uploaded.error) {
    throw uploaded.error
  }

  const publicUrl = buildActorLookUrl(objectPath)

  const created = await adminClient
    .from('actor_looks')
    .insert({
      project_id: input.projectId,
      actor_name: input.actorName,
      character_name: input.characterName ?? null,
      image_url: publicUrl,
      notes: input.notes ?? null,
      metadata: {
        imageUrl: publicUrl,
        storagePath: objectPath,
      },
    })
    .select('id, project_id, actor_name, character_name, image_url, notes, metadata, created_at')
    .single()

  if (created.error) {
    if (isMissingRelationError(created.error, 'actor_looks')) {
      const fallback = await insertActorsFallbackRecord({
        projectId: input.projectId,
        entity: FALLBACK_LOOK_ENTITY,
        entityLabel: input.actorName,
        payload: {
          projectId: input.projectId,
          actorName: input.actorName,
          characterName: input.characterName ?? null,
          imageUrl: objectPath,
          notes: input.notes ?? null,
          storagePath: objectPath,
        },
      })

      return mapActorLookFallbackRow(fallback)
    }

    await adminClient.storage.from(ACTOR_LOOKS_BUCKET).remove([objectPath])

    throw created.error
  }

  return mapActorLookRow(created.data as DbRow)
}

export async function listActorLooks(projectId: string, filters?: Pick<ActorLookQueryInput, 'actor' | 'character'>) {
  let query = adminClient
    .from('actor_looks')
    .select('id, project_id, actor_name, character_name, image_url, notes, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.actor) {
    query = query.ilike('actor_name', `%${filters.actor}%`)
  }

  if (filters?.character) {
    query = query.ilike('character_name', `%${filters.character}%`)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingRelationError(error, 'actor_looks')) {
      let looks = (await listActorsFallbackRecords(projectId, FALLBACK_LOOK_ENTITY))
        .map(mapActorLookFallbackRow)

      if (filters?.actor) {
        looks = looks.filter(look => look.actorName.toLowerCase().includes(filters.actor!.toLowerCase()))
      }

      if (filters?.character) {
        looks = looks.filter(look => (look.characterName ?? '').toLowerCase().includes(filters.character!.toLowerCase()))
      }

      return looks
    }

    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapActorLookRow)
}

export async function deleteActorLook(projectId: string, id: string) {
  const { data, error } = await adminClient
    .from('actor_looks')
    .select('id, project_id, image_url, metadata')
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error, 'actor_looks')) {
      const fallback = await getActorsFallbackRecord(projectId, FALLBACK_LOOK_ENTITY, id)
      if (!fallback) {
        throw new HttpError(404, 'Actor look not found.')
      }

      const payload = asObject(fallback.new_data)
      const storagePath = extractActorLookStoragePath(asString(payload.storagePath) ?? asString(payload.imageUrl))
      if (storagePath) {
        await adminClient.storage.from(ACTOR_LOOKS_BUCKET).remove([storagePath])
      }

      await deleteActorsFallbackRecord(projectId, FALLBACK_LOOK_ENTITY, id)
      return
    }

    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Actor look not found.')
  }

  const row = data as DbRow
  const metadata = asObject(row.metadata)
  const storagePath = extractActorLookStoragePath(asString(metadata.storagePath) ?? asString(row.image_url))
  if (storagePath) {
    await adminClient.storage.from(ACTOR_LOOKS_BUCKET).remove([storagePath])
  }

  const deleted = await adminClient
    .from('actor_looks')
    .delete()
    .eq('project_id', projectId)
    .eq('id', id)

  if (deleted.error) {
    if (isMissingRelationError(deleted.error, 'actor_looks')) {
      throwActorsModuleNotReady(deleted.error)
    }

    throw deleted.error
  }
}

export async function listActorAlerts(projectId: string) {
  const [juniors, callSheetsResponse, payments, looks] = await Promise.all([
    listJuniorArtistLogs(projectId),
    listCallSheets(projectId),
    listActorPayments(projectId),
    listActorLooks(projectId),
  ])

  const callSheets = callSheetsResponse.callSheets
  const alerts: Array<{ type: ActorAlertType; message: string; timestamp: string }> = []
  const today = todayDateOnly()
  const upcomingShootDates = Array.from(new Set(
    [...callSheets.map(sheet => sheet.shootDate), ...juniors.map(log => log.shootDate)]
      .filter(date => date >= today),
  )).sort()
  const upcomingShootDate = upcomingShootDates[0] ?? null

  if (upcomingShootDate && !callSheets.some(sheet => sheet.shootDate === upcomingShootDate)) {
    alerts.push(buildAlert(
      'critical',
      `Call sheets are missing for the upcoming shoot day on ${upcomingShootDate}.`,
      new Date().toISOString(),
    ))
  }

  if (upcomingShootDate && !juniors.some(log => log.shootDate === upcomingShootDate)) {
    alerts.push(buildAlert(
      'warning',
      `Junior artist entries are missing for the shoot day on ${upcomingShootDate}.`,
      new Date().toISOString(),
    ))
  }

  for (const payment of payments.filter(entry => entry.paymentType === 'batta' && entry.status === 'pending')) {
    alerts.push(buildAlert(
      payment.paymentDate < today ? 'critical' : 'warning',
      `Batta payment is still pending for ${payment.actorName}.`,
      payment.createdAt,
    ))
  }

  const lookCoverage = new Set(
    looks
      .map(item => normalizeActorKey(item.actorName))
      .filter(Boolean),
  )
  const missingLookActors = Array.from(new Set(
    callSheets
      .map(sheet => sheet.actorName)
      .filter(name => !lookCoverage.has(normalizeActorKey(name))),
  ))

  for (const actorName of missingLookActors) {
    alerts.push(buildAlert(
      'warning',
      `Look test is missing for ${actorName}.`,
      new Date().toISOString(),
    ))
  }

  return alerts
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 20)
}
