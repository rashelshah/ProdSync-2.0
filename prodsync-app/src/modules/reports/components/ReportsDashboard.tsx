import { useMutation } from '@tanstack/react-query'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { showError, showLoading, showSuccess } from '@/lib/toast'
import { reportsService } from '@/services/reports.service'
import { formatCurrency, formatDate, formatTime } from '@/utils'
import { useReportsData } from '../hooks/useReportsData'
import { AlertsPanel } from './AlertsPanel'
import { BudgetComparison } from './BudgetComparison'
import { BurnChart } from './BurnChart'
import { DepartmentBreakdown } from './DepartmentBreakdown'

function healthLabel(value: 'green' | 'yellow' | 'red') {
  if (value === 'red') return 'Critical'
  if (value === 'yellow') return 'Watchlist'
  return 'Stable'
}

export function ReportsDashboard() {
  const {
    activeProjectId,
    activeProject,
    summary,
    burnChart,
    departments,
    alerts,
    isLoading,
    isError,
  } = useReportsData()

  const exportMutation = useMutation({
    mutationFn: async (type: 'pdf' | 'csv') => {
      if (!activeProjectId) {
        throw new Error('Select a project before exporting reports.')
      }

      await reportsService.exportReport(activeProjectId, type)
    },
  })

  async function handleExport(type: 'pdf' | 'csv') {
    const toastId = `reports-export-${type}`
    showLoading(`Preparing ${type.toUpperCase()} export...`, { id: toastId })

    try {
      await exportMutation.mutateAsync(type)
      showSuccess(`${type.toUpperCase()} export downloaded.`, { id: toastId })
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Export failed.', { id: toastId })
    }
  }

  if (isLoading) return <LoadingState message="Loading reports and insights..." />
  if (isError || !summary) return <ErrorState message="Failed to load reports" />

  const hasData = burnChart.length > 0 || departments.some(row => row.spent > 0 || row.pendingApprovals > 0 || row.overtimeLiability > 0)

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Reports Engine</span>
          <h1 className="page-title page-title-compact">Reports & Insights</h1>
          <p className="page-subtitle">
            Aggregated financial and operational visibility for {activeProject?.name ?? 'the active project'}, scoped to {summary.scope.label.toLowerCase()} access.
          </p>
        </div>

        <div className="page-toolbar">
          <button className="btn-soft" onClick={() => handleExport('csv')} disabled={exportMutation.isPending}>
            <span className="material-symbols-outlined text-sm">table_view</span>
            Export CSV
          </button>
          <button className="btn-primary" onClick={() => handleExport('pdf')} disabled={exportMutation.isPending}>
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Export PDF
          </button>
        </div>
      </header>

      <Surface variant="inverse" padding="lg" className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60 dark:text-zinc-500">Decision Engine</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-white dark:text-zinc-950 sm:text-[2.35rem]">
              {healthLabel(summary.health)} reporting posture
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 dark:text-zinc-600">
              Spend is at {summary.budget > 0 ? `${Math.round((summary.totalSpend / summary.budget) * 100)}%` : '0%'} of tracked budget with
              {' '} {alerts.length} active signals and {summary.activeCrewCount} crew currently influencing OT liability.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[26px] bg-white/8 px-5 py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 dark:text-zinc-500">Scope</p>
              <p className="mt-2 text-sm font-semibold text-white dark:text-zinc-950">{summary.scope.label}</p>
              <p className="mt-1 text-sm text-white/65 dark:text-zinc-600">{activeProject?.location ?? 'Project location pending'}</p>
            </div>
            <div className="rounded-[26px] bg-white/8 px-5 py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 dark:text-zinc-500">Snapshot</p>
              <p className="mt-2 text-sm font-semibold text-white dark:text-zinc-950">{formatDate(summary.lastUpdated)}</p>
              <p className="mt-1 text-sm text-white/65 dark:text-zinc-600">{formatTime(summary.lastUpdated)} IST</p>
            </div>
          </div>
        </div>
      </Surface>

      {!hasData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="analytics"
            title="No reporting activity yet"
            description="The aggregation layer is live, but this project does not have enough approved financial or attendance data to render insights yet."
          />
        </Surface>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard label="Total Spend" value={formatCurrency(summary.totalSpend)} subLabel={summary.scope.label} />
            <KpiCard label="Budget" value={formatCurrency(summary.budget)} subLabel={`${healthLabel(summary.health)} posture`} />
            <KpiCard label="Variance" value={formatCurrency(summary.variance)} subLabel={summary.variance > 0 ? 'Over allocation' : 'Within guardrails'} subType={summary.variance > 0 ? 'critical' : 'success'} />
            <KpiCard label="Cash Flow" value={formatCurrency(summary.cashFlow)} subLabel="Budget remaining after commitments" />
            <KpiCard label="Predicted Total" value={formatCurrency(summary.predictedTotal)} subLabel="Run-rate projection" accentColor="#18181b" />
            <KpiCard label="OT Liability" value={formatCurrency(summary.overtimeLiability)} subLabel={`${summary.activeCrewCount} crew active`} subType={summary.overtimeLiability > 0 ? 'warning' : 'default'} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <BurnChart data={burnChart} />
            <AlertsPanel alerts={alerts} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DepartmentBreakdown departments={departments} />
            <BudgetComparison departments={departments} />
          </div>
        </>
      )}
    </div>
  )
}
