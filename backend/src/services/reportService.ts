import { adminClient } from '../config/supabaseClient'
import { deleteCacheKey, getCacheJson, setCacheJson } from './cache.service'
import { HttpError } from '../utils/httpError'
import { runtimeBuffer } from '../utils/runtime'

const REPORT_CACHE_TTL_SECONDS = 120
const SNAPSHOT_STALE_AFTER_MS = 15 * 60 * 1000
const REPORT_SNAPSHOT_TITLE = 'Reports Dashboard Snapshot'

const REPORT_DEPARTMENTS = ['transport', 'crew', 'camera', 'art', 'wardrobe', 'post', 'production'] as const

type ReportDepartmentKey = typeof REPORT_DEPARTMENTS[number]
type ReportSeverity = 'GREEN' | 'YELLOW' | 'RED'
type FinancialMetricDepartment = Exclude<ReportDepartmentKey, 'crew'>

interface ProjectMetaRow {
  id: string
  name: string
  budget: number | string | null
  start_date: string | null
  end_date: string | null
  is_archived: boolean | null
}

interface DepartmentRow {
  department: string
}

interface BurnRateRow {
  date: string
  total_transport_cost: number | string | null
  total_crew_cost: number | string | null
  total_camera_cost: number | string | null
  total_art_cost: number | string | null
  total_wardrobe_cost: number | string | null
  total_post_cost: number | string | null
  total_production_cost: number | string | null
  grand_total_daily_spend: number | string | null
}

interface BudgetTrackingRow {
  department: string
  allocated_budget: number | string | null
  actual_spent: number | string | null
  committed_spend: number | string | null
  pending_approval_amount: number | string | null
  variance: number | string | null
}

interface PendingApprovalRow {
  department: string | null
  type: string | null
  amount: number | string | null
}

interface OtLiabilityRow {
  current_shift_date: string
  active_crew_count: number | string | null
  total_ot_hours: number | string | null
  estimated_ot_cost: number | string | null
}

interface ProjectSettingsRow {
  alert_thresholds: Record<string, unknown> | null
}

interface FuelLogRow {
  id: string
  expected_mileage: number | string | null
  actual_mileage: number | string | null
  vehicle_id: string | null
  log_date: string
}

interface ReportAlertRow {
  id: string
  department: string | null
  type: string
  severity: string
  message: string
  resolved: boolean
  created_at: string
  metadata: Record<string, unknown> | null
}

interface ReportSnapshotRow {
  id: string
  snapshot: Record<string, unknown> | null
}

export interface ReportsAccessContext {
  authRole?: string | null
  membershipRole?: string | null
  projectRole?: string | null
  department?: string | null
  isOwner?: boolean
}

export interface ReportsScope {
  type: 'full' | 'department'
  departments: ReportDepartmentKey[]
  label: string
}

export interface BurnChartPoint {
  date: string
  actual: number
  planned: number
  transport: number
  crew: number
  camera: number
  art: number
  wardrobe: number
  post: number
  production: number
}

export interface DepartmentReportRow {
  department: ReportDepartmentKey
  label: string
  spent: number
  budget: number
  variance: number
  pendingApprovals: number
  overtimeLiability: number
  share: number
  status: 'green' | 'yellow' | 'red'
}

export interface ReportAlertItem {
  id: string
  type: string
  severity: ReportSeverity
  message: string
  department: ReportDepartmentKey | null
  createdAt: string
  resolved: boolean
}

export interface ReportSummaryResponse {
  totalSpend: number
  budget: number
  variance: number
  cashFlow: number
  predictedTotal: number
  pendingApprovals: number
  overtimeLiability: number
  activeCrewCount: number
  burnRate: BurnChartPoint[]
  alerts: ReportAlertItem[]
  health: 'green' | 'yellow' | 'red'
  scope: ReportsScope
  lastUpdated: string
}

export interface ReportsBundle {
  projectId: string
  projectName: string
  generatedAt: string
  durationDays: number
  elapsedDays: number
  remainingDays: number
  summary: ReportSummaryResponse
  burnChart: BurnChartPoint[]
  departments: DepartmentReportRow[]
  alerts: ReportAlertItem[]
}

interface AlertCandidate {
  department: ReportDepartmentKey | null
  fingerprint: string
  type: string
  severity: ReportSeverity
  message: string
  metadata: Record<string, unknown>
}

interface AggregatedProjectMetrics {
  bundle: ReportsBundle
  budgetRows: DepartmentReportRow[]
  pendingApprovalTotals: Record<ReportDepartmentKey, number>
  overtimeLiability: {
    shiftDate: string
    activeCrewCount: number
    totalOtHours: number
    estimatedOtCost: number
  }
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
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

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function isReportDepartmentKey(value: string): value is ReportDepartmentKey {
  return (REPORT_DEPARTMENTS as readonly string[]).includes(value)
}

function departmentLabel(department: ReportDepartmentKey) {
  switch (department) {
    case 'transport':
      return 'Transport'
    case 'crew':
      return 'Crew'
    case 'camera':
      return 'Camera'
    case 'art':
      return 'Art'
    case 'wardrobe':
      return 'Wardrobe'
    case 'post':
      return 'Post'
    case 'production':
      return 'Production'
  }
}

function toFinancialMetricDepartment(department: ReportDepartmentKey): FinancialMetricDepartment {
  return department === 'crew' ? 'production' : department
}

function buildBundleCacheKey(projectId: string) {
  return `reports:bundle:${projectId}`
}

function reportDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dayDifferenceInclusive(startDate: string | null, endDate: string | null, fallback: number) {
  if (!startDate || !endDate) {
    return Math.max(fallback, 1)
  }

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    return Math.max(fallback, 1)
  }

