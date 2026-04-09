import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import type { BudgetAllocationDepartment, ProjectCurrency } from '@/types'
import { formatCurrency } from '@/utils'

function normalizeDepartment(value: string) {
  return value.trim().toLowerCase().replace(/[\s&/-]+/g, '_')
}

export function ModuleBudgetBadge({
  projectId,
  department,
  currency = 'INR',
}: {
  projectId: string
  department: BudgetAllocationDepartment
  currency?: ProjectCurrency
}) {
  const departmentQ = useQuery({
    queryKey: ['reports-departments', projectId],
    queryFn: () => reportsService.getDepartments(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })

  const row = departmentQ.data?.find(item => normalizeDepartment(item.department) === department)

  if (!row) {
    return null
  }

  const remaining = Math.max(row.budget - row.spent, 0)

  return (
    <div className="rounded-[22px] border border-orange-500/25 bg-orange-500/10 px-4 py-3 shadow-[0_14px_28px_rgba(249,115,22,0.14)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
        Budget Allocation
      </p>
      <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <div className="flex items-center justify-between gap-4">
          <span>Allocated</span>
          <span className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.budget, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Used</span>
          <span className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.spent, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Remaining</span>
          <span className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(remaining, currency)}</span>
        </div>
      </div>
    </div>
  )
}
