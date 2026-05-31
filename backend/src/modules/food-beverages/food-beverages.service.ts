import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { bridgeApproval, updateBridgedApprovalStatus } from '../../services/approvalBridge.service'
import { HttpError } from '../../utils/httpError'
import type {
  FoodBeverageDietaryProfileInput,
  FoodBeverageForecastInput,
  FoodBeverageInvoiceInput,
  FoodBeverageMealLogInput,
  FoodBeverageVendorInput,
} from './food-beverages.schemas'
import { deleteStoredUpload, saveInvoiceUpload, validateInvoiceUpload } from './food-beverages.files'
import type {
  FoodBeverageActivityLogRecord,
  FoodBeverageAnalyticsRecord,
  FoodBeverageDietaryProfileRecord,
  FoodBeverageForecastRecord,
  FoodBeverageForecastStatus,
  FoodBeverageInvoiceRecord,
  FoodBeverageMealLogRecord,
  FoodBeverageOverviewRecord,
  FoodBeverageVendorRecord,
  FoodBeverageVarianceAlertRecord,
} from './food-beverages.types'

type DbRow = Record<string, unknown>

const DEFAULT_DEPARTMENTS = ['camera', 'art', 'transport', 'direction', 'production', 'wardrobe', 'actors', 'post']

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
  const text = asString(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, delta: number) {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + delta)
  return next.toISOString().slice(0, 10)
}

function startOfMonthIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function formatTitle(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mealPeriodLabel(value: string | null) {
  if (!value) return 'All Day'
  return formatTitle(value)
}

async function getUserNameMap(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
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

async function getVendorNameMap(projectId: string, vendorIds: Array<string | null | undefined>) {
  const ids = [...new Set(vendorIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map<string, string>()

  const { data, error } = await adminClient
    .from('food_beverage_vendors')
    .select('id, name')
    .eq('project_id', projectId)
    .in('id', ids)

  if (error) {
    throw error
  }

  return new Map(((data ?? []) as DbRow[]).map(row => [String(row.id ?? ''), asString(row.name) ?? 'Vendor']))
}

async function logModuleActivity(params: {
  projectId: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  actorUserId: string | null
  actorUserName?: string | null
  beforeState?: unknown
  afterState?: unknown
  metadata?: Record<string, unknown>
}) {
  const activityId = randomUUID()
  const moduleMetadata = params.metadata ?? {}

  await adminClient.from('food_beverage_activity_logs').insert({
    id: activityId,
    project_id: params.projectId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    summary: params.summary,
    actor_user_id: params.actorUserId,
    actor_user_name: params.actorUserName ?? null,
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    metadata: moduleMetadata,
  })

  await adminClient.from('activity_logs').insert({
    id: randomUUID(),
    project_id: params.projectId,
    user_id: params.actorUserId,
    action: params.action,
    entity: params.entityType,
    entity_id: params.entityId,
    entity_label: params.summary,
    old_data: params.beforeState ?? null,
    new_data: params.afterState ?? null,
    context: moduleMetadata,
  })
}

async function createOrUpdateAlert(params: {
  projectId: string
  source: 'food_beverages'
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  entityTable: string
  entityId: string | null
  metadata?: Record<string, unknown>
}) {
  const existing = await adminClient
    .from('alerts')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('entity_table', params.entityTable)
    .eq('entity_id', params.entityId)
    .eq('source', params.source)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  const payload = {
    project_id: params.projectId,
    source: params.source,
    severity: params.severity,
    title: params.title,
    message: params.message,
    status: 'open',
    entity_table: params.entityTable,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  }

  if (existing.data) {
    const { error } = await adminClient
      .from('alerts')
      .update(payload)
      .eq('id', String(existing.data.id))

    if (error) {
      throw error
    }
    return String(existing.data.id)
  }

  const { data, error } = await adminClient
    .from('alerts')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw error
  }

  return String(data.id)
}

function mapVendorRow(row: DbRow): FoodBeverageVendorRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    name: asString(row.name) ?? 'Vendor',
    category: asString(row.category),
    contactName: asString(row.contact_name),
    email: asString(row.email),
    phone: asString(row.phone),
    paymentTerms: asString(row.payment_terms),
    active: asBoolean(row.active),
    notes: asString(row.notes),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asString(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapForecastRow(row: DbRow, submittedByName?: string | null): FoodBeverageForecastRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    forecastDate: asDateOnly(row.forecast_date) ?? todayIso(),
    department: asString(row.department) ?? 'production',
    mealCount: Math.max(0, Math.round(asNumber(row.meal_count) ?? 0)),
    mealPeriod: (asString(row.meal_period) as FoodBeverageForecastRecord['mealPeriod']) ?? null,
    isEstimated: asBoolean(row.is_estimated),
    status: (asString(row.status) === 'estimated' ? 'estimated' : 'submitted') as FoodBeverageForecastStatus,
    submittedBy: asString(row.submitted_by),
    submittedByName: submittedByName ?? null,
    submittedAt: asString(row.submitted_at) ?? new Date().toISOString(),
    notes: asString(row.notes),
  }
}

function mapMealLogRow(row: DbRow, vendorName?: string | null, createdByName?: string | null): FoodBeverageMealLogRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    mealDate: asDateOnly(row.meal_date) ?? todayIso(),
    department: asString(row.department) ?? 'production',
    mealPeriod: (asString(row.meal_period) as FoodBeverageMealLogRecord['mealPeriod']) ?? 'lunch',
    mealsServed: Math.max(0, Math.round(asNumber(row.meals_served) ?? 0)),
    wasteCount: Math.max(0, Math.round(asNumber(row.waste_count) ?? 0)),
    vendorId: asString(row.vendor_id),
    vendorName: vendorName ?? null,
    notes: asString(row.notes),
    createdBy: asString(row.created_by),
    createdByName: createdByName ?? null,
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
  }
}