  return Math.max(Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1, 1)
}

function statusFromBudgetUsage(spend: number, budget: number) {
  if (budget <= 0) {
    return spend > 0 ? 'yellow' : 'green'
  }

  const ratio = spend / budget
  if (ratio >= 1) {
    return 'red' as const
  }

  if (ratio >= 0.85) {
    return 'yellow' as const
  }

  return 'green' as const
}

function summaryHealth(actual: number, budget: number, pending: number, overtime: number) {
  if (budget <= 0) {
    return actual > 0 || pending > 0 || overtime > 0 ? 'yellow' : 'green'
  }

  const projected = actual + pending + overtime
  if (projected >= budget) {
    return 'red' as const
  }

  if (projected >= budget * 0.85) {
    return 'yellow' as const
  }

  return 'green' as const
}

function dedupeDepartments(values: Array<string | null | undefined>) {
  const set = new Set<ReportDepartmentKey>()
  for (const value of values) {
    if (value && isReportDepartmentKey(value)) {
      set.add(value)
    }
  }

  if (!set.has('crew')) {
    set.add('crew')
  }

  return Array.from(set)
}

function mapProjectRoleToDepartment(projectRole?: string | null): ReportDepartmentKey | null {
  switch (normalize(projectRole)) {
    case 'DOP':
    case 'FIRST_AC':
    case 'CAMERA_OPERATOR':
    case 'DATA_WRANGLER':
      return 'camera'
    case 'ART_DIRECTOR':
    case 'ART_ASSISTANT':
      return 'art'
    case 'TRANSPORT_CAPTAIN':
    case 'DRIVER':
      return 'transport'
    case 'COSTUME_SUPERVISOR':
    case 'WARDROBE_STYLIST':
      return 'wardrobe'
    case 'EDITOR':
    case 'COLORIST':
      return 'post'
    case 'PRODUCTION_MANAGER':
    case 'FIRST_AD':
      return 'production'
    default:
      return null
  }
}

export function resolveReportsScope(access: ReportsAccessContext): ReportsScope {
  const authRole = normalize(access.authRole)
  const membershipRole = normalize(access.membershipRole)
  const projectRole = normalize(access.projectRole)
  const department = normalize(access.department)?.toLowerCase()

  const isFullAccess = Boolean(
    access.isOwner
      || authRole === 'EP'
      || authRole === 'LINE_PRODUCER'
      || membershipRole === 'EP'
      || membershipRole === 'LINE_PRODUCER'
      || projectRole === 'EXECUTIVE_PRODUCER'
      || projectRole === 'LINE_PRODUCER'
      || projectRole === 'PRODUCTION_MANAGER',
  )

  if (isFullAccess) {
    return {
      type: 'full',
      departments: [...REPORT_DEPARTMENTS],
      label: 'Project-wide',
    }
  }

  const scopedDepartment = department && isReportDepartmentKey(department)
    ? department
    : mapProjectRoleToDepartment(access.projectRole)

  if (!scopedDepartment || (authRole !== 'HOD' && membershipRole !== 'HOD' && !mapProjectRoleToDepartment(access.projectRole))) {
    throw new HttpError(403, 'Your role can only access reports through producer or HOD scope.')
  }

  const scopedDepartments = scopedDepartment === 'production'
    ? ['production', 'crew'] satisfies ReportDepartmentKey[]
    : [scopedDepartment]

  return {
    type: 'department',
    departments: scopedDepartments,
    label: scopedDepartments.map(departmentLabel).join(' + '),
  }
}

async function refreshReportViews() {
  const { error } = await adminClient.rpc('refresh_reports_materialized_views')
  if (error) {
    throw error
  }
}

export async function refreshReportsMaterializedViews() {
  await refreshReportViews()
}

async function loadProjectMeta(projectId: string) {
  const { data, error } = await adminClient
    .from('projects')
    .select('id, name, budget, start_date, end_date, is_archived')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Project not found.')
  }

  return data as ProjectMetaRow
}

async function loadEnabledDepartments(projectId: string) {
  const { data, error } = await adminClient
    .from('project_departments')
    .select('department')
    .eq('project_id', projectId)
    .eq('enabled', true)

  if (error) {
    throw error
  }

  return dedupeDepartments((data ?? []).map(row => (row as DepartmentRow).department))
}

