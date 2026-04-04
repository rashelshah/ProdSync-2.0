import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useDashboardData } from '../hooks/useDashboardData'
import { KpiCard } from '@/components/shared/KpiCard'
import { AlertCard } from '@/components/shared/AlertCard'
import { Surface } from '@/components/shared/Surface'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useAlertStore } from '@/features/alerts/alert.store'
import { useActivityStore } from '@/features/activity/activity.store'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { formatCurrency, timeAgo, cn } from '@/utils'
import type { DepartmentSnapshot, ApprovalRequest } from '@/types'

const tooltipStyle = {
  background: 'var(--app-surface-strong)',
  border: '1px solid var(--app-border)',
  borderRadius: 18,
  fontSize: 11,
  boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
}

const tickStyle = { fill: 'var(--app-muted)', fontSize: 11 }

export function DashboardView() {
  const {
    isLoading,
    isError,
    kpis,
    deptVelocity,
    burnData,
    deptSnapshots,
    pendingApprovals,
    transportKpis,
    crewKpis,
  } = useDashboardData()

  const allAlerts = useAlertStore(s => s.alerts)
  const alerts = allAlerts.filter(a => !a.acknowledged).slice(0, 4)
  const allEvents = useActivityStore(s => s.events)
  const events = allEvents.slice(0, 5)

  if (isLoading) return <LoadingState message="Loading Mission Control..." />
  if (isError) return <ErrorState message="Failed to load dashboard data" />

  return (
    <div className="page-shell">
      <header className="page-header page-header-card">
        <div>
          <span className="page-kicker">Executive Control</span>
          <h1 className="page-title">Mission Control</h1>
          <p className="page-subtitle">
            Budget pressure, department momentum, critical production issues, and approvals in a cleaner open dashboard layout.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Project Status</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-900 dark:text-white">Day 42 of 68</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Principal Photography</p>
          </div>
          <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Watchlist</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{alerts.length} unresolved alerts</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {transportKpis.inTransit} vehicles in transit, {crewKpis.activeOtCrew} OT crew active
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Overview</p>
            <h2 className="section-title">Executive Snapshot</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Budget vs Actual" value={formatCurrency(kpis.budgetActualUSD)} subLabel={`${kpis.budgetPercent}% of total`} subType={kpis.budgetPercent > 80 ? 'warning' : 'default'} />
          <KpiCard label="Today's Spend" value={formatCurrency(kpis.todaySpendUSD)} subLabel={`+${kpis.todaySpendDelta}% vs yesterday`} accentColor="#f97316" />
          <RoleGuard allowedRoles={['EP', 'LineProducer']}>
            <KpiCard label="Cash Flow" value={formatCurrency(kpis.cashFlowUSD)} subLabel={`Reserve at ${kpis.cashFlowReservePercent}%`} accentColor="#18181b" />
          </RoleGuard>
          <KpiCard label="OT Cost Today" value={formatCurrency(kpis.otCostTodayUSD)} subLabel={kpis.otStatus === 'critical' ? 'Critical spike' : 'Within range'} subType={kpis.otStatus === 'critical' ? 'critical' : 'success'} accentColor={kpis.otStatus === 'critical' ? '#ef4444' : '#f97316'} />
          <KpiCard label="Active Crew" value={String(kpis.activeCrew)} subLabel={`${kpis.crewCheckInPercent}% check-in rate`} subType="success" />
          <KpiCard label="Active Fleet" value={String(kpis.activeFleet)} subLabel="GPS tracking live" accentColor="#18181b" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 xl:col-span-8">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Velocity</p>
              <h2 className="section-title">Financial and Burn Trends</h2>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Surface variant="table" padding="lg">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="section-title">Financial Velocity</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Department budget versus actual spend</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptVelocity} barGap={8}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={tickStyle} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--app-text)', fontWeight: 600 }} />
                    <Bar dataKey="budget" fill="var(--chart-muted)" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="actual" fill="var(--chart-accent)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Production Burn</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Planned versus actual burn by week</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burnData}>
                    <defs>
                      <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-accent)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--chart-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={tickStyle} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area dataKey="planned" stroke="var(--chart-muted)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Area dataKey="actual" stroke="var(--chart-accent)" fill="url(#burnGradient)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Surface>
          </div>
        </div>

        <div className="col-span-12 space-y-8 xl:col-span-4">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Priority</p>
              <h2 className="section-title">Alerts and Queue</h2>
            </div>
          </div>

          <div className="space-y-4">
            {alerts.length === 0 ? (
              <Surface variant="muted" padding="md">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">All clear</p>
              </Surface>
            ) : (
              alerts.slice(0, 3).map(alert => <AlertCard key={alert.id} alert={alert} compact />)
            )}
          </div>

          <div className="space-y-4">
            <p className="section-kicker">Approvals</p>
            {pendingApprovals.map(req => (
              <ApprovalQueueItem key={req.id} req={req} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-5">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Activity</p>
              <h2 className="section-title">Real-Time Production Feed</h2>
            </div>
          </div>
          <div className="mt-4 space-y-6">
            {events.map((event, index) => (
              <div key={event.id} className="relative pl-7">
                <div className="absolute left-0 top-1.5 h-full w-px bg-zinc-200 dark:bg-zinc-800" />
                <div className={cn('absolute left-[-5px] top-1 h-3 w-3 rounded-full', index === 0 ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700')} />
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.title}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{event.description}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{timeAgo(event.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-7">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Departments</p>
              <h2 className="section-title">Operational Snapshots</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {deptSnapshots.map(snap => (
              <DeptSnapshotCard key={snap.id} snap={snap} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function ApprovalQueueItem({ req }: { req: ApprovalRequest }) {
  return (
    <div className="rounded-[26px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{req.type.replace(/([A-Z])/g, ' $1').trim()}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Rs {req.amountINR.toLocaleString()} · {req.department}</p>
        </div>
        {req.priority === 'emergency' && <span className="rounded-full bg-red-50 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-red-500 dark:bg-red-500/10 dark:text-red-400">Emergency</span>}
        {req.priority === 'high' && <span className="rounded-full bg-orange-50 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">Priority</span>}
      </div>

      <RoleGuard permission="canApproveExpense">
        <div className="mt-4 flex gap-3">
          <button className="btn-primary flex-1 justify-center">Approve</button>
          <button className="btn-soft flex-1 justify-center">Reject</button>
        </div>
      </RoleGuard>
    </div>
  )
}

const deptStatusConfig: Record<DepartmentSnapshot['status'], { badge: string; label: string }> = {
  active: { badge: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400', label: 'Active' },
  stable: { badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', label: 'Stable' },
  warning: { badge: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400', label: 'Warning' },
  over: { badge: 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400', label: 'Over' },
}

function DeptSnapshotCard({ snap }: { snap: DepartmentSnapshot }) {
  const cfg = deptStatusConfig[snap.status]
  const icon =
    snap.id === 'transport'
      ? 'local_shipping'
      : snap.id === 'camera'
        ? 'photo_camera'
        : snap.id === 'crew'
          ? 'groups'
          : snap.id === 'art'
            ? 'palette'
            : snap.id === 'wardrobe'
              ? 'checkroom'
              : 'location_on'

  return (
    <div className="rounded-[28px] bg-zinc-50 p-5 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div className={cn('rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]', cfg.badge)}>
          {cfg.label}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">{snap.name}</h4>
        <div className="mt-4 space-y-3">
          {snap.metrics.map(metric => (
            <div key={metric.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{metric.label}</span>
              <span className="font-medium text-zinc-900 dark:text-white">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
