import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsService } from '@/services/approvals.service'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { useActivityStore } from '@/features/activity/activity.store'
import { cn } from '@/utils'
import type { ApprovalRequest } from '@/types'

const VELOCITY_DATA = [12, 18, 26, 15, 14, 22, 30, 10, 18, 21, 13, 31, 19, 16].map((value, index) => ({
  day: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index % 7],
  count: value,
}))

const tooltipStyle = {
  background: 'var(--app-surface-strong)',
  border: '1px solid var(--app-border)',
  borderRadius: 18,
  fontSize: 11,
  boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
}

const tickStyle = { fill: 'var(--app-muted)', fontSize: 11 }

export function ApprovalsView() {
  const qc = useQueryClient()
  const addEvent = useActivityStore(s => s.addEvent)
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null)

  const pendingQ = useQuery({ queryKey: ['pending-approvals'], queryFn: approvalsService.getPendingApprovals })
  const historyQ = useQuery({ queryKey: ['approval-history'], queryFn: approvalsService.getApprovalHistory })
  const kpisQ = useQuery({ queryKey: ['approvals-kpis'], queryFn: approvalsService.getKpis })

  const approveMutation = useMutation({
    mutationFn: approvalsService.approveItem,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      addEvent({ type: 'approval_action', title: 'Approval Granted', description: `Request ${id} was approved.`, module: 'approvals' })
    },
  })

  if (pendingQ.isLoading) return <LoadingState message="Loading Approvals Center..." />
  if (pendingQ.isError) return <ErrorState message="Failed to load approvals" />

  const pending = pendingQ.data ?? []
  const history = historyQ.data ?? []
  const kpis = kpisQ.data
  const emergencyReqs = pending.filter(req => req.priority === 'emergency')

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Decision Layer</span>
          <h1 className="page-title page-title-compact">Approvals Center</h1>
          <p className="page-subtitle">Emergency approvals, queue review, and budget impact aligned to the new open layout and orange accent system.</p>
        </div>
        <RoleGuard permission="canApproveExpense">
          <button className="btn-primary">
            <span className="material-symbols-outlined text-sm">done_all</span>
            Approve All
          </button>
        </RoleGuard>
      </header>

      {kpis && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Total Pending" value={String(kpis.totalPending)} />
          <KpiCard label="High-Value (>Rs50K)" value={String(kpis.highValue)} subType="critical" accentColor="#ef4444" />
          <KpiCard label="Approved Today" value={String(kpis.approvedToday)} subType="success" accentColor="#f97316" />
          <KpiCard label="Rejected Today" value={String(kpis.rejectedToday)} />
          <KpiCard label="Pending Value" value={`Rs ${(kpis.pendingValueINR / 100000).toFixed(1)}L`} />
          <KpiCard label="Avg Action Time" value={`${kpis.avgActionTimeMinutes}m`} accentColor="#18181b" />
        </section>
      )}

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 xl:col-span-4">
          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Priority</p>
                <h2 className="section-title">Emergency Requests</h2>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {emergencyReqs.map(req => (
                <Surface key={req.id} variant="danger" padding="md">
                  <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-red-500 dark:bg-red-500/10 dark:text-red-400">
                    Emergency Request
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">{req.type.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{req.notes}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-lg font-bold tracking-[-0.04em] text-zinc-900 dark:text-white">Rs {req.amountINR.toLocaleString()}</span>
                    <RoleGuard permission="canApproveExpense">
                      <div className="flex gap-3">
                        <button className="btn-soft py-2">Deny</button>
                        <button onClick={() => approveMutation.mutate(req.id)} className="btn-primary py-2">
                          {approveMutation.isPending ? '...' : 'Authorize'}
                        </button>
                      </div>
                    </RoleGuard>
                  </div>
                </Surface>
              ))}
            </div>
          </div>

          <Surface variant="warning" padding="lg">
            <div className="mb-6">
              <p className="section-title">Active Overtime Monitor</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Current overtime exposure shown as a dedicated priority panel.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black">
              <span className="h-2 w-2 rounded-full bg-black" />
              Live: Unit A
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Time Elapsed</p>
                <p className="mt-2 font-mono text-4xl font-bold tracking-[-0.06em] text-zinc-900 dark:text-white">03:42:15</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Est. Accrued Cost</p>
                <p className="mt-2 text-4xl font-bold tracking-[-0.06em] text-zinc-900 dark:text-white">Rs 3,45,200</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">Crew Utilization (120 Pax)</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">88% of shift cap</p>
              </div>
              <div className="h-2 rounded-full bg-orange-100 dark:bg-orange-500/20">
                <div className="h-full w-[88%] rounded-full bg-orange-500" />
              </div>
            </div>
            <RoleGuard permission="canApproveExpense">
              <div className="mt-8 flex gap-3">
                <button className="btn-soft flex-1 justify-center">Wrap Shift Now</button>
                <button className="btn-primary flex-1 justify-center">Approve Ext. (1hr)</button>
              </div>
            </RoleGuard>
          </Surface>
        </div>

        <div className="col-span-12 space-y-8 xl:col-span-8">
          <Surface variant="table" padding="none">
            <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <p className="section-title">Unified Approval Queue</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Cleaner spacing and row hierarchy for faster triage.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    {['Type', 'Dept', 'Requested By', 'Amount', 'Time'].map((heading, index) => (
                      <th key={heading} className={cn('px-6 py-4 font-semibold', index === 4 && 'text-right')}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {pending.map(req => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedReq(req)}
                      className={cn('cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-950', selectedReq?.id === req.id && 'bg-zinc-50 dark:bg-zinc-950')}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-base text-zinc-500 dark:text-zinc-400">
                            {req.type === 'TravelAuth' ? 'local_taxi' : req.type === 'Catering' ? 'lunch_dining' : req.type === 'PropsRental' ? 'inventory_2' : 'palette'}
                          </span>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{req.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">{req.department}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                            {req.requestedByInitials}
                          </div>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{req.requestedBy}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-zinc-900 dark:text-white">Rs {req.amountINR.toLocaleString()}</td>
                      <td className="px-6 py-5 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{new Date(req.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <div className="grid gap-6 lg:grid-cols-2">
            <Surface variant="muted" padding="lg">
              <div className="mb-6">
                <p className="section-title">Budget Impact Insight</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Projected exposure before and after approvals.</p>
              </div>
              <div className="grid gap-4">
                {[
                  { label: 'Pre-Approval State', pct: 62, used: 'Rs 14.2M', total: 'of Rs 23M Total Budget' },
                  { label: 'Post-Approval Projection', pct: 68, used: 'Rs 15.6M Est.', total: '+Rs 1.4M Variance', highlight: true },
                ].map(item => (
                  <div key={item.label} className={cn('rounded-[24px] bg-white px-5 py-5 dark:bg-zinc-950', item.highlight && 'ring-1 ring-orange-200 dark:ring-orange-500/20')}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                    <div className="mt-4 flex items-center gap-4">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--chart-muted)" strokeWidth="3" />
                        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--chart-accent)" strokeWidth="3" strokeDasharray={`${item.pct * 0.88} 88`} strokeLinecap="round" />
                      </svg>
                      <div>
                        <p className="text-lg font-medium text-zinc-900 dark:text-white">{item.used}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.total}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Approval Velocity</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Volume across the last 14 days.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={VELOCITY_DATA}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={tickStyle} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--chart-accent)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>
          </div>
        </div>
      </section>

      <Surface variant="table" padding="none">
        <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <p className="section-title">Approval History & Audit Trail</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Historical decisions remain accessible in the same table flow.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {['Request ID', 'Approved By', 'Timestamp', 'Audit Note', 'Action'].map((heading, index) => (
                  <th key={heading} className={cn('px-6 py-4 font-semibold', index === 4 && 'text-right')}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {history.map(item => (
                <tr key={item.requestId}>
                  <td className="px-6 py-4 font-mono text-sm text-zinc-500 dark:text-zinc-400">{item.requestId}</td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">{item.approvedBy}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">{item.timestamp}</td>
                  <td className="px-6 py-4 text-sm italic text-zinc-500 dark:text-zinc-400">"{item.auditNote}"</td>
                  <td className="px-6 py-4 text-right">
                    <StatusBadge variant={item.action === 'approved' ? 'approved' : 'rejected'} label={item.action} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  )
}