async function loadBurnRateRows(projectId: string) {
  const { data, error } = await adminClient
    .from('view_daily_burn_rate')
    .select('date, total_transport_cost, total_crew_cost, total_camera_cost, total_art_cost, total_wardrobe_cost, total_post_cost, total_production_cost, grand_total_daily_spend')
    .eq('project_id', projectId)
    .order('date', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as BurnRateRow[]
}

async function loadBudgetTrackingRows(projectId: string) {
  const { data, error } = await adminClient
    .from('budget_tracking')
    .select('department, allocated_budget, actual_spent, committed_spend, pending_approval_amount, variance')
    .eq('project_id', projectId)
    .order('department', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as BudgetTrackingRow[]
}

async function seedBudgetTrackingRows(projectId: string, projectBudget: number, departments: ReportDepartmentKey[]) {
  const existingRows = await loadBudgetTrackingRows(projectId)
  const existingByDepartment = new Map(existingRows.map(row => [row.department, row]))
  const missingDepartments = departments.filter(department => !existingByDepartment.has(department))

  if (missingDepartments.length > 0) {
    const currentAllocatedBudget = existingRows.reduce((sum, row) => sum + asNumber(row.allocated_budget), 0)
    const remainingBudget = Math.max(projectBudget - currentAllocatedBudget, 0)
    const allocation = missingDepartments.length > 0 ? remainingBudget / missingDepartments.length : 0

    const { error } = await adminClient
      .from('budget_tracking')
      .insert(
        missingDepartments.map(department => ({
          project_id: projectId,
          department,
          allocated_budget: toMoney(allocation),
          actual_spent: 0,
          committed_spend: 0,
          pending_approval_amount: 0,
          metadata: {
            autoSeeded: true,
          },
        })),
      )

    if (error) {
      throw error
    }
  }

  return loadBudgetTrackingRows(projectId)
}

async function loadPendingApprovals(projectId: string) {
  const { data, error } = await adminClient
    .from('approvals')
    .select('department, type, amount')
    .eq('project_id', projectId)
    .eq('status', 'pending')

  if (error) {
    throw error
  }

  return (data ?? []) as PendingApprovalRow[]
}

async function loadOtLiability(projectId: string) {
  const { data, error } = await adminClient
    .from('view_ot_liability')
    .select('current_shift_date, active_crew_count, total_ot_hours, estimated_ot_cost')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = (data ?? null) as OtLiabilityRow | null

  return {
    shiftDate: row?.current_shift_date ?? reportDateKey(),
    activeCrewCount: asNumber(row?.active_crew_count),
    totalOtHours: toMoney(asNumber(row?.total_ot_hours)),
    estimatedOtCost: toMoney(asNumber(row?.estimated_ot_cost)),
  }
}

async function loadProjectSettings(projectId: string) {
  const { data, error } = await adminClient
    .from('project_settings')
    .select('alert_thresholds')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? { alert_thresholds: null }) as ProjectSettingsRow
}

async function loadFuelAnomalyRows(projectId: string) {
  const { data, error } = await adminClient
    .from('fuel_logs')
    .select('id, expected_mileage, actual_mileage, vehicle_id, log_date')
    .eq('project_id', projectId)
    .order('log_date', { ascending: false })
    .limit(25)

  if (error) {
    throw error
  }

  return (data ?? []) as FuelLogRow[]
}

async function loadReportAlerts(projectId: string) {
  const { data, error } = await adminClient
    .from('report_alerts')
    .select('id, department, type, severity, message, resolved, created_at, metadata')
    .eq('project_id', projectId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as ReportAlertRow[]).map(row => ({
    id: row.id,
    department: row.department && isReportDepartmentKey(row.department) ? row.department : null,
    type: row.type,
    severity: (row.severity === 'RED' || row.severity === 'YELLOW' ? row.severity : 'GREEN') as ReportSeverity,
    message: row.message,
    createdAt: row.created_at,
    resolved: row.resolved,
  }))
}

function emptyDepartmentTotals() {
  return {
    transport: 0,
    crew: 0,
    camera: 0,
    art: 0,
    wardrobe: 0,
    post: 0,
    production: 0,
  } satisfies Record<ReportDepartmentKey, number>
}

function rollupBurnRows(rows: BurnRateRow[]) {
  const totals = emptyDepartmentTotals()

  for (const row of rows) {
    totals.transport += asNumber(row.total_transport_cost)
    totals.crew += asNumber(row.total_crew_cost)
    totals.camera += asNumber(row.total_camera_cost)
    totals.art += asNumber(row.total_art_cost)
    totals.wardrobe += asNumber(row.total_wardrobe_cost)
    totals.post += asNumber(row.total_post_cost)
    totals.production += asNumber(row.total_production_cost)
  }

  for (const department of REPORT_DEPARTMENTS) {
    totals[department] = toMoney(totals[department])
  }

  return totals
}

function mapApprovalDepartment(row: PendingApprovalRow): ReportDepartmentKey {
  const type = normalize(row.type)
  const department = row.department?.trim().toLowerCase() ?? ''

  if (type === 'BATTA' || type === 'WAGE' || type === 'OVERTIME_EXTENSION') {
    return 'crew'
  }

  if (type === 'FUEL') {
    return 'transport'
  }

  if (type === 'CAMERA_RENTAL') {
    return 'camera'
  }

  if (type === 'PROPS_RENTAL') {
    return 'art'
  }

  return isReportDepartmentKey(department) ? department : 'production'
}

function rollupPendingApprovals(rows: PendingApprovalRow[]) {
  const totals = emptyDepartmentTotals()
  for (const row of rows) {
    const department = mapApprovalDepartment(row)
    totals[department] += asNumber(row.amount)
  }

  for (const department of REPORT_DEPARTMENTS) {
    totals[department] = toMoney(totals[department])
  }

  return totals
}

function buildDepartmentRows(params: {
  totals: Record<ReportDepartmentKey, number>
  budgets: BudgetTrackingRow[]
  pendingApprovals: Record<ReportDepartmentKey, number>
  overtimeLiability: number
}) {
  const budgetByDepartment = new Map(
    params.budgets
      .filter(row => isReportDepartmentKey(row.department))
      .map(row => [row.department as ReportDepartmentKey, asNumber(row.allocated_budget)]),
  )

  const totalSpend = REPORT_DEPARTMENTS.reduce((sum, department) => sum + params.totals[department], 0)

  return REPORT_DEPARTMENTS.map(department => {
    const spent = toMoney(params.totals[department])
    const budget = toMoney(budgetByDepartment.get(department) ?? 0)
    const pendingApprovals = toMoney(params.pendingApprovals[department] ?? 0)
    const overtimeLiability = department === 'crew' ? toMoney(params.overtimeLiability) : 0

    return {
      department,
      label: departmentLabel(department),
      spent,
      budget,
      variance: toMoney(spent - budget),
      pendingApprovals,
      overtimeLiability,
      share: totalSpend > 0 ? Number(((spent / totalSpend) * 100).toFixed(1)) : 0,
      status: statusFromBudgetUsage(spent, budget),
    } satisfies DepartmentReportRow
  })
}

function buildBurnChart(params: {
  rows: BurnRateRow[]
  totalBudget: number
  durationDays: number
}) {
  const plannedDailySpend = params.durationDays > 0 ? params.totalBudget / params.durationDays : 0

  return params.rows.map(row => ({
    date: row.date,
    actual: toMoney(asNumber(row.grand_total_daily_spend)),
    planned: toMoney(plannedDailySpend),
    transport: toMoney(asNumber(row.total_transport_cost)),
    crew: toMoney(asNumber(row.total_crew_cost)),
    camera: toMoney(asNumber(row.total_camera_cost)),
    art: toMoney(asNumber(row.total_art_cost)),
    wardrobe: toMoney(asNumber(row.total_wardrobe_cost)),
    post: toMoney(asNumber(row.total_post_cost)),
    production: toMoney(asNumber(row.total_production_cost)),
  }))
}

function buildAlertCandidates(params: {
  departments: DepartmentReportRow[]
  fuelLogs: FuelLogRow[]
  overtimeLiability: { totalOtHours: number; estimatedOtCost: number }
  alertThresholds: Record<string, unknown> | null
}) {
  const candidates: AlertCandidate[] = []

  for (const row of params.departments) {
    if (row.budget > 0 && row.spent > row.budget * 1.1) {
      candidates.push({
        department: row.department,
        fingerprint: `budget:${row.department}`,
        type: 'BUDGET_EXCEEDED',
        severity: 'RED',
        message: `${row.label} exceeded budget by more than 10%.`,
        metadata: {
          spent: row.spent,
          budget: row.budget,
          variance: row.variance,
        },
      })
      continue
    }

    if (row.budget > 0 && row.spent > row.budget * 0.9) {
      candidates.push({
        department: row.department,
        fingerprint: `budget-warning:${row.department}`,
        type: 'BUDGET_WARNING',
        severity: 'YELLOW',
        message: `${row.label} is above 90% of its allocated budget.`,
        metadata: {
          spent: row.spent,
          budget: row.budget,
        },
      })
    }
  }

  for (const row of params.fuelLogs) {
    const expectedMileage = asNumber(row.expected_mileage)
    const actualMileage = asNumber(row.actual_mileage)
    if (expectedMileage <= 0 || actualMileage <= 0 || actualMileage >= expectedMileage * 0.5) {
      continue
    }

    candidates.push({
      department: 'transport',
      fingerprint: `fuel:${row.id}`,
      type: 'FUEL_ANOMALY',
      severity: 'RED',
      message: `Fuel anomaly detected on ${row.log_date}. Mileage dropped below 50% of expected.`,
      metadata: {
        fuelLogId: row.id,
        vehicleId: row.vehicle_id,
        expectedMileage,
        actualMileage,
      },
    })
  }

  const overtimeThreshold = asNumber(params.alertThresholds?.ot_trigger_hours, 10)
  if (params.overtimeLiability.totalOtHours > overtimeThreshold) {
    candidates.push({
      department: 'crew',
      fingerprint: 'ot-spike',
      type: 'OT_SPIKE',
      severity: 'YELLOW',
      message: `Overtime crossed ${overtimeThreshold.toFixed(0)} hours for the current shift window.`,
      metadata: {
        totalOtHours: params.overtimeLiability.totalOtHours,
        estimatedOtCost: params.overtimeLiability.estimatedOtCost,
        threshold: overtimeThreshold,
      },
    })
  }

  return candidates
}

async function syncReportAlerts(projectId: string, candidates: AlertCandidate[]) {
  const { data, error } = await adminClient
    .from('report_alerts')
    .select('id, fingerprint, resolved')
    .eq('project_id', projectId)

  if (error) {
    throw error
  }

  const existingRows = (data ?? []) as Array<{ id: string; fingerprint: string; resolved: boolean }>
  const existingByFingerprint = new Map(existingRows.map(row => [row.fingerprint, row]))
  const activeFingerprints = new Set(candidates.map(candidate => candidate.fingerprint))

  for (const candidate of candidates) {
    const existing = existingByFingerprint.get(candidate.fingerprint)
    if (existing) {
      const { error: updateError } = await adminClient
        .from('report_alerts')
        .update({
          department: candidate.department,
          type: candidate.type,
          severity: candidate.severity,
          message: candidate.message,
          metadata: candidate.metadata,
          resolved: false,
          resolved_at: null,
        })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }

      continue
    }

    const { error: insertError } = await adminClient
      .from('report_alerts')
      .insert({
        project_id: projectId,
        department: candidate.department,
        fingerprint: candidate.fingerprint,
        type: candidate.type,
        severity: candidate.severity,
        message: candidate.message,
        metadata: candidate.metadata,
        resolved: false,
      })

    if (insertError) {
      throw insertError
    }
  }

  const staleIds = existingRows
    .filter(row => !activeFingerprints.has(row.fingerprint) && !row.resolved)
    .map(row => row.id)

  if (staleIds.length > 0) {
    const { error: resolveError } = await adminClient
      .from('report_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .in('id', staleIds)

    if (resolveError) {
      throw resolveError
    }
  }
}

async function upsertFinancialMetrics(projectId: string, metricDate: string, departments: DepartmentReportRow[]) {
  if (departments.length === 0) {
    return
  }

  const rowsByDepartment = new Map<FinancialMetricDepartment, {
    budget: number
    spent: number
    pendingApprovals: number
    overtimeLiability: number
    variance: number
    share: number
    statuses: Set<DepartmentReportRow['status']>
    reportDepartments: ReportDepartmentKey[]
  }>()

  for (const row of departments) {
    const department = toFinancialMetricDepartment(row.department)
    const existing = rowsByDepartment.get(department)

    if (existing) {
      existing.budget = toMoney(existing.budget + row.budget)
      existing.spent = toMoney(existing.spent + row.spent)
      existing.pendingApprovals = toMoney(existing.pendingApprovals + row.pendingApprovals)
      existing.overtimeLiability = toMoney(existing.overtimeLiability + row.overtimeLiability)
      existing.variance = toMoney(existing.variance + row.variance)
      existing.share = Number((existing.share + row.share).toFixed(1))
      existing.statuses.add(row.status)
      existing.reportDepartments.push(row.department)
      continue
    }

    rowsByDepartment.set(department, {
      budget: row.budget,
      spent: row.spent,
      pendingApprovals: row.pendingApprovals,
      overtimeLiability: row.overtimeLiability,
      variance: row.variance,
      share: row.share,
      statuses: new Set([row.status]),
      reportDepartments: [row.department],
    })
  }

  const { error } = await adminClient
    .from('financial_metrics')
    .upsert(
      Array.from(rowsByDepartment.entries()).map(([department, row]) => ({
        project_id: projectId,
        department,
        metric_date: metricDate,
        period: 'daily',
        budget_amount: row.budget,
        actual_spend_amount: row.spent,
        committed_amount: 0,
        pending_approval_amount: row.pendingApprovals,
        overtime_cost_amount: row.overtimeLiability,
        variance_amount: row.variance,
        metadata: {
          reportDepartment: row.reportDepartments.length === 1 ? row.reportDepartments[0] : department,
          reportDepartments: row.reportDepartments,
          share: row.share,
          status: row.statuses.has('red')
            ? 'red'
            : row.statuses.has('yellow')
              ? 'yellow'
              : 'green',
        },
      })),
      { onConflict: 'project_id,department,metric_date,period' },
    )

  if (error) {
    throw error
  }
}

async function upsertBudgetTracking(projectId: string, departments: DepartmentReportRow[]) {
  if (departments.length === 0) {
    return
  }

  const { error } = await adminClient
    .from('budget_tracking')
    .upsert(
      departments.map(row => ({
        project_id: projectId,
        department: row.department,
        allocated_budget: row.budget,
        actual_spent: row.spent,
        committed_spend: 0,
        pending_approval_amount: row.pendingApprovals,
        metadata: {
          share: row.share,
          status: row.status,
        },
      })),
      { onConflict: 'project_id,department' },
    )

  if (error) {
    throw error
  }
}

async function upsertDashboardSnapshot(projectId: string, bundle: ReportsBundle) {
  const today = reportDateKey()
  const { data, error } = await adminClient
    .from('report_snapshots')
    .select('id, snapshot')
    .eq('project_id', projectId)
    .eq('report_type', 'dashboard_snapshot')
    .eq('period_start', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  const snapshotPayload = {
    generatedAt: bundle.generatedAt,
    bundle,
  }

  if (data) {
    const { error: updateError } = await adminClient
      .from('report_snapshots')
      .update({
        title: REPORT_SNAPSHOT_TITLE,
        period_end: today,
        snapshot: snapshotPayload,
      })
      .eq('id', String((data as ReportSnapshotRow).id))

    if (updateError) {
      throw updateError
    }

    return
  }

  const { error: insertError } = await adminClient
    .from('report_snapshots')
    .insert({
      project_id: projectId,
      report_type: 'dashboard_snapshot',
      title: REPORT_SNAPSHOT_TITLE,
      period_start: today,
      period_end: today,
      snapshot: snapshotPayload,
    })

  if (insertError) {
    throw insertError
  }
}

function buildFullScope() {
  return {
    type: 'full',
    departments: [...REPORT_DEPARTMENTS],
    label: 'Project-wide',
  } satisfies ReportsScope
}

function buildSummary(params: {
  generatedAt: string
  scope: ReportsScope
  elapsedDays: number
  remainingDays: number
  departments: DepartmentReportRow[]
  burnChart: BurnChartPoint[]
  alerts: ReportAlertItem[]
  activeCrewCount: number
}) {
  const budget = toMoney(params.departments.reduce((sum, row) => sum + row.budget, 0))
  const totalSpend = toMoney(params.departments.reduce((sum, row) => sum + row.spent, 0))
  const pendingApprovals = toMoney(params.departments.reduce((sum, row) => sum + row.pendingApprovals, 0))
  const overtimeLiability = toMoney(params.departments.reduce((sum, row) => sum + row.overtimeLiability, 0))
  const actualDays = Math.max(params.elapsedDays, params.burnChart.length, 1)
  const avgDailySpend = totalSpend / actualDays

  return {
    totalSpend,
    budget,
    variance: toMoney(totalSpend - budget),
    cashFlow: toMoney(budget - (totalSpend + pendingApprovals + overtimeLiability)),
    predictedTotal: toMoney(totalSpend + avgDailySpend * params.remainingDays),
    pendingApprovals,
    overtimeLiability,
    activeCrewCount: params.activeCrewCount,
    burnRate: params.burnChart.slice(-7),
    alerts: params.alerts.slice(0, 8),
    health: summaryHealth(totalSpend, budget, pendingApprovals, overtimeLiability),
    scope: params.scope,
    lastUpdated: params.generatedAt,
  } satisfies ReportSummaryResponse
}

function filterBundle(bundle: ReportsBundle, scope: ReportsScope) {
  if (scope.type === 'full') {
    return {
      ...bundle,
      summary: {
        ...bundle.summary,
        scope,
      },
    }
  }

  const allowedDepartments = new Set(scope.departments)
  const scopedDepartments = bundle.departments.filter(row => allowedDepartments.has(row.department))
  const totalBudget = scopedDepartments.reduce((sum, row) => sum + row.budget, 0)
  const plannedPerDay = bundle.durationDays > 0 ? totalBudget / bundle.durationDays : 0
  const scopedBurnChart = bundle.burnChart.map(row => ({
    date: row.date,
    actual: toMoney(scope.departments.reduce((sum, department) => sum + row[department], 0)),
    planned: toMoney(plannedPerDay),
    transport: allowedDepartments.has('transport') ? row.transport : 0,
    crew: allowedDepartments.has('crew') ? row.crew : 0,
    camera: allowedDepartments.has('camera') ? row.camera : 0,
    art: allowedDepartments.has('art') ? row.art : 0,
    wardrobe: allowedDepartments.has('wardrobe') ? row.wardrobe : 0,
    post: allowedDepartments.has('post') ? row.post : 0,
    production: allowedDepartments.has('production') ? row.production : 0,
  }))
  const scopedAlerts = bundle.alerts.filter(alert => alert.department && allowedDepartments.has(alert.department))
  const summary = buildSummary({
    generatedAt: bundle.generatedAt,
    scope,
    elapsedDays: bundle.elapsedDays,
    remainingDays: bundle.remainingDays,
    departments: scopedDepartments,
    burnChart: scopedBurnChart,
    alerts: scopedAlerts,
    activeCrewCount: bundle.summary.activeCrewCount,
  })

  return {
    ...bundle,
    burnChart: scopedBurnChart,
    departments: scopedDepartments,
    alerts: scopedAlerts,
    summary,
  } satisfies ReportsBundle
}

function parseSnapshotBundle(snapshot: Record<string, unknown> | null) {
  const rawBundle = snapshot && typeof snapshot.bundle === 'object' && snapshot.bundle !== null
    ? snapshot.bundle as ReportsBundle
    : null

  if (!rawBundle || !rawBundle.projectId || !rawBundle.generatedAt) {
    return null
  }

  return rawBundle
}

async function loadLatestBundleFromSnapshot(projectId: string) {
  const { data, error } = await adminClient
    .from('report_snapshots')
    .select('id, snapshot')
    .eq('project_id', projectId)
    .eq('report_type', 'dashboard_snapshot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  const snapshot = (data ?? null) as ReportSnapshotRow | null
  return parseSnapshotBundle(snapshot?.snapshot ?? null)
}

function escapeCsv(value: string | number) {
  const stringValue = String(value ?? '')
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function createSimplePdf(lines: string[]) {
  const bodyLines = lines.slice(0, 42).map(line => `(${escapePdfText(line)}) Tj`).join('\nT*\n')
  const content = `BT
/F1 11 Tf
50 790 Td
14 TL
${bodyLines}
ET`

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${runtimeBuffer.byteLength(content, 'utf8')} >> stream
${content}
endstream endobj`,
  ]

  const header = '%PDF-1.4\n'
  const offsets: number[] = []
  let currentOffset = runtimeBuffer.byteLength(header, 'utf8')
  let body = ''

  for (const object of objects) {
    offsets.push(currentOffset)
    body += `${object}\n`
    currentOffset += runtimeBuffer.byteLength(`${object}\n`, 'utf8')
  }

  const xrefOffset = currentOffset
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')

  return runtimeBuffer.from(header + body + xref, 'utf8')
}

function buildExportLines(bundle: ReportsBundle) {
  return [
    'ProdSync Reports Export',
    `Project: ${bundle.projectName}`,
    `Generated: ${new Date(bundle.generatedAt).toLocaleString('en-IN')}`,
    '',
    'Summary',
    `Total Spend: ${bundle.summary.totalSpend.toFixed(2)}`,
    `Budget: ${bundle.summary.budget.toFixed(2)}`,
    `Variance: ${bundle.summary.variance.toFixed(2)}`,
    `Cash Flow: ${bundle.summary.cashFlow.toFixed(2)}`,
    `Predicted Total: ${bundle.summary.predictedTotal.toFixed(2)}`,
    '',
    'Department Breakdown',
    ...bundle.departments.map(row => `${row.label}: spent ${row.spent.toFixed(2)} | budget ${row.budget.toFixed(2)} | variance ${row.variance.toFixed(2)}`),
    '',
    'Burn Trend',
    ...bundle.burnChart.slice(-10).map(row => `${row.date}: actual ${row.actual.toFixed(2)} | planned ${row.planned.toFixed(2)}`),
    '',
    'Alerts',
    ...(bundle.alerts.length > 0
      ? bundle.alerts.slice(0, 10).map(alert => `[${alert.severity}] ${alert.message}`)
      : ['No active report alerts.']),
  ]
}

function buildExportCsv(bundle: ReportsBundle) {
  const summarySection = [
    'summary_metric,value',
    `totalSpend,${bundle.summary.totalSpend}`,
    `budget,${bundle.summary.budget}`,
    `variance,${bundle.summary.variance}`,
    `cashFlow,${bundle.summary.cashFlow}`,
    `predictedTotal,${bundle.summary.predictedTotal}`,
    `pendingApprovals,${bundle.summary.pendingApprovals}`,
    `overtimeLiability,${bundle.summary.overtimeLiability}`,
  ]

  const departmentSection = [
    'department,spent,budget,variance,pendingApprovals,overtimeLiability,share,status',
    ...bundle.departments.map(row => [
      row.department,
      row.spent,
      row.budget,
      row.variance,
      row.pendingApprovals,
      row.overtimeLiability,
      row.share,
      row.status,
    ].map(escapeCsv).join(',')),
  ]

  const burnSection = [
    'date,actual,planned,transport,crew,camera,art,wardrobe,post,production',
    ...bundle.burnChart.map(row => [
      row.date,
      row.actual,
      row.planned,
      row.transport,
      row.crew,
      row.camera,
      row.art,
      row.wardrobe,
      row.post,
      row.production,
    ].map(escapeCsv).join(',')),
  ]

  const alertSection = [
    'severity,type,department,message,createdAt',
    ...bundle.alerts.map(alert => [
      alert.severity,
      alert.type,
      alert.department ?? '',
      alert.message,
      alert.createdAt,
    ].map(escapeCsv).join(',')),
  ]

  return [
    '# Summary',
    ...summarySection,
    '',
    '# Departments',
    ...departmentSection,
    '',
    '# BurnChart',
    ...burnSection,
    '',
    '# Alerts',
    ...alertSection,
  ].join('\n')
}

async function buildProjectBundle(projectId: string, options?: { skipRefresh?: boolean }): Promise<AggregatedProjectMetrics> {
  if (!options?.skipRefresh) {
    await refreshReportViews()
  }

  const [project, enabledDepartments, burnRows, pendingApprovalsRows, otLiability, projectSettings] = await Promise.all([
    loadProjectMeta(projectId),
    loadEnabledDepartments(projectId),
    loadBurnRateRows(projectId),
    loadPendingApprovals(projectId),
    loadOtLiability(projectId),
    loadProjectSettings(projectId),
  ])

  const budgetRows = await seedBudgetTrackingRows(projectId, asNumber(project.budget), enabledDepartments)
  const burnTotals = rollupBurnRows(burnRows)
  const pendingApprovalTotals = rollupPendingApprovals(pendingApprovalsRows)
  const departmentRows = buildDepartmentRows({
    totals: burnTotals,
    budgets: budgetRows,
    pendingApprovals: pendingApprovalTotals,
    overtimeLiability: otLiability.estimatedOtCost,
  })

  const totalBudget = departmentRows.reduce((sum, row) => sum + row.budget, 0)
  const durationFallback = Math.max(burnRows.length, 1)
  const durationDays = dayDifferenceInclusive(project.start_date, project.end_date, durationFallback)
  const elapsedDays = project.start_date
    ? dayDifferenceInclusive(project.start_date, reportDateKey(), Math.max(burnRows.length, 1))
    : Math.max(burnRows.length, 1)
  const remainingDays = Math.max(durationDays - elapsedDays, 0)
  const burnChart = buildBurnChart({
    rows: burnRows,
    totalBudget,
    durationDays,
  })

  const fuelAnomalies = await loadFuelAnomalyRows(projectId)
  const candidates = buildAlertCandidates({
    departments: departmentRows,
    fuelLogs: fuelAnomalies,
    overtimeLiability: {
      totalOtHours: otLiability.totalOtHours,
      estimatedOtCost: otLiability.estimatedOtCost,
    },
    alertThresholds: projectSettings.alert_thresholds,
  })

  await syncReportAlerts(projectId, candidates)
  const alerts = await loadReportAlerts(projectId)
  const generatedAt = new Date().toISOString()
  const fullScope = buildFullScope()
  const summary = buildSummary({
    generatedAt,
    scope: fullScope,
    elapsedDays,
    remainingDays,
    departments: departmentRows,
    burnChart,
    alerts,
    activeCrewCount: otLiability.activeCrewCount,
  })

  const bundle = {
    projectId,
    projectName: project.name,
    generatedAt,
    durationDays,
    elapsedDays,
    remainingDays,
    summary,
    burnChart,
    departments: departmentRows,
    alerts,
  } satisfies ReportsBundle

  await Promise.all([
    upsertBudgetTracking(projectId, departmentRows),
    upsertFinancialMetrics(projectId, reportDateKey(), departmentRows),
    upsertDashboardSnapshot(projectId, bundle),
  ])

  await setCacheJson(buildBundleCacheKey(projectId), bundle, REPORT_CACHE_TTL_SECONDS)

  return {
    bundle,
    budgetRows: departmentRows,
    pendingApprovalTotals,
    overtimeLiability: otLiability,
  }
}

export async function aggregateProjectReports(projectId: string) {
  return buildProjectBundle(projectId)
}

export async function getProjectReportsBundle(projectId: string) {
  const cacheKey = buildBundleCacheKey(projectId)
  const cached = await getCacheJson<ReportsBundle>(cacheKey)
  if (cached) {
    return cached
  }

  const snapshotBundle = await loadLatestBundleFromSnapshot(projectId)
  if (
    snapshotBundle
    && Date.now() - new Date(snapshotBundle.generatedAt).getTime() <= SNAPSHOT_STALE_AFTER_MS
  ) {
    await setCacheJson(cacheKey, snapshotBundle, REPORT_CACHE_TTL_SECONDS)
    return snapshotBundle
  }

  const { bundle } = await buildProjectBundle(projectId)
  return bundle
}

export async function getScopedReportSummary(projectId: string, scope: ReportsScope) {
  const bundle = await getProjectReportsBundle(projectId)
  return filterBundle(bundle, scope).summary
}

export async function getScopedBurnChart(projectId: string, scope: ReportsScope) {
  const bundle = await getProjectReportsBundle(projectId)
  return filterBundle(bundle, scope).burnChart
}

export async function getScopedDepartments(projectId: string, scope: ReportsScope) {
  const bundle = await getProjectReportsBundle(projectId)
  return filterBundle(bundle, scope).departments
}

export async function getScopedAlerts(projectId: string, scope: ReportsScope) {
  const bundle = await getProjectReportsBundle(projectId)
  return filterBundle(bundle, scope).alerts
}

export async function buildScopedExport(projectId: string, scope: ReportsScope, type: 'pdf' | 'csv') {
  const bundle = filterBundle(await getProjectReportsBundle(projectId), scope)
  const safeProjectName = bundle.projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project'

  if (type === 'csv') {
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `${safeProjectName}-reports.csv`,
      body: buildExportCsv(bundle),
    }
  }

  return {
    contentType: 'application/pdf',
    filename: `${safeProjectName}-reports.pdf`,
    body: createSimplePdf(buildExportLines(bundle)),
  }
}

export async function listProjectIdsByArchiveState(isArchived: boolean) {
  const { data, error } = await adminClient
    .from('projects')
    .select('id')
    .eq('is_archived', isArchived)

  if (error) {
    throw error
  }

  return (data ?? []).map(row => String((row as { id: string }).id))
}

export async function runAggregationCycle(isArchived: boolean) {
  const projectIds = await listProjectIdsByArchiveState(isArchived)
  if (projectIds.length === 0) {
    return
  }

  await refreshReportViews()

  for (const projectId of projectIds) {
    try {
      await buildProjectBundle(projectId, { skipRefresh: true })
      await deleteCacheKey(buildBundleCacheKey(projectId))
    } catch (error) {
      console.error('[reports][aggregate] failed', {
        projectId,
        isArchived,
        error: error instanceof Error ? error.message : error,
      })
    }
  }
}