function mapDietaryRow(row: DbRow): FoodBeverageDietaryProfileRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    department: asString(row.department) ?? 'production',
    vegetarianCount: Math.max(0, Math.round(asNumber(row.vegetarian_count) ?? 0)),
    veganCount: Math.max(0, Math.round(asNumber(row.vegan_count) ?? 0)),
    jainCount: Math.max(0, Math.round(asNumber(row.jain_count) ?? 0)),
    glutenFreeCount: Math.max(0, Math.round(asNumber(row.gluten_free_count) ?? 0)),
    allergenNotes: asString(row.allergen_notes),
    contactName: asString(row.contact_name),
    contactPhone: asString(row.contact_phone),
    notes: asString(row.notes),
    updatedAt: asString(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapInvoiceRow(row: DbRow, approvalStatus: FoodBeverageInvoiceRecord['approvalStatus'] = 'not_requested'): FoodBeverageInvoiceRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    vendorId: asString(row.vendor_id),
    vendorName: asString(row.vendor_name),
    invoiceNumber: asString(row.invoice_number) ?? 'Invoice',
    invoiceDate: asDateOnly(row.invoice_date) ?? todayIso(),
    amount: Math.max(0, asNumber(row.amount) ?? 0),
    currencyCode: asString(row.currency_code) ?? 'INR',
    status: (asString(row.status) as FoodBeverageInvoiceRecord['status']) ?? 'submitted',
    approvalRequested: asBoolean(row.approval_requested),
    approvalId: asString(row.approval_id),
    approvalStatus,
    fileUrl: asString(row.file_url),
    notes: asString(row.notes),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asString(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapVarianceRow(row: DbRow): FoodBeverageVarianceAlertRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    alertDate: asDateOnly(row.alert_date) ?? todayIso(),
    department: asString(row.department) ?? 'production',
    vendorName: asString(row.vendor_name),
    forecastCount: Math.max(0, Math.round(asNumber(row.forecast_count) ?? 0)),
    servedCount: Math.max(0, Math.round(asNumber(row.served_count) ?? 0)),
    varianceCount: Math.round(asNumber(row.variance_count) ?? 0),
    variancePercent: Number((asNumber(row.variance_percent) ?? 0).toFixed(2)),
    severity: (asString(row.severity) as FoodBeverageVarianceAlertRecord['severity']) ?? 'info',
    message: asString(row.message) ?? '',
    acknowledgedAt: asString(row.acknowledged_at),
  }
}

function mapActivityRow(row: DbRow): FoodBeverageActivityLogRecord {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    action: asString(row.action) ?? 'updated',
    entityType: asString(row.entity_type) ?? 'food_beverages',
    entityId: asString(row.entity_id),
    summary: asString(row.summary) ?? 'Activity',
    actorUserId: asString(row.actor_user_id),
    actorUserName: asString(row.actor_user_name),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
  }
}

async function getApprovalStatusMap(approvalIds: Array<string | null | undefined>) {
  const ids = [...new Set(approvalIds.filter((id): id is string => Boolean(id)))]
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

async function ensureProjectRecord(projectId: string) {
  const { data, error } = await adminClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Project not found.')
  }
}

