import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { isProducerRole } from '@/features/auth/access-rules'
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

  const user = useAuthStore(s => s.user)
  const canView = user && (isProducerRole(user.role) || user.role === 'HOD')

  if (!row || !canView) {
    return null
  }

  const remaining = Math.max(row.budget - row.spent, 0)

  return (
    <div className="flex items-center rounded-full border border-orange-500/20 bg-orange-500/5 p-1 pr-5 shadow-sm dark:border-orange-500/10">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 mr-4 dark:bg-orange-500/20">
         <span className="material-symbols-outlined text-[18px] text-orange-600 dark:text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 border-r border-orange-500/20 pr-4">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-orange-600/70 dark:text-orange-400/80">Allocated</span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.budget, currency)}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 border-r border-orange-500/20 pr-4">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-orange-600/70 dark:text-orange-400/80">Used</span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(row.spent, currency)}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-orange-600/70 dark:text-orange-400/80">Remaining</span>
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatCurrency(remaining, currency)}</span>
        </div>
      </div>
    </div>
  )
}
