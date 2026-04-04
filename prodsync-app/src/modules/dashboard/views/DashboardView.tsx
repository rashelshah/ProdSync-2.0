import { useDashboardData } from '../hooks/useDashboardData'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { formatCurrency } from '@/utils'

export function DashboardView() {
  const {
    isLoading,
    isError,
    kpis,
    deptSnapshots,
    pendingApprovals,
    alerts,
    events,
  } = useDashboardData()

  const { activeProject } = useResolvedProjectContext()

  const hasOperationalData =
    deptSnapshots.length > 0 ||
    pendingApprovals.length > 0 ||
    alerts.length > 0 ||
    events.length > 0 ||
    kpis.activeCrew > 0 ||
    kpis.activeFleet > 0 ||
    kpis.otCostTodayUSD > 0

  if (isLoading) return <LoadingState message="Loading mission control..." />
  if (isError) return <ErrorState message="Failed to load dashboard data" />

  return (
    <div className="page-shell">
      <header className="page-header page-header-card">
        <div>
          <span className="page-kicker">Executive Control</span>
          <h1 className="page-title">Mission Control</h1>
          <p className="page-subtitle">
            Project-wide visibility will populate here once live transport, crew, approvals, and financial data starts syncing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Active Project</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{activeProject?.name ?? 'No project selected'}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{activeProject ? `${activeProject.location} • ${activeProject.status}` : 'Choose or create a project in the Projects Hub.'}</p>
          </div>
          <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Live Inputs</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{alerts.length} alerts, {events.length} activity events</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">These counts now come directly from stored alert and activity records.</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Budget vs Actual" value={formatCurrency(kpis.budgetActualUSD)} subLabel={kpis.budgetTotalUSD > 0 ? `${kpis.budgetPercent}% of total` : 'No financial snapshots yet'} />
        <KpiCard label="Today's Spend" value={formatCurrency(kpis.todaySpendUSD)} subLabel="Awaiting live transactions" accentColor="#f97316" />
        <KpiCard label="Cash Flow" value={formatCurrency(kpis.cashFlowUSD)} subLabel="Awaiting treasury sync" accentColor="#18181b" />
        <KpiCard label="OT Cost Today" value={formatCurrency(kpis.otCostTodayUSD)} subLabel={kpis.otCostTodayUSD > 0 ? 'Derived from OT groups' : 'No overtime records yet'} />
        <KpiCard label="Active Crew" value={String(kpis.activeCrew)} subLabel="Driven by attendance logs" />
        <KpiCard label="Pending Approvals" value={String(pendingApprovals.length)} subLabel="Driven by approval requests" />
      </section>

      {!hasOperationalData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="dashboard"
            title="No operational data yet"
            description="No transport, crew, alert, or approval activity has been recorded for this project yet."
          />
        </Surface>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Alerts</p>
                <h2 className="section-title">Latest Priority Signals</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No active alerts.</p>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{alert.title}</p>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Activity</p>
                <h2 className="section-title">Recent Project Feed</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity captured yet.</p>
              ) : (
                events.map(event => (
                  <div key={event.id} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.title}</p>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{event.description}</p>
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      )}
    </div>
  )
}
