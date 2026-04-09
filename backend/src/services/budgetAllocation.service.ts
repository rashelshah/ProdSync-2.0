import { adminClient } from '../config/supabaseClient'
import { HttpError } from '../utils/httpError'

export const BUDGET_ALLOCATION_DEPARTMENTS = ['transport', 'crew', 'camera', 'art', 'wardrobe', 'post', 'production'] as const

export type BudgetAllocationDepartment = typeof BUDGET_ALLOCATION_DEPARTMENTS[number]

interface BudgetAllocationRow {
  id: string
  project_id: string
  department: string
  allocated_amount: number | string | null
  allocated_percentage: number | string | null
  created_at: string
}

interface ProjectBudgetRow {
  id: string
  budget: number | string | null
}

export interface BudgetAllocationRecord {
  id: string
  projectId: string
  department: BudgetAllocationDepartment
  allocatedAmount: number
  allocatedPercentage: number
  createdAt: string
}

interface SaveBudgetAllocationInput {
  department: BudgetAllocationDepartment
  allocatedAmount?: number | null
  allocatedPercentage?: number | null
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

function isBudgetAllocationDepartment(value: string): value is BudgetAllocationDepartment {
  return (BUDGET_ALLOCATION_DEPARTMENTS as readonly string[]).includes(value)
}

async function getProjectBudget(projectId: string) {
  const { data, error } = await adminClient
    .from('projects')
    .select('id, budget')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Project not found.')
  }

  return data as ProjectBudgetRow
}

function normalizeAllocationRow(row: BudgetAllocationRow): BudgetAllocationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    department: isBudgetAllocationDepartment(row.department) ? row.department : 'production',
    allocatedAmount: toMoney(asNumber(row.allocated_amount)),
    allocatedPercentage: Number(asNumber(row.allocated_percentage).toFixed(2)),
    createdAt: row.created_at,
  }
}

export async function listBudgetAllocations(projectId: string): Promise<BudgetAllocationRecord[]> {
  const { data, error } = await adminClient
    .from('budget_allocations')
    .select('id, project_id, department, allocated_amount, allocated_percentage, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const allocations = new Map<BudgetAllocationDepartment, BudgetAllocationRecord>()
  for (const row of (data ?? []) as BudgetAllocationRow[]) {
    if (!isBudgetAllocationDepartment(row.department)) {
      continue
    }

    allocations.set(row.department, normalizeAllocationRow(row))
  }

  return BUDGET_ALLOCATION_DEPARTMENTS.map(department =>
    allocations.get(department) ?? {
      id: `${projectId}-${department}`,
      projectId,
      department,
      allocatedAmount: 0,
      allocatedPercentage: 0,
      createdAt: new Date(0).toISOString(),
    },
  )
}

export async function saveBudgetAllocations(projectId: string, input: SaveBudgetAllocationInput[]) {
  const project = await getProjectBudget(projectId)
  const projectBudget = toMoney(asNumber(project.budget))
  const rowsByDepartment = new Map<BudgetAllocationDepartment, SaveBudgetAllocationInput>()

  for (const department of BUDGET_ALLOCATION_DEPARTMENTS) {
    rowsByDepartment.set(department, { department, allocatedAmount: 0, allocatedPercentage: 0 })
  }

  for (const row of input) {
    rowsByDepartment.set(row.department, row)
  }

  const normalizedRows = BUDGET_ALLOCATION_DEPARTMENTS.map(department => {
    const row = rowsByDepartment.get(department) ?? { department }
    const amount = row.allocatedAmount != null
      ? toMoney(asNumber(row.allocatedAmount))
      : projectBudget > 0
        ? toMoney((asNumber(row.allocatedPercentage) / 100) * projectBudget)
        : 0
    const percentage = row.allocatedPercentage != null
      ? Number(asNumber(row.allocatedPercentage).toFixed(2))
      : projectBudget > 0
        ? Number(((amount / projectBudget) * 100).toFixed(2))
        : 0

    if (amount < 0) {
      throw new HttpError(400, `${department} allocation amount cannot be negative.`)
    }

    if (percentage < 0 || percentage > 100) {
      throw new HttpError(400, `${department} allocation percentage must stay between 0 and 100.`)
    }

    return {
      project_id: projectId,
      department,
      allocated_amount: amount,
      allocated_percentage: percentage,
    }
  })

  const totalAmount = toMoney(normalizedRows.reduce((sum, row) => sum + row.allocated_amount, 0))
  const totalPercentage = Number(normalizedRows.reduce((sum, row) => sum + row.allocated_percentage, 0).toFixed(2))

  if (totalAmount > projectBudget + 0.01) {
    throw new HttpError(400, 'Total allocation cannot exceed the project budget.')
  }

  if (totalPercentage > 100.01) {
    throw new HttpError(400, 'Total allocation percentage cannot exceed 100%.')
  }

  const { error } = await adminClient
    .from('budget_allocations')
    .upsert(normalizedRows, { onConflict: 'project_id,department' })

  if (error) {
    throw error
  }

  const { error: trackingError } = await adminClient
    .from('budget_tracking')
    .upsert(
      normalizedRows.map(row => ({
        project_id: projectId,
        department: row.department,
        allocated_budget: row.allocated_amount,
        actual_spent: 0,
        committed_spend: 0,
        pending_approval_amount: 0,
        metadata: {
          source: 'budget_allocations',
          allocatedPercentage: row.allocated_percentage,
        },
      })),
      { onConflict: 'project_id,department' },
    )

  if (trackingError) {
    throw trackingError
  }

  return {
    allocations: await listBudgetAllocations(projectId),
    totals: {
      allocatedAmount: totalAmount,
      allocatedPercentage: Number(Math.min(totalPercentage, 100).toFixed(2)),
      remainingAmount: toMoney(Math.max(projectBudget - totalAmount, 0)),
      budget: projectBudget,
    },
  }
}