async function recalculateVarianceAlerts(projectId: string) {
  const { data: forecastRows, error: forecastError } = await adminClient
    .from('food_beverage_forecasts')
    .select('*')
    .eq('project_id', projectId)

  if (forecastError) throw forecastError

  const { data: mealRows, error: mealError } = await adminClient
    .from('food_beverage_meal_logs')
    .select('*')
    .eq('project_id', projectId)

  if (mealError) throw mealError

  const forecastMap = new Map<string, number>()
  for (const row of (forecastRows ?? []) as DbRow[]) {
    const date = asDateOnly(row.forecast_date)
    const department = asString(row.department)
    if (!date || !department) continue
    const key = `${date}:${department}`
    forecastMap.set(key, (forecastMap.get(key) ?? 0) + (asNumber(row.meal_count) ?? 0))
  }

  const mealMap = new Map<string, { served: number; waste: number }>()
  for (const row of (mealRows ?? []) as DbRow[]) {
    const date = asDateOnly(row.meal_date)
    const department = asString(row.department)
    if (!date || !department) continue
    const key = `${date}:${department}`
    const entry = mealMap.get(key) ?? { served: 0, waste: 0 }
    entry.served += asNumber(row.meals_served) ?? 0
    entry.waste += asNumber(row.waste_count) ?? 0
    mealMap.set(key, entry)
  }

  const keys = new Set([...forecastMap.keys(), ...mealMap.keys()])
  const { error: deleteError } = await adminClient
    .from('food_beverage_variance_alerts')
    .delete()
    .eq('project_id', projectId)

  if (deleteError) throw deleteError

  for (const key of keys) {
    const [alertDate, department] = key.split(':')
    const forecastCount = forecastMap.get(key) ?? 0
    const meal = mealMap.get(key) ?? { served: 0, waste: 0 }
    const varianceCount = meal.served - forecastCount
    const variancePercent = forecastCount > 0 ? (varianceCount / forecastCount) * 100 : (meal.served > 0 ? 100 : 0)
    const wastePercent = meal.served > 0 ? (meal.waste / meal.served) * 100 : 0
    const absoluteVariance = Math.abs(variancePercent)

    const severity: FoodBeverageVarianceAlertRecord['severity'] =
      absoluteVariance >= 20 || wastePercent >= 15
        ? 'critical'
        : absoluteVariance >= 10 || wastePercent >= 8
          ? 'warning'
          : 'info'

    const message = `Forecast ${forecastCount} vs served ${meal.served} (${varianceCount >= 0 ? '+' : ''}${varianceCount}).`
    const { error: insertError } = await adminClient
      .from('food_beverage_variance_alerts')
      .insert({
        id: randomUUID(),
        project_id: projectId,
        alert_date: alertDate,
        department,
        vendor_name: null,
        forecast_count: forecastCount,
        served_count: meal.served,
        variance_count: varianceCount,
        variance_percent: Number(variancePercent.toFixed(2)),
        severity,
        message,
        acknowledged_at: null,
        metadata: {
          wasteCount: meal.waste,
          wastePercent: Number(wastePercent.toFixed(2)),
        },
      })

    if (insertError) {
      throw insertError
    }

    if (severity !== 'info') {
      await createOrUpdateAlert({
        projectId,
        source: 'food_beverages',
        severity,
        title: severity === 'critical' ? 'Vendor discrepancy detected' : 'Food forecast variance',
        message,
        entityTable: 'food_beverage_variance_alerts',
        entityId: null,
        metadata: {
          alertDate,
          department,
          forecastCount,
          servedCount: meal.served,
          varianceCount,
          variancePercent: Number(variancePercent.toFixed(2)),
        },
      })
    }
  }
}

function buildForecastEstimateRows(projectId: string, rows: DbRow[], targetDate: string) {
  const byDepartment = new Map<string, DbRow>()
  for (const row of rows) {
    const department = asString(row.department) ?? 'production'
    if (asDateOnly(row.forecast_date) === targetDate) {
      byDepartment.set(department, row)
    }
  }

  const estimateSource = new Map<string, { total: number; count: number; mealPeriod: string | null }>()
  for (const row of rows) {
    const date = asDateOnly(row.forecast_date)
    if (!date || date >= targetDate) continue
    const department = asString(row.department) ?? 'production'
    const key = department
    const entry = estimateSource.get(key) ?? { total: 0, count: 0, mealPeriod: asString(row.meal_period) }
    entry.total += asNumber(row.meal_count) ?? 0
    entry.count += 1
    estimateSource.set(key, entry)
  }

  const departments = new Set<string>([...DEFAULT_DEPARTMENTS, ...rows.map(row => asString(row.department) ?? '').filter(Boolean)])
  const result: DbRow[] = [...byDepartment.values()]

  for (const department of departments) {
    if (byDepartment.has(department)) continue
    const source = estimateSource.get(department)
    const estimatedCount = source && source.count > 0 ? Math.round(source.total / source.count) : 0
    result.push({
      id: `estimated:${targetDate}:${department}`,
      project_id: projectId,
      forecast_date: targetDate,
      department,
      meal_count: estimatedCount,
      meal_period: source?.mealPeriod ?? null,
      is_estimated: true,
      status: 'estimated',
      submitted_by: null,
      submitted_at: new Date().toISOString(),
      notes: 'Estimated from the last 7 days.',
    })
  }

  return result
}

