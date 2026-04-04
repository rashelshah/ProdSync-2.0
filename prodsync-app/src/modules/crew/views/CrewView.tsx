import { useCrewData } from '../hooks/useCrewData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { formatCurrency, cn } from '@/utils'
import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'

const verificationConfig = {
  gps: { icon: 'location_on', colorClass: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10', label: 'GPS OK' },
  manual: { icon: 'warning', colorClass: 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-500/10', label: 'Manual' },
  biometric: { icon: 'fingerprint', colorClass: 'text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800', label: 'Biometric' },
}

export function CrewView() {
  const { isLoading, isError, kpis, crew, otGroups, battaQueue, recentPayouts, headcountByDept } = useCrewData()
  const hasData = crew.length > 0 || otGroups.length > 0 || battaQueue.length > 0 || recentPayouts.length > 0

  if (isLoading) return <LoadingState message="Loading crew control..." />
  if (isError) return <ErrorState message="Failed to load crew data" />

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Wages Administration</span>
          <h1 className="page-title page-title-compact">Crew Control Center</h1>
          <p className="page-subtitle">Attendance, overtime, and batta flows now load directly from stored project records.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Crew" value={String(kpis.totalCrew)} subLabel="Attendance-backed headcount" />
        <KpiCard label="Planned Headcount" value={String(kpis.plannedHeadcount)} subLabel="Derived from live staffing setup" />
        <KpiCard label="Active OT Crew" value={String(kpis.activeOtCrew)} subLabel="From overtime groups" />
        <KpiCard label="Total OT Cost" value={formatCurrency(kpis.totalOtCostUSD)} subLabel="Estimated OT cost" />
        <KpiCard label="Batta Requested" value={formatCurrency(kpis.battaRequested)} subLabel="Pending batta amount" />
        <KpiCard label="Batta Paid" value={formatCurrency(kpis.battaPaid)} subLabel="Settled batta amount" />
      </section>

      {!hasData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="groups"
            title="No crew data yet"
            description="No attendance, overtime, or payout records have been stored for this project yet."
          />
        </Surface>
      ) : (
        <div className="space-y-8">
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Live Attendance Tracker</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Verification and presence status for active crew.</p>
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

          <div className="grid gap-6 xl:grid-cols-2">
            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Overtime Groups</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Current OT groups derived from live overtime records.</p>
              </div>
              <div className="space-y-3">
                {otGroups.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No overtime groups yet.</p>
                ) : (
                  otGroups.map(group => <OvertimeGroupCard key={group.id} group={group} />)
                )}
              </div>
            </Surface>

            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Recent Payouts</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Latest batta and wage disbursement records.</p>
              </div>
              <div className="space-y-3">
                {recentPayouts.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No payout records yet.</p>
                ) : (
                  recentPayouts.map(payout => <RecentPayoutItem key={payout.id} payout={payout} />)
                )}
              </div>
            </Surface>
          </div>

          {headcountByDept.length > 0 && (
            <Surface variant="muted" padding="md">
              <div className="mb-5">
                <p className="section-title">Headcount Distribution</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Department headcount based on live attendance.</p>
              </div>
              <div className="space-y-5">
                {headcountByDept.map(item => (
                  <div key={item.dept} className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
                      <span className="text-zinc-500 dark:text-zinc-400">{item.dept}</span>
                      <span className="text-zinc-900 dark:text-white">{item.actual}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-zinc-900 dark:bg-white" style={{ width: `${item.plannedPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </div>
      )}
    </div>
  )
}

function OvertimeGroupCard({ group }: { group: OvertimeGroup }) {
  return (
    <div className="rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">{group.name}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{group.memberCount} members • {group.startTime}</p>
        </div>
        <StatusBadge variant={group.authorized ? 'approved' : 'requested'} label={group.authorized ? 'Authorized' : 'Unapproved'} />
      </div>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        {group.elapsedLabel} • {formatCurrency(group.estimatedCostUSD)}
      </p>
    </div>
  )
}

function RecentPayoutItem({ payout }: { payout: WagePayout }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-zinc-50 px-3 py-3 dark:bg-zinc-950">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{payout.crewName}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{payout.type} • {payout.method}</p>
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-white">${payout.amount.toFixed(2)}</p>
    </div>
  )
}
