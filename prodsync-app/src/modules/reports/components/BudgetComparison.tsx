import { Surface } from '@/components/shared/Surface'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { ReportDepartmentRow } from '@/types'
import { formatCurrency } from '@/utils'

interface BudgetComparisonProps {
  departments: ReportDepartmentRow[]
}

function statusVariant(status: ReportDepartmentRow['status']) {
  if (status === 'red') return 'over' as const
  if (status === 'yellow') return 'warning' as const
  return 'stable' as const
}

export function BudgetComparison({ departments }: BudgetComparisonProps) {
  return (
    <Surface variant="table" padding="lg">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Budget Guardrails</p>
          <h2 className="section-title">Budget vs Actual</h2>
          <p className="section-description">Variance, pending approvals, and OT pressure by department.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {departments.map(row => {
          const budgetUsage = row.budget > 0 ? Math.min((row.spent / row.budget) * 100, 100) : row.spent > 0 ? 100 : 0

          return (
            <div key={row.department} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{row.label}</p>
                    <StatusBadge variant={statusVariant(row.status)} label={row.status} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {formatCurrency(row.spent)} spent against {formatCurrency(row.budget)} budget
                  </p>
                </div>
                <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  <p>Variance {formatCurrency(row.variance)}</p>
                  <p className="mt-1">Pending {formatCurrency(row.pendingApprovals)}</p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${row.status === 'red' ? 'bg-red-500' : row.status === 'yellow' ? 'bg-orange-500' : 'bg-emerald-500'}`}
                  style={{ width: `${budgetUsage}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                <span>{row.share}% of spend</span>
                <span>OT {formatCurrency(row.overtimeLiability)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Surface>
  )
}
