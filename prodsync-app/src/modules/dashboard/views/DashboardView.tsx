import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useDashboardData } from '../hooks/useDashboardData'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { formatProjectPhase, useProjectWorkflow } from '@/features/workflow/projectWorkflow'
import { projectsService } from '@/services/projects.service'
import { formatCurrency, formatDate } from '@/utils'
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
    locationsDashboard,
  } = useDashboardData()

  const { activeProject, activeProjectId } = useResolvedProjectContext()
  const { phase, quickActions } = useProjectWorkflow()
  const navigate = useNavigate()
  const planningQ = useQuery({
    queryKey: ['project-planning', activeProjectId],
    queryFn: () => projectsService.getProjectPlanning(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 20_000,
  })

  const hasOperationalData =
    deptSnapshots.length > 0 ||
    pendingApprovals.length > 0 ||
    alerts.length > 0 ||
    events.length > 0 ||
    Boolean(locationsDashboard && (locationsDashboard.activeLocations > 0 || locationsDashboard.pendingPermissions > 0 || locationsDashboard.expiredPermissions > 0)) ||
    kpis.activeCrew > 0 ||
    kpis.activeFleet > 0 ||
    kpis.otCostTodayUSD > 0



  const planning = planningQ.data
  const planningSections = planning?.sections ?? []
  const getPlanningPayload = (sectionType: string) => planningSections.find(section => section.sectionType === sectionType)?.payload ?? {}
  const crewPlanning = getPlanningPayload('crew_planning')
  const castPlanning = getPlanningPayload('cast_planning')
  const expensePlanning = getPlanningPayload('expense_planning')
  const isPlanningPhase = !activeProject || activeProject.projectPhase === 'planning'

  if (isPlanningPhase) {
    const estimatedCrew = Number(crewPlanning.estimatedCrew ?? 0)
    const estimatedCast = Number(castPlanning.estimatedCast ?? 0)
    const estimatedBudget = Number(crewPlanning.estimatedCost ?? 0) + Number(castPlanning.estimatedCost ?? 0) + Number(expensePlanning.estimatedCost ?? 0)
    const nextStep = planningSections.find(section => !section.isCompleted && !section.isSkipped)

    return (
      <div className="page-shell page-shell-narrow max-md:pt-16">
        <header className="page-header page-header-card">
          <div>
            <span className="page-kicker">{formatProjectPhase(phase)} Dashboard</span>
            <h1 className="page-title page-title-compact">What needs attention today?</h1>
            <p className="page-subtitle">A calmer dashboard for setup: finish the planning steps first, then operational metrics will become more prominent.</p>
          </div>
          <div className="page-toolbar">
            {quickActions.slice(0, 3).map(action => (
              <button key={action.id} className={action.id === 'continue-planning' ? 'btn-primary' : 'btn-soft'} onClick={() => navigate(action.id === 'continue-planning' && activeProjectId ? `/projects/${activeProjectId}/planning` : action.path)}>
                {action.label}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Planning Progress" value={`${planning?.progressPercent ?? 0}%`} subLabel={nextStep ? `Next: ${nextStep.sectionType.replace(/_/g, ' ')}` : 'Project ready'} />
          <KpiCard label="Estimated Budget" value={formatCurrency(estimatedBudget, activeProject?.currency ?? 'INR')} subLabel="Planning estimate" />
          <KpiCard label="Estimated Crew" value={String(estimatedCrew)} subLabel="From crew planning" />
          <KpiCard label="Estimated Cast" value={String(estimatedCast)} subLabel="From cast planning" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Surface variant="raised" padding="lg">
            <div className="section-heading"><div><p className="section-kicker">Project Planning</p><h2 className="section-title">Progress Tracker</h2></div></div>
            <div className="mt-6 space-y-3">
              {planningSections.map(section => (
                <div key={section.sectionType} className="flex items-center justify-between rounded-[22px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-orange-500">{section.isCompleted ? 'check_circle' : section.isSkipped ? 'remove_circle' : 'radio_button_unchecked'}</span><p className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">{section.sectionType.replace(/_/g, ' ')}</p></div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{section.isCompleted ? 'Completed' : section.isSkipped ? 'Skipped' : 'Upcoming'}</span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface variant="raised" padding="lg">
            <div className="section-heading"><div><p className="section-kicker">Signals</p><h2 className="section-title">Recent Activity & Approvals</h2></div></div>
            <div className="mt-6 space-y-3">
              {pendingApprovals.length === 0 && events.length === 0 ? <EmptyState icon="task_alt" title="Nothing urgent yet" description="Planning activity and pending approvals will appear here when they exist." /> : null}
              {pendingApprovals.map(approval => <div key={approval.id} className="rounded-[20px] bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Pending approval: {approval.type}</div>)}
              {events.slice(0, 3).map(event => <div key={event.id} className="rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-900"><p className="text-sm font-semibold text-zinc-900 dark:text-white">{event.title}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{event.description}</p></div>)}
            </div>
          </Surface>
        </section>
      </div>
    )
  }

  if (isLoading) return <PageLoader open message="Loading mission control..." />
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
            <span className="page-kicker">{formatProjectPhase(phase)} Control</span>
            <h1 className="page-title">What needs attention now?</h1>
            <p className="page-subtitle">
              The dashboard is filtered to the current production phase while keeping existing live project data available.
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


        <section className="grid gap-4 md:grid-cols-3">
          {quickActions.slice(0, 3).map(action => (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(action.path)}
              className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 text-left transition-colors hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{action.label}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{action.description}</p>
            </button>
          ))}
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Budget vs Actual" value={formatCurrency(kpis.budgetActualUSD)} subLabel={kpis.budgetTotalUSD > 0 ? `${kpis.budgetPercent}% of total` : 'No financial snapshots yet'} />
          <KpiCard label="Today's Spend" value={formatCurrency(kpis.todaySpendUSD)} subLabel="Awaiting live transactions" accentColor="#f97316" />
          <KpiCard label="Cash Flow" value={formatCurrency(kpis.cashFlowUSD)} subLabel="Awaiting treasury sync" accentColor="#18181b" />
          <KpiCard label="OT Cost Today" value={formatCurrency(kpis.otCostTodayUSD)} subLabel={kpis.otCostTodayUSD > 0 ? 'Derived from OT groups' : 'No overtime records yet'} />
          <KpiCard label="Active Crew" value={String(kpis.activeCrew)} subLabel="Driven by attendance logs" />
          <KpiCard label="Pending Approvals" value={String(pendingApprovals.length)} subLabel="Driven by approval requests" />
        </section>

        {locationsDashboard && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active Locations" value={String(locationsDashboard.activeLocations)} subLabel="Scouting and live sets" />
            <KpiCard label="Shoot Ready" value={String(locationsDashboard.shootReadyLocations)} subLabel="Readiness engine ready" />
            <KpiCard label="Pending Permissions" value={String(locationsDashboard.pendingPermissions)} subLabel="Awaiting approvals or issue" />
            <KpiCard label="Expired Permissions" value={String(locationsDashboard.expiredPermissions)} subLabel={`${locationsDashboard.expiringPermissions7Days} critical this week`} subType={locationsDashboard.expiredPermissions > 0 ? 'critical' : 'default'} />
          </section>
        )}

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

            <Surface variant="table" padding="lg">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Locations</p>
                  <h2 className="section-title">Recent Location Activity</h2>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {(locationsDashboard?.recentActivity.length ?? 0) === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent location activity.</p>
                ) : (
                  locationsDashboard?.recentActivity.map(event => (
                    <div key={event.id} className="rounded-[20px] border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{event.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(event.eventAt)}</p>
                      </div>
                      {event.description && <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{event.description}</p>}
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