export async function getFoodBeveragesOverview(projectId: string): Promise<FoodBeverageOverviewRecord> {
  await ensureProjectRecord(projectId)
  const today = todayIso()
  const monthStart = startOfMonthIso()

  const [forecastResult, mealResult, invoiceResult, activityResult, alertsResult] = await Promise.all([
    adminClient.from('food_beverage_forecasts').select('*').eq('project_id', projectId).eq('forecast_date', today),
    adminClient.from('food_beverage_meal_logs').select('*').eq('project_id', projectId).eq('meal_date', today),
    adminClient.from('food_beverage_invoices').select('*').eq('project_id', projectId),
    adminClient.from('food_beverage_activity_logs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(6),
    adminClient.from('alerts').select('id, title, message, severity, status, acknowledged_at').eq('project_id', projectId).eq('source', 'food_beverages').in('status', ['open', 'acknowledged']).order('created_at', { ascending: false }).limit(5),
  ])

  if (forecastResult.error) throw forecastResult.error
  if (mealResult.error) throw mealResult.error
  if (invoiceResult.error) throw invoiceResult.error
  if (activityResult.error) throw activityResult.error
  if (alertsResult.error) throw alertsResult.error

  const todayForecast = ((forecastResult.data ?? []) as DbRow[]).reduce((total, row) => total + (asNumber(row.meal_count) ?? 0), 0)
  const mealsServed = ((mealResult.data ?? []) as DbRow[]).reduce((total, row) => total + (asNumber(row.meals_served) ?? 0), 0)
  const wasteCount = ((mealResult.data ?? []) as DbRow[]).reduce((total, row) => total + (asNumber(row.waste_count) ?? 0), 0)
  const variance = mealsServed - todayForecast
  const wastePercent = mealsServed > 0 ? (wasteCount / mealsServed) * 100 : 0
  const costToday = ((invoiceResult.data ?? []) as DbRow[])
    .filter(row => asDateOnly(row.invoice_date) === today)
    .reduce((total, row) => total + (asNumber(row.amount) ?? 0), 0)
  const monthlyBurn = ((invoiceResult.data ?? []) as DbRow[])
    .filter(row => {
      const date = asDateOnly(row.invoice_date)
      return date ? date >= monthStart : false
    })
    .reduce((total, row) => total + (asNumber(row.amount) ?? 0), 0)

  return {
    todaysForecast: Math.round(todayForecast),
    mealsServed: Math.round(mealsServed),
    variance: Math.round(variance),
    wastePercent: Number(wastePercent.toFixed(2)),
    costToday: Number(costToday.toFixed(2)),
    monthlyBurn: Number(monthlyBurn.toFixed(2)),
    alerts: ((alertsResult.data ?? []) as DbRow[]).map(row => ({
      id: String(row.id ?? ''),
      title: asString(row.title) ?? 'Alert',
      message: asString(row.message) ?? '',
      severity: (asString(row.severity) as FoodBeverageOverviewRecord['alerts'][number]['severity']) ?? 'info',
      acknowledged: asString(row.status) !== 'open',
    })),
    recentActivity: ((activityResult.data ?? []) as DbRow[]).map(mapActivityRow),
  }
}

export async function listFoodBeverageVendors(projectId: string): Promise<FoodBeverageVendorRecord[]> {
  await ensureProjectRecord(projectId)
  const { data, error } = await adminClient
    .from('food_beverage_vendors')
    .select('*')
    .eq('project_id', projectId)
    .order('active', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapVendorRow)
}

export async function createFoodBeverageVendor(input: FoodBeverageVendorInput, actorUserId: string | null, actorUserName: string | null) {
  const { data, error } = await adminClient
    .from('food_beverage_vendors')
    .insert({
      id: randomUUID(),
      project_id: input.projectId,
      name: input.name.trim(),
      category: input.category ?? null,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      payment_terms: input.paymentTerms ?? null,
      active: input.active ?? true,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select('*')
    .single()

  if (error) throw error

  const vendor = mapVendorRow(data as DbRow)
  await logModuleActivity({
    projectId: input.projectId,
    action: 'vendor_created',
    entityType: 'food_beverage_vendors',
    entityId: vendor.id,
    summary: `Vendor created: ${vendor.name}`,
    actorUserId,
    actorUserName,
    afterState: vendor,
  })

  return vendor
}

export async function updateFoodBeverageVendor(projectId: string, vendorId: string, input: FoodBeverageVendorInput, actorUserId: string | null, actorUserName: string | null) {
  const before = await adminClient
    .from('food_beverage_vendors')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', vendorId)
    .maybeSingle()

  if (before.error) throw before.error
  if (!before.data) throw new HttpError(404, 'Vendor not found.')

  const { data, error } = await adminClient
    .from('food_beverage_vendors')
    .update({
      name: input.name.trim(),
      category: input.category ?? null,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      payment_terms: input.paymentTerms ?? null,
      active: input.active ?? true,
      notes: input.notes ?? null,
      updated_by: actorUserId,
    })
    .eq('project_id', projectId)
    .eq('id', vendorId)
    .select('*')
    .single()

  if (error) throw error

  const vendor = mapVendorRow(data as DbRow)
  await logModuleActivity({
    projectId,
    action: 'vendor_updated',
    entityType: 'food_beverage_vendors',
    entityId: vendor.id,
    summary: `Vendor updated: ${vendor.name}`,
    actorUserId,
    actorUserName,
    beforeState: before.data,
    afterState: vendor,
  })

  return vendor
}

export async function listFoodBeverageForecasts(projectId: string, date?: string | null) {
  await ensureProjectRecord(projectId)
  const targetDate = asDateOnly(date) ?? addDays(todayIso(), 1)
  const rangeStart = addDays(targetDate, -7)
  const { data, error } = await adminClient
    .from('food_beverage_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .gte('forecast_date', rangeStart)
    .lte('forecast_date', targetDate)
    .order('forecast_date', { ascending: true })
    .order('department', { ascending: true })

  if (error) throw error

  const userNames = await getUserNameMap(((data ?? []) as DbRow[]).map(row => asString(row.submitted_by)))
  const rows = ((data ?? []) as DbRow[]).map(row => mapForecastRow(row, userNames.get(String(row.submitted_by ?? '')) ?? null))
  const estimatedRows = buildForecastEstimateRows(projectId, (data ?? []) as DbRow[], targetDate)
    .filter(row => asDateOnly(row.forecast_date) === targetDate && asBoolean(row.is_estimated))
    .map(row => mapForecastRow(row, null))

  return [...rows.filter(row => row.forecastDate !== targetDate || !row.isEstimated), ...estimatedRows]
    .sort((left, right) => left.department.localeCompare(right.department))
}

export async function createFoodBeverageForecast(input: FoodBeverageForecastInput, actorUserId: string | null, actorUserName: string | null) {
  const { data, error } = await adminClient
    .from('food_beverage_forecasts')
    .upsert({
      id: randomUUID(),
      project_id: input.projectId,
      forecast_date: input.forecastDate,
      department: input.department.trim().toLowerCase(),
      meal_count: input.mealCount,
      meal_period: input.mealPeriod ?? null,
      is_estimated: false,
      status: 'submitted',
      submitted_by: actorUserId,
      submitted_at: new Date().toISOString(),
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'project_id,forecast_date,department',
    })
    .select('*')
    .single()

  if (error) throw error

  const forecast = mapForecastRow(data as DbRow, actorUserName)
  await logModuleActivity({
    projectId: input.projectId,
    action: 'forecast_submitted',
    entityType: 'food_beverage_forecasts',
    entityId: forecast.id,
    summary: `Forecast submitted for ${forecast.department}`,
    actorUserId,
    actorUserName,
    afterState: forecast,
  })

  await recalculateVarianceAlerts(input.projectId)
  return forecast
}

export async function listFoodBeverageMealLogs(projectId: string, date?: string | null) {
  await ensureProjectRecord(projectId)
  const query = adminClient
    .from('food_beverage_meal_logs')
    .select('*')
    .eq('project_id', projectId)

  if (date) {
    query.eq('meal_date', asDateOnly(date) ?? date)
  }

  const { data, error } = await query.order('meal_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error

  const vendorNameMap = await getVendorNameMap(projectId, ((data ?? []) as DbRow[]).map(row => asString(row.vendor_id)))
  const userNameMap = await getUserNameMap(((data ?? []) as DbRow[]).map(row => asString(row.created_by)))

  return ((data ?? []) as DbRow[]).map(row => mapMealLogRow(
    row,
    vendorNameMap.get(String(row.vendor_id ?? '')) ?? null,
    userNameMap.get(String(row.created_by ?? '')) ?? null,
  ))
}

export async function createFoodBeverageMealLog(input: FoodBeverageMealLogInput, actorUserId: string | null, actorUserName: string | null) {
  const vendorNameMap = await getVendorNameMap(input.projectId, [input.vendorId ?? null])
  const { data, error } = await adminClient
    .from('food_beverage_meal_logs')
    .insert({
      id: randomUUID(),
      project_id: input.projectId,
      meal_date: input.mealDate,
      department: input.department.trim().toLowerCase(),
      meal_period: input.mealPeriod,
      meals_served: input.mealsServed,
      waste_count: input.wasteCount ?? 0,
      vendor_id: input.vendorId ?? null,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select('*')
    .single()

  if (error) throw error

  const mealLog = mapMealLogRow(data as DbRow, vendorNameMap.get(String(input.vendorId ?? '')) ?? null, actorUserName)
  await logModuleActivity({
    projectId: input.projectId,
    action: 'meal_logged',
    entityType: 'food_beverage_meal_logs',
    entityId: mealLog.id,
    summary: `Meal log added for ${mealLog.department}`,
    actorUserId,
    actorUserName,
    afterState: mealLog,
  })

  await recalculateVarianceAlerts(input.projectId)
  return mealLog
}

export async function listFoodBeverageDietaryProfiles(projectId: string, department?: string | null) {
  await ensureProjectRecord(projectId)
  let query = adminClient
    .from('food_beverage_dietary_profiles')
    .select('*')
    .eq('project_id', projectId)

  if (department) {
    query = query.eq('department', department.trim().toLowerCase())
  }

  const { data, error } = await query.order('department', { ascending: true })
  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapDietaryRow)
}

export async function upsertFoodBeverageDietaryProfile(input: FoodBeverageDietaryProfileInput, actorUserId: string | null, actorUserName: string | null) {
  const { data, error } = await adminClient
    .from('food_beverage_dietary_profiles')
    .upsert({
      id: randomUUID(),
      project_id: input.projectId,
      department: input.department.trim().toLowerCase(),
      vegetarian_count: input.vegetarianCount ?? 0,
      vegan_count: input.veganCount ?? 0,
      jain_count: input.jainCount ?? 0,
      gluten_free_count: input.glutenFreeCount ?? 0,
      allergen_notes: input.allergenNotes ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      notes: input.notes ?? null,
      updated_by: actorUserId,
    }, {
      onConflict: 'project_id,department',
    })
    .select('*')
    .single()

  if (error) throw error

  const profile = mapDietaryRow(data as DbRow)
  await logModuleActivity({
    projectId: input.projectId,
    action: 'dietary_profile_saved',
    entityType: 'food_beverage_dietary_profiles',
    entityId: profile.id,
    summary: `Dietary profile updated for ${profile.department}`,
    actorUserId,
    actorUserName,
    afterState: profile,
  })

  return profile
}

export async function listFoodBeverageInvoices(projectId: string, status?: string | null) {
  await ensureProjectRecord(projectId)
  const query = adminClient
    .from('food_beverage_invoices')
    .select('*')
    .eq('project_id', projectId)

  if (status) {
    query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  const approvalMap = await getApprovalStatusMap(((data ?? []) as DbRow[]).map(row => asString(row.approval_id)))
  const vendorNameMap = await getVendorNameMap(projectId, ((data ?? []) as DbRow[]).map(row => asString(row.vendor_id)))

  return ((data ?? []) as DbRow[]).map(row => mapInvoiceRow(
    {
      ...row,
      vendor_name: vendorNameMap.get(String(row.vendor_id ?? '')) ?? null,
    },
    row.approval_id ? (approvalMap.get(String(row.approval_id)) as FoodBeverageInvoiceRecord['approvalStatus'] ?? 'pending') : 'not_requested',
  ))
}

export async function createFoodBeverageInvoice(input: FoodBeverageInvoiceInput, actorUserId: string | null, actorUserName: string | null, file?: Express.Multer.File | null) {
  let uploadData: { url: string; storagePath: string } | null = null
  if (file) {
    validateInvoiceUpload(file)
    uploadData = saveInvoiceUpload(file)
  }

  const { data, error } = await adminClient
    .from('food_beverage_invoices')
    .insert({
      id: randomUUID(),
      project_id: input.projectId,
      vendor_id: input.vendorId ?? null,
      invoice_number: input.invoiceNumber.trim(),
      invoice_date: input.invoiceDate,
      amount: input.amount,
      currency_code: input.currencyCode ?? 'INR',
      status: input.status ?? 'submitted',
      approval_requested: input.approvalRequested ?? false,
      approval_id: null,
      file_url: uploadData?.url ?? null,
      storage_path: uploadData?.storagePath ?? null,
      notes: input.notes ?? null,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select('*')
    .single()

  if (error) {
    if (uploadData) {
      deleteStoredUpload(uploadData.storagePath)
    }
    throw error
  }

  let approvalId: string | null = null
  if (input.approvalRequested) {
    approvalId = await bridgeApproval({
      projectId: input.projectId,
      type: 'catering',
      department: 'production',
      requestedBy: actorUserId ?? '',
      title: `Food & Beverages invoice ${input.invoiceNumber}`,
      description: input.notes ?? `Invoice submitted for ${input.invoiceNumber}.`,
      amount: input.amount,
      sourceModule: 'food_beverages',
      approvableTable: 'food_beverage_invoices',
      approvableId: String((data as DbRow).id ?? ''),
      metadata: {
        invoiceNumber: input.invoiceNumber,
        vendorId: input.vendorId ?? null,
      },
    })
  }

  if (approvalId) {
    const { error: updateError } = await adminClient
      .from('food_beverage_invoices')
      .update({ approval_id: approvalId })
      .eq('id', String((data as DbRow).id ?? ''))

    if (updateError) {
      throw updateError
    }
  }

  if (input.approvalRequested) {
    await createOrUpdateAlert({
      projectId: input.projectId,
      source: 'food_beverages',
      severity: 'warning',
      title: 'Invoice pending approval',
      message: `Invoice ${input.invoiceNumber} is waiting for finance approval.`,
      entityTable: 'food_beverage_invoices',
      entityId: String((data as DbRow).id ?? ''),
      metadata: { invoiceNumber: input.invoiceNumber },
    })
  }

  const invoice = mapInvoiceRow({
    ...(data as DbRow),
    vendor_name: null,
    approval_id: approvalId,
  }, input.approvalRequested ? 'pending' : 'not_requested')

  await logModuleActivity({
    projectId: input.projectId,
    action: 'invoice_created',
    entityType: 'food_beverage_invoices',
    entityId: invoice.id,
    summary: `Invoice added: ${invoice.invoiceNumber}`,
    actorUserId,
    actorUserName,
    afterState: invoice,
  })

  return invoice
}

export async function updateFoodBeverageInvoice(projectId: string, invoiceId: string, input: Partial<FoodBeverageInvoiceInput> & { projectId: string }, actorUserId: string | null, actorUserName: string | null) {
  const before = await adminClient
    .from('food_beverage_invoices')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', invoiceId)
    .maybeSingle()

  if (before.error) throw before.error
  if (!before.data) throw new HttpError(404, 'Invoice not found.')

  const beforeRow = before.data as DbRow
  const resolvedInput: FoodBeverageInvoiceInput = {
    projectId: input.projectId,
    vendorId: input.vendorId ?? asString(beforeRow.vendor_id),
    invoiceNumber: input.invoiceNumber ?? asString(beforeRow.invoice_number) ?? '',
    invoiceDate: input.invoiceDate ?? asDateOnly(beforeRow.invoice_date) ?? todayIso(),
    amount: input.amount ?? (asNumber(beforeRow.amount) ?? 0),
    currencyCode: input.currencyCode ?? asString(beforeRow.currency_code) ?? 'INR',
    approvalRequested: input.approvalRequested ?? asBoolean(beforeRow.approval_requested),
    status: input.status ?? (asString(beforeRow.status) as FoodBeverageInvoiceInput['status']) ?? 'submitted',
    notes: input.notes ?? asString(beforeRow.notes) ?? null,
  }

  const { data, error } = await adminClient
    .from('food_beverage_invoices')
    .update({
      vendor_id: resolvedInput.vendorId ?? null,
      invoice_number: resolvedInput.invoiceNumber.trim(),
      invoice_date: resolvedInput.invoiceDate,
      amount: resolvedInput.amount,
      currency_code: resolvedInput.currencyCode ?? 'INR',
      status: resolvedInput.status,
      approval_requested: resolvedInput.approvalRequested ?? false,
      notes: resolvedInput.notes ?? null,
      updated_by: actorUserId,
    })
    .eq('project_id', projectId)
    .eq('id', invoiceId)
    .select('*')
    .single()

  if (error) throw error

  const invoice = mapInvoiceRow(data as DbRow, resolvedInput.approvalRequested ? 'pending' : 'not_requested')

  if (resolvedInput.status === 'approved' || resolvedInput.status === 'rejected') {
    await updateBridgedApprovalStatus({
      projectId,
      approvableTable: 'food_beverage_invoices',
      approvableId: invoiceId,
      status: resolvedInput.status,
      actorUserId,
      reason: resolvedInput.notes ?? null,
    })
  }

  await logModuleActivity({
    projectId,
    action: 'invoice_updated',
    entityType: 'food_beverage_invoices',
    entityId: invoice.id,
    summary: `Invoice updated: ${invoice.invoiceNumber}`,
    actorUserId,
    actorUserName,
    beforeState: before.data,
    afterState: invoice,
  })

  return invoice
}

export async function getFoodBeverageAnalytics(projectId: string): Promise<FoodBeverageAnalyticsRecord> {
  await ensureProjectRecord(projectId)

  const [forecastRows, mealRows, invoiceRows, vendorRows] = await Promise.all([
    adminClient.from('food_beverage_forecasts').select('*').eq('project_id', projectId),
    adminClient.from('food_beverage_meal_logs').select('*').eq('project_id', projectId),
    adminClient.from('food_beverage_invoices').select('*').eq('project_id', projectId),
    adminClient.from('food_beverage_vendors').select('*').eq('project_id', projectId),
  ])

  if (forecastRows.error) throw forecastRows.error
  if (mealRows.error) throw mealRows.error
  if (invoiceRows.error) throw invoiceRows.error
  if (vendorRows.error) throw vendorRows.error

  const forecasts = ((forecastRows.data ?? []) as DbRow[])
  const meals = ((mealRows.data ?? []) as DbRow[])
  const invoices = ((invoiceRows.data ?? []) as DbRow[])
  const vendors = ((vendorRows.data ?? []) as DbRow[])

  const submitted = forecasts.filter(row => !asBoolean(row.is_estimated)).length
  const estimated = forecasts.filter(row => asBoolean(row.is_estimated)).length
  const total = forecasts.length
  const totalWaste = meals.reduce((sum, row) => sum + (asNumber(row.waste_count) ?? 0), 0)
  const totalServed = meals.reduce((sum, row) => sum + (asNumber(row.meals_served) ?? 0), 0)
  const averageWastePercent = totalServed > 0 ? (totalWaste / totalServed) * 100 : 0
  const highWasteDays = meals.filter(row => (asNumber(row.waste_count) ?? 0) > 20).length
  const monthStart = startOfMonthIso()
  const monthlyBurn = invoices
    .filter(row => {
      const date = asDateOnly(row.invoice_date)
      return date ? date >= monthStart : false
    })
    .reduce((sum, row) => sum + (asNumber(row.amount) ?? 0), 0)
  const pendingApproval = invoices
    .filter(row => asBoolean(row.approval_requested) && asString(row.status) === 'submitted')
    .reduce((sum, row) => sum + (asNumber(row.amount) ?? 0), 0)

  const vendorPerformance = vendors.slice(0, 5).map(vendor => {
    const vendorInvoices = invoices.filter(row => String(row.vendor_id ?? '') === String(vendor.id ?? ''))
    const vendorMealLogs = meals.filter(row => String(row.vendor_id ?? '') === String(vendor.id ?? ''))
    const vendorForecasts = forecasts.filter(row => String(row.department ?? '') === String(vendor.category ?? '')).length
    const servedCount = vendorMealLogs.reduce((sum, row) => sum + (asNumber(row.meals_served) ?? 0), 0)
    const forecastCount = vendorForecasts
    const variancePercent = forecastCount > 0 ? ((servedCount - forecastCount) / forecastCount) * 100 : 0
    const invoiceTotal = vendorInvoices.reduce((sum, row) => sum + (asNumber(row.amount) ?? 0), 0)
    return {
      vendorName: asString(vendor.name) ?? 'Vendor',
      forecastCount,
      servedCount,
      variancePercent: Number(variancePercent.toFixed(2)),
      invoiceTotal: Number(invoiceTotal.toFixed(2)),
    }
  })

  return {
    forecastCoverage: { submitted, estimated, total },
    wasteSummary: {
      totalWaste,
      averageWastePercent: Number(averageWastePercent.toFixed(2)),
      highWasteDays,
    },
    costSummary: {
      total: Number(invoices.reduce((sum, row) => sum + (asNumber(row.amount) ?? 0), 0).toFixed(2)),
      monthlyBurn: Number(monthlyBurn.toFixed(2)),
      pendingApproval: Number(pendingApproval.toFixed(2)),
    },
    vendorPerformance,
  }
}

export async function listFoodBeverageTimeline(projectId: string) {
  await ensureProjectRecord(projectId)
  const { data, error } = await adminClient
    .from('food_beverage_activity_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapActivityRow)
}

export async function listFoodBeverageAlerts(projectId: string) {
  await ensureProjectRecord(projectId)
  const { data, error } = await adminClient
    .from('food_beverage_variance_alerts')
    .select('*')
    .eq('project_id', projectId)
    .order('alert_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as DbRow[]).map(mapVarianceRow)
}
