import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardData } from '../hooks/useDashboardData'
import { KpiCard } from '@/components/shared/KpiCard'
import { AlertCard } from '@/components/shared/AlertCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useAlertStore } from '@/features/alerts/alert.store'
import { useActivityStore } from '@/features/activity/activity.store'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { formatCurrency, timeAgo, cn } from '@/utils'
import type { DepartmentSnapshot, ApprovalRequest } from '@/types'

export function DashboardView() {
  const {
    isLoading, isError, kpis, deptVelocity, burnData,
    deptSnapshots, pendingApprovals, transportKpis, crewKpis
  } = useDashboardData()

  const allAlerts = useAlertStore(s => s.alerts)
  const alerts = allAlerts.filter(a => !a.acknowledged).slice(0, 4)
  const allEvents = useActivityStore(s => s.events)
  const events = allEvents.slice(0, 5)

  if (isLoading) return <LoadingState message="Loading Mission Control..." />
  if (isError) return <ErrorState message="Failed to load dashboard data" />

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Page Header */}
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1 block">Executive Control</span>
          <h1 className="text-4xl font-extrabold tracking-tighter text-white uppercase italic">Mission Control</h1>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 block">Project Status</span>
          <span className="text-lg font-bold text-white uppercase">
            DAY 42 OF 68 <span className="text-white/20 ml-2">|</span> PRINCIPAL PHOTOGRAPHY
          </span>
        </div>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Budget vs Actual"
          value={formatCurrency(kpis.budgetActualUSD)}
          subLabel={`${kpis.budgetPercent}% of total`}
          subType={kpis.budgetPercent > 80 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Today's Spend"
          value={formatCurrency(kpis.todaySpendUSD)}
          subLabel={`+${kpis.todaySpendDelta}% vs yesterday`}
          subType="default"
        />
        <RoleGuard allowedRoles={['EP', 'LineProducer']}>
          <KpiCard
            label="Cash Flow"
            value={formatCurrency(kpis.cashFlowUSD)}
            subLabel={`Reserve at ${kpis.cashFlowReservePercent}%`}
            subType="default"
          />
        </RoleGuard>
        <KpiCard
          label="OT Cost Today"
          value={formatCurrency(kpis.otCostTodayUSD)}
          subLabel={kpis.otStatus === 'critical' ? 'Critical Spike' : 'Within range'}
          subType={kpis.otStatus === 'critical' ? 'critical' : 'success'}
        />
        <KpiCard
          label="Active Crew"
          value={String(kpis.activeCrew)}
          subLabel={`${kpis.crewCheckInPercent}% check-in rate`}
          subType="success"
        />
        <KpiCard
          label="Active Fleet"
          value={String(kpis.activeFleet)}
          subLabel="GPS tracking live"
          subType="default"
        />
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Charts Column */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Financial Velocity Chart */}
          <div className="bg-[#131313] border border-white/5 p-6 rounded-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Financial Velocity (Dept. Spend)</h3>
              <div className="flex gap-4 text-[10px] uppercase tracking-widest text-white/40">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white/20 rounded-full" />Budget</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white rounded-full" />Actual</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={deptVelocity} barGap={2}>
                <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, fontSize: 11 }}
                  labelStyle={{ color: 'white', fontWeight: 'bold' }}
                  itemStyle={{ color: 'rgba(255,255,255,0.6)' }}
                />
                <Bar dataKey="budget" fill="rgba(255,255,255,0.15)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" fill="rgba(255,255,255,0.9)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Production Burn Chart */}
          <div className="bg-[#131313] border border-white/5 p-6 rounded-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Production Burn (Timeline)</h3>
              <div className="flex gap-4 text-[10px] uppercase tracking-widest text-white/40">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white rounded-full" />Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white/20 rounded-full border border-white/30" />Planned</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={burnData}>
                <defs>
                  <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgba(255,255,255,0.2)" stopOpacity={1} />
                    <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, fontSize: 11 }}
                  itemStyle={{ color: 'rgba(255,255,255,0.6)' }}
                />
                <Area dataKey="planned" stroke="rgba(255,255,255,0.2)" fill="none" strokeDasharray="4 2" strokeWidth={1} />
                <Area dataKey="actual" stroke="rgba(255,255,255,0.9)" fill="url(#burnGradient)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Critical Exceptions */}
          <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Critical Exceptions</h3>
              <span className="ml-auto text-[10px] text-red-400 font-bold">{alerts.filter(a => a.severity === 'critical').length} Active</span>
            </div>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-4">All clear</p>
              ) : alerts.slice(0, 3).map(alert => (
                <AlertCard key={alert.id} alert={alert} compact />
              ))}
            </div>
          </div>

          {/* Approval Queue Widget */}
          <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">Approval Queue</h3>
            <div className="space-y-5">
              {pendingApprovals.map((req) => (
                <ApprovalQueueItem key={req.id} req={req} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Feed */}
        <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">Real-Time Production Feed</h3>
          <div className="space-y-5 overflow-y-auto max-h-80">
            {events.map((ev, i) => (
              <div key={ev.id} className={cn('relative pl-5 border-l border-white/10 space-y-1', i === 0 && 'border-l-white/40')}>
                <div className={cn('absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full', i === 0 ? 'bg-white' : 'bg-white/15')} />
                <p className="text-[10px] text-white font-bold uppercase tracking-wide">{ev.title}</p>
                <p className="text-[10px] text-white/40">{ev.description}</p>
                <p className="text-[9px] uppercase tracking-widest text-white/20">{timeAgo(ev.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Department Snapshots */}
        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {deptSnapshots.map(snap => (
            <DeptSnapshotCard key={snap.id} snap={snap} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ApprovalQueueItem({ req }: { req: ApprovalRequest }) {
  return (
    <div className="space-y-3 pb-4 border-b border-white/5 last:border-0 last:pb-0">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-tight">{req.type.replace(/([A-Z])/g, ' $1').trim()}</p>
          <p className="text-[10px] text-white/40 mt-0.5">
            ₹{req.amountINR.toLocaleString()} • {req.department}
          </p>
        </div>
        {req.priority === 'emergency' && (
          <span className="text-[9px] text-white bg-red-600/80 px-2 py-0.5 rounded uppercase font-bold">Emergency</span>
        )}
        {req.priority === 'high' && (
          <span className="text-[9px] text-white bg-white/10 px-2 py-0.5 rounded uppercase">Priority</span>
        )}
      </div>
      <RoleGuard permission="canApproveExpense">
        <div className="flex gap-2">
          <button className="flex-1 bg-white text-black py-2 text-[10px] font-bold uppercase tracking-[0.15em] rounded-sm hover:bg-white/90 transition-colors">
            Approve
          </button>
          <button className="flex-1 border border-white/20 text-white py-2 text-[10px] font-bold uppercase tracking-[0.15em] rounded-sm hover:bg-white/5 transition-colors">
            Reject
          </button>
        </div>
      </RoleGuard>
    </div>
  )
}

const deptStatusConfig: Record<DepartmentSnapshot['status'], { badge: string; label: string }> = {
  active: { badge: 'bg-black/60 text-white', label: 'Active' },
  stable: { badge: 'bg-black/60 text-white', label: 'Stable' },
  warning: { badge: 'bg-amber-900/80 text-amber-300', label: 'Warning' },
  over: { badge: 'bg-red-900/80 text-red-300', label: 'Over' },
}

function DeptSnapshotCard({ snap }: { snap: DepartmentSnapshot }) {
  const cfg = deptStatusConfig[snap.status]
  return (
    <div className="bg-[#131313] border border-white/5 rounded-sm overflow-hidden flex flex-col group">
      <div className="h-16 bg-[#0e0e0e] relative flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-white/5">
          {snap.id === 'transport' ? 'local_shipping' :
           snap.id === 'camera' ? 'photo_camera' :
           snap.id === 'crew' ? 'groups' :
           snap.id === 'art' ? 'palette' :
           snap.id === 'wardrobe' ? 'checkroom' : 'location_on'}
        </span>
        <div className={cn('absolute top-2 right-2 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-sm', cfg.badge)}>
          {cfg.label}
        </div>
      </div>
      <div className="p-3 flex-1">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">{snap.name}</h4>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {snap.metrics.map(m => (
            <>
              <div key={`l-${m.label}`} className="text-white/40 uppercase">{m.label}</div>
              <div key={`v-${m.label}`} className="text-right text-white">{m.value}</div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
