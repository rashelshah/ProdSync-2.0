import { useCrewData } from '../hooks/useCrewData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { formatCurrency, cn } from '@/utils'
import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'

const verificationConfig = {
  gps: { icon: 'location_on', colorClass: 'text-emerald-400 bg-emerald-500/10', label: 'GPS OK' },
  manual: { icon: 'warning', colorClass: 'text-amber-400 bg-amber-500/10', label: 'Manual' },
  biometric: { icon: 'fingerprint', colorClass: 'text-sky-400 bg-sky-500/10', label: 'Biometric' },
}

export function CrewView() {
  const { isLoading, isError, kpis, crew, otGroups, battaQueue, recentPayouts, headcountByDept } = useCrewData()

  if (isLoading) return <LoadingState message="Loading Crew Control..." />
  if (isError) return <ErrorState message="Failed to load crew data" />

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1 font-bold">Wages Administration</p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-white uppercase">Control Center</h1>
          <p className="text-white/40 mt-1 text-sm">Attendance, Overtime & Cash Disbursement for Active Production Phase.</p>
        </div>
        <RoleGuard permission="canManageCrew">
          <div className="flex gap-2">
            <button className="bg-[#2a2a2a] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-colors">
              Check-In Crew
            </button>
            <button className="bg-[#2a2a2a] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-colors">
              Approve Batta
            </button>
            <button className="bg-white text-black px-4 py-2 text-xs font-extrabold uppercase tracking-widest hover:bg-white/90 transition-colors">
              Authorize OT
            </button>
          </div>
        </RoleGuard>
      </header>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 border border-white/5">
        <KpiCard label="Total Crew" value={String(kpis.totalCrew)}
          subLabel={kpis.overstaffingCount > 0 ? `+${kpis.overstaffingCount} Overstaffing` : 'On Target'}
          subType={kpis.overstaffingCount > 0 ? 'critical' : 'success'} />
        <KpiCard label="Planned Headcount" value={String(kpis.plannedHeadcount)} subLabel={`Cap: 200`} />
        <KpiCard label="Active OT Crew" value={String(kpis.activeOtCrew)} subLabel="Started 6:00 PM" />
        <KpiCard label="Total OT Cost" value={formatCurrency(kpis.totalOtCostUSD)} subLabel="Daily Accrual" subType="warning" />
        <KpiCard label="Batta Requested" value={formatCurrency(kpis.battaRequested)}
          subLabel={kpis.battaRequested > 3500 ? 'Exceeds Budget 12%' : 'Within Budget'}
          subType={kpis.battaRequested > 3500 ? 'critical' : 'success'} />
        <KpiCard label="Batta Paid" value={formatCurrency(kpis.battaPaid)}
          subLabel={`Pending: ${formatCurrency(kpis.battaRequested - kpis.battaPaid)}`} />
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Exceptions + Attendance + OT */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* System Exceptions */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">System Exceptions & Alerts</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { level: 'critical', title: 'Overtime Triggered', desc: '120 crew at 6:00 PM - Standard Shift Finished.', time: '18:05' },
                { level: 'critical', title: 'Overstaffing Detected', desc: `${kpis.totalCrew} present vs ${kpis.plannedHeadcount} planned in Art Dept.`, time: '07:30' },
                { level: 'warning', title: 'Unapproved OT Running', desc: 'Duration: 45 mins - Stage 4 Crew.', time: '18:45' },
                { level: 'warning', title: 'High Batta Requests', desc: `Exceeding daily budget by 12% (${formatCurrency(kpis.battaRequested)} total).`, time: '14:20' },
              ].map((alert, i) => (
                <div key={i} className={cn(
                  'p-4 border-l-2',
                  alert.level === 'critical' ? 'bg-[#201f1f] border-red-500' : 'bg-[#201f1f] border-amber-500'
                )}>
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-white uppercase mb-1">{alert.title}</p>
                    <span className="text-[10px] text-white/30">{alert.time}</span>
                  </div>
                  <p className="text-sm text-white/50">{alert.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Live Attendance Table */}
          <section className="bg-[#1c1b1b] border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Live Attendance Tracker</h3>
              <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest">
                <span className="text-white/30">Syncing Live</span>
                <span className="text-white">{kpis.totalCrew} Online</span>
              </div>
            </div>
            <DataTable<CrewMember>
              columns={[
                {
                  key: 'name', label: 'Crew Name',
                  render: r => <span className="font-bold text-white">{r.name}</span>
                },
                { key: 'role', label: 'Role', render: r => <span className="text-white/50">{r.role}</span> },
                { key: 'department', label: 'Dept', render: r => <span className="text-white/50">{r.department}</span> },
                {
                  key: 'checkInTime', label: 'Check-In',
                  render: r => <span className="font-mono text-[11px] text-white/40">{r.checkInTime}</span>
                },
                {
                  key: 'verification', label: 'Verification',
                  render: r => {
                    const cfg = verificationConfig[r.verification]
                    return (
                      <span className={cn('flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit', cfg.colorClass)}>
                        <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    )
                  }
                },
                {
                  key: 'status', label: 'Status',
                  render: r => <StatusBadge variant={r.status === 'ot' ? 'ot' : r.status === 'offduty' ? 'idle' : 'active'} label={r.status === 'ot' ? 'OT' : r.status === 'offduty' ? 'Off Duty' : 'Active'} />
                },
              ]}
              data={crew}
              getKey={r => r.id}
              className="px-5"
            />
          </section>

          {/* OT Monitoring */}
          <section className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Overtime Monitoring</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {otGroups.map(group => (
                <OvertimeGroupCard key={group.id} group={group} />
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Headcount Distribution */}
          <section className="bg-[#1c1b1b] border border-white/5 p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-5">Headcount Distribution</h3>
            <div className="space-y-4">
              {headcountByDept.map(d => (
                <div key={d.dept} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                    <span className="text-white/50">{d.dept}</span>
                    <span className={cn('text-white', d.overPercent > 0 && 'text-red-400')}>
                      {d.actual} / {d.planned}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 flex overflow-hidden">
                    <div className="h-full bg-white" style={{ width: `${d.plannedPercent}%` }} />
                    {d.overPercent > 0 && (
                      <div className="h-full bg-red-500" style={{ width: `${Math.min(d.overPercent, 30)}%` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-white/5 mt-4 flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Planned</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Excess</span>
              </div>
            </div>
          </section>

          {/* Cash Drawer */}
          <section className="bg-[#131313] border border-white/5 p-5 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Cash Drawer</h3>
              <span className="material-symbols-outlined text-white/30">account_balance_wallet</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1c1b1b] p-4 border-l-2 border-white">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Issued Today</p>
                <p className="text-xl font-black text-white mt-1">$12,500</p>
              </div>
              <div className="bg-[#1c1b1b] p-4 border-l-2 border-white/20">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Remaining</p>
                <p className="text-xl font-black text-white mt-1">$3,000</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/30">Recent Payouts</p>
              {recentPayouts.map(payout => (
                <div key={payout.id} className="flex items-center justify-between hover:bg-white/3 p-2 -mx-2 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-[#2a2a2a] text-[10px] font-bold text-white">
                      {payout.method}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{payout.crewName}</p>
                      <p className="text-[10px] text-white/30 capitalize">{payout.type} Batta</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-white">-${payout.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Batta Queue */}
          <section className="space-y-3">
            <div className="flex justify-between items-end">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Batta Payout Queue</h3>
              <RoleGuard permission="canManageCrew">
                <button className="text-[10px] uppercase font-black text-white hover:underline underline-offset-4">Approve All</button>
              </RoleGuard>
            </div>
            <div className="bg-[#1c1b1b] border border-white/5 divide-y divide-white/5">
              {battaQueue.map(b => (
                <div key={b.id} className="p-4 flex items-center justify-between hover:bg-white/3 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">{b.crewName}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                      {b.department} • ${b.amount.toFixed(2)}
                    </p>
                  </div>
                  <StatusBadge
                    variant={b.status === 'approved' ? 'approved' : b.status === 'paid' ? 'paid' : 'requested'}
                    label={b.status}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function OvertimeGroupCard({ group }: { group: OvertimeGroup }) {
  return (
    <div className={cn(
      'bg-[#201f1f] border border-white/5 p-5 relative overflow-hidden',
      !group.authorized && 'opacity-60 hover:opacity-100 transition-opacity'
    )}>
      {group.authorized && (
        <div className="absolute top-3 right-3">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse block" />
        </div>
      )}
      <div className="flex justify-between items-center mb-5">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">Group Focus</p>
          <h4 className="text-xl font-black text-white uppercase tracking-tighter">{group.name}</h4>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">Members</p>
          <p className="text-lg font-black text-white">{group.memberCount}</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/30">Live Timer</p>
          <p className={cn('text-4xl font-black font-mono tracking-tighter', group.authorized ? 'text-red-400' : 'text-white')}>
            {group.elapsedLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">Est. Accrual</p>
          <p className="text-2xl font-black text-white">{formatCurrency(group.estimatedCostUSD)}</p>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-white/5 flex justify-between text-[10px] uppercase font-bold tracking-widest">
        <span className="text-white/30">Start: {group.startTime}</span>
        <span className={group.authorized ? 'text-white' : 'text-red-400 font-black'}>
          {group.authorized ? 'Authorized' : 'Unapproved'}
        </span>
      </div>
    </div>
  )
}
