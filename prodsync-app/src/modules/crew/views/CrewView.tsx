import { useCrewData } from '../hooks/useCrewData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { formatCurrency, cn } from '@/utils'
import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'

const verificationConfig = {
  gps: { icon: 'location_on', colorClass: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10', label: 'GPS OK' },
  manual: { icon: 'warning', colorClass: 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-500/10', label: 'Manual' },
  biometric: { icon: 'fingerprint', colorClass: 'text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800', label: 'Biometric' },
}

export function CrewView() {
  const { isLoading, isError, kpis, crew, otGroups, battaQueue, recentPayouts, headcountByDept } = useCrewData()

  if (isLoading) return <LoadingState message="Loading Crew Control..." />
  if (isError) return <ErrorState message="Failed to load crew data" />

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Wages Administration</span>
          <h1 className="page-title page-title-compact">Crew Control Center</h1>
          <p className="page-subtitle">Attendance, overtime, and cash disbursement organized with clearer grouping and lighter surfaces.</p>
        </div>
        <RoleGuard permission="canManageCrew">
          <div className="page-toolbar">
            <button className="btn-soft">Check-In Crew</button>
            <button className="btn-soft">Approve Batta</button>
            <button className="btn-primary">Authorize OT</button>
          </div>
        </RoleGuard>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Crew" value={String(kpis.totalCrew)} subLabel={kpis.overstaffingCount > 0 ? `+${kpis.overstaffingCount} overstaffing` : 'On target'} subType={kpis.overstaffingCount > 0 ? 'critical' : 'success'} accentColor={kpis.overstaffingCount > 0 ? '#ef4444' : '#f97316'} />
        <KpiCard label="Planned Headcount" value={String(kpis.plannedHeadcount)} subLabel="Cap: 200" />
        <KpiCard label="Active OT Crew" value={String(kpis.activeOtCrew)} subLabel="Started 6:00 PM" accentColor="#f97316" />
        <KpiCard label="Total OT Cost" value={formatCurrency(kpis.totalOtCostUSD)} subLabel="Daily accrual" subType="warning" accentColor="#f97316" />
        <KpiCard label="Batta Requested" value={formatCurrency(kpis.battaRequested)} subLabel={kpis.battaRequested > 3500 ? 'Exceeds budget 12%' : 'Within budget'} subType={kpis.battaRequested > 3500 ? 'critical' : 'success'} accentColor={kpis.battaRequested > 3500 ? '#ef4444' : '#18181b'} />
        <KpiCard label="Batta Paid" value={formatCurrency(kpis.battaPaid)} subLabel={`Pending: ${formatCurrency(kpis.battaRequested - kpis.battaPaid)}`} />
      </section>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 xl:col-span-8">
          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Alerts</p>
                <h2 className="section-title">System Exceptions</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                { level: 'critical', title: 'Overtime Triggered', desc: '120 crew at 6:00 PM - standard shift finished.', time: '18:05' },
                { level: 'critical', title: 'Overstaffing Detected', desc: `${kpis.totalCrew} present vs ${kpis.plannedHeadcount} planned in Art Dept.`, time: '07:30' },
                { level: 'warning', title: 'Unapproved OT Running', desc: 'Duration: 45 mins - Stage 4 crew.', time: '18:45' },
                { level: 'warning', title: 'High Batta Requests', desc: `Exceeding daily budget by 12% (${formatCurrency(kpis.battaRequested)} total).`, time: '14:20' },
              ].map(alert => (
                <div key={alert.title} className={cn('rounded-[26px] px-5 py-4', alert.level === 'critical' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-orange-50 dark:bg-orange-500/10')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', alert.level === 'critical' ? 'text-red-500 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
                        {alert.level}
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-white">{alert.title}</p>
                      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{alert.desc}</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Surface variant="table" padding="lg">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-title">Live Attendance Tracker</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Verification and presence status for active crew.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Syncing Live</p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{kpis.totalCrew} online</p>
              </div>
            </div>
            <DataTable<CrewMember>
              columns={[
                { key: 'name', label: 'Crew Name', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.name}</span> },
                { key: 'role', label: 'Role', render: row => <span className="text-zinc-500 dark:text-zinc-400">{row.role}</span> },
                { key: 'department', label: 'Dept', render: row => <span className="text-zinc-500 dark:text-zinc-400">{row.department}</span> },
                { key: 'checkInTime', label: 'Check-In', render: row => <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{row.checkInTime}</span> },
                {
                  key: 'verification',
                  label: 'Verification',
                  render: row => {
                    const cfg = verificationConfig[row.verification]
                    return (
                      <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]', cfg.colorClass)}>
                        <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    )
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: row => <StatusBadge variant={row.status === 'ot' ? 'ot' : row.status === 'offduty' ? 'idle' : 'active'} label={row.status === 'ot' ? 'OT' : row.status === 'offduty' ? 'Off Duty' : 'Active'} />,
                },
              ]}
              data={crew}
              getKey={row => row.id}
            />
          </Surface>

          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Overtime</p>
                <h2 className="section-title">Monitoring Groups</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {otGroups.map(group => <OvertimeGroupCard key={group.id} group={group} />)}
            </div>
          </div>
        </div>

        <div className="col-span-12 space-y-8 xl:col-span-4">
          <Surface variant="muted" padding="md">
            <div className="mb-5">
              <p className="section-title">Headcount Distribution</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Planned versus actual staffing by department.</p>
            </div>
            <div className="space-y-5">
              {headcountByDept.map(item => (
                <div key={item.dept} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
                    <span className="text-zinc-500 dark:text-zinc-400">{item.dept}</span>
                    <span className={cn('text-zinc-900 dark:text-white', item.overPercent > 0 && 'text-red-500 dark:text-red-400')}>
                      {item.actual} / {item.planned}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className="h-full bg-zinc-900 dark:bg-white" style={{ width: `${item.plannedPercent}%` }} />
                    {item.overPercent > 0 && <div className="h-full bg-orange-500" style={{ width: `${Math.min(item.overPercent, 30)}%` }} />}
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface variant="table" padding="md">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-title">Cash Drawer</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Disbursement overview and latest payouts.</p>
              </div>
              <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-400">account_balance_wallet</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-950">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Issued Today</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">$12,500</p>
              </div>
              <div className="rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-950">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Remaining</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">$3,000</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Recent Payouts</p>
              {recentPayouts.map(payout => <RecentPayoutItem key={payout.id} payout={payout} />)}
            </div>
          </Surface>

          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Queue</p>
                <h2 className="section-title">Batta Payout Queue</h2>
              </div>
              <RoleGuard permission="canManageCrew">
                <button className="btn-ghost px-0">Approve All</button>
              </RoleGuard>
            </div>
            <Surface variant="table" padding="none" className="mt-4">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {battaQueue.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.crewName}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{item.department} · ${item.amount.toFixed(2)}</p>
                    </div>
                    <StatusBadge variant={item.status === 'approved' ? 'approved' : item.status === 'paid' ? 'paid' : 'requested'} label={item.status} />
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        </div>
      </section>
    </div>
  )
}

function OvertimeGroupCard({ group }: { group: OvertimeGroup }) {
  return (
    <Surface variant={group.authorized ? 'warning' : 'muted'} padding="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Group Focus</p>
          <h4 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">{group.name}</h4>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Members</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">{group.memberCount}</p>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Live Timer</p>
          <p className={cn('mt-2 font-mono text-4xl font-bold tracking-[-0.06em]', group.authorized ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-900 dark:text-white')}>
            {group.elapsedLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Est. Accrual</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">{formatCurrency(group.estimatedCostUSD)}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]">
        <span className="text-zinc-500 dark:text-zinc-400">Start: {group.startTime}</span>
        <span className={group.authorized ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-900 dark:text-white'}>{group.authorized ? 'Authorized' : 'Unapproved'}</span>
      </div>
    </Surface>
  )
}

function RecentPayoutItem({ payout }: { payout: WagePayout }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-zinc-50 px-3 py-3 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-900 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
          {payout.method}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">{payout.crewName}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{payout.type} batta</p>
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-white">-${payout.amount.toFixed(2)}</p>
    </div>
  )
}
