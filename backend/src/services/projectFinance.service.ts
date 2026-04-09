import { adminClient } from '../config/supabaseClient'
import { HttpError } from '../utils/httpError'

export interface ProjectProgressSnapshot {
  progress: number
  spent: number
  budget: number
  isOverBudget: boolean
  overBudgetAmount: number
}

export function asProjectCurrency(value: unknown) {
  return value === 'USD' || value === 'EUR' || value === 'INR' ? value : 'INR'
}

export function calculateProjectProgress(spent: number, budget: number): ProjectProgressSnapshot {
  const normalizedSpent = Number.isFinite(spent) ? Number(spent.toFixed(2)) : 0
  const normalizedBudget = Number.isFinite(budget) ? Number(budget.toFixed(2)) : 0

  if (normalizedBudget <= 0) {
    return {
      progress: 0,
      spent: normalizedSpent,
      budget: normalizedBudget,
      isOverBudget: normalizedSpent > 0,
      overBudgetAmount: normalizedSpent > 0 ? normalizedSpent : 0,
    }
  }

  const rawProgress = (normalizedSpent / normalizedBudget) * 100
  const overBudgetAmount = normalizedSpent > normalizedBudget
    ? Number((normalizedSpent - normalizedBudget).toFixed(2))
    : 0

  return {
    progress: Math.max(0, Math.min(100, Number(rawProgress.toFixed(2)))),
    spent: normalizedSpent,
    budget: normalizedBudget,
    isOverBudget: overBudgetAmount > 0,
    overBudgetAmount,
  }
}

export async function getProjectCurrencyCode(projectId: string) {
  const { data, error } = await adminClient
    .from('projects')
    .select('currency_code')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Project not found.')
  }

  return asProjectCurrency((data as { currency_code?: string | null }).currency_code ?? 'INR')
}
