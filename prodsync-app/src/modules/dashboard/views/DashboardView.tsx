import { useDashboardData } from '../hooks/useDashboardData'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { formatCurrency } from '@/utils'
import { MissionControlMobile } from '../components/mission_control_mobile'

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
    <div className="page-shell space-y-6 md:space-y-0 pb-safe">

      {/* ── Mobile ── */}
      <div className="block md:hidden">
        <MissionControlMobile
          kpis={kpis}
          deptSnapshots={deptSnapshots}
          pendingApprovals={pendingApprovals}
          alerts={alerts}
          events={events}
          activeProject={activeProject}
        />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:block space-y-6">

        {/* Header — identical pattern to Crew / Camera / Art */}
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
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                {activeProject?.name ?? 'No project selected'}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {activeProject
                  ? `${activeProject.location} • ${activeProject.status}`
                  : 'Choose or create a project in the Projects Hub.'}
              </p>
            </div>
            <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Live Inputs</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                {alerts.length} alerts, {events.length} activity events
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                These counts now come directly from stored alert and activity records.
              </p>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Budget vs Actual" value={formatCurrency(kpis.budgetActualUSD)} subLabel={kpis.budgetTotalUSD > 0 ? `${kpis.budgetPercent}% of total` : 'No financial snapshots yet'} />
          <KpiCard label="Today's Spend" value={formatCurrency(kpis.todaySpendUSD)} subLabel="Awaiting live transactions" accentColor="#f97316" />
          <KpiCard label="Cash Flow" value={formatCurrency(kpis.cashFlowUSD)} subLabel="Awaiting treasury sync" accentColor="#18181b" />
          <KpiCard label="OT Cost Today" value={formatCurrency(kpis.otCostTodayUSD)} subLabel={kpis.otCostTodayUSD > 0 ? 'Derived from OT groups' : 'No overtime records yet'} />
          <KpiCard label="Active Crew" value={String(kpis.activeCrew)} subLabel="Driven by attendance logs" />
          <KpiCard label="Pending Approvals" value={String(pendingApprovals.length)} subLabel="Driven by approval requests" />
        </section>

        {/* Alerts + Activity */}
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

            {/* Alerts */}
            <Surface variant="table" padding="lg">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Alerts</p>
                  <h2 className="section-title">Latest Priority Signals</h2>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {alerts.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No active alerts.</p>
                ) : (
                  alerts.map(alert => (
                    <div
                      key={alert.id}
                      className="relative flex items-start gap-4 overflow-hidden rounded-[20px] border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-[20px] ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                      <div className={`ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${alert.severity === 'critical' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {alert.severity === 'critical' ? 'error' : 'warning'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.title}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            {/* Activity */}
            <Surface variant="table" padding="lg">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Activity</p>
                  <h2 className="section-title">Recent Project Feed</h2>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {events.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity captured yet.</p>
                ) : (
                  events.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 rounded-[20px] border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                        <span className="material-symbols-outlined text-[18px] text-zinc-500 dark:text-zinc-400">feed</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{event.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{event.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Surface>

          </div>
        )}
      </div>
    </div>
  )
}
