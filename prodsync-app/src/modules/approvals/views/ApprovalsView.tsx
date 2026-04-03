import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsService } from '@/services/approvals.service'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { useActivityStore } from '@/features/activity/activity.store'
import { cn, formatCurrency } from '@/utils'
import type { ApprovalRequest, ApprovalHistory } from '@/types'

const VELOCITY_DATA = [12, 18, 26, 15, 14, 22, 30, 10, 18, 21, 13, 31, 19, 16].map((v, i) => ({
  day: ['M','T','W','T','F','S','S'][i % 7], count: v
}))

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

  const emergencyReqs = pending.filter(r => r.priority === 'emergency')

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Approvals Center</h1>
          <p className="text-white/40 text-sm mt-1">Centralized Decision & Authorization System</p>
        </div>
        <RoleGuard permission="canApproveExpense">
          <button className="bg-white text-black px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">done_all</span>
            Approve All (Filtered)
          </button>
        </RoleGuard>
      </header>

      {/* KPI Row */}
      {kpis && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Pending" value={String(kpis.totalPending)} />
          <KpiCard label="High-Value (>₹50K)" value={String(kpis.highValue)} subType="critical" />
          <KpiCard label="Approved Today" value={String(kpis.approvedToday)} subType="success" />
          <KpiCard label="Rejected Today" value={String(kpis.rejectedToday)} />
          <KpiCard label="Pending Value" value={`₹${(kpis.pendingValueINR / 100000).toFixed(1)}L`} />
          <KpiCard label="Avg Action Time" value={`${kpis.avgActionTimeMinutes}m`} />
        </section>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Emergency Alerts Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <h3 className="text-xs font-black tracking-widest uppercase text-white/40 px-1">Critical Alerts</h3>
          {emergencyReqs.map(req => (
            <div key={req.id} className="bg-[#2a2a2a] border-l-4 border-red-500 p-5 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 scale-150">
                <span className="material-symbols-outlined text-6xl">warning</span>
              </div>
              <span className="inline-block bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded mb-3 uppercase tracking-tighter">
                Emergency Request
              </span>
              <h4 className="text-white font-bold text-base mb-1 leading-tight">{req.type.replace(/([A-Z])/g, ' $1').trim()}</h4>
              <p className="text-white/50 text-sm mb-4">{req.notes}</p>
              <div className="flex justify-between items-center border-t border-white/10 pt-4">
                <span className="text-white font-black">₹{req.amountINR.toLocaleString()}</span>
                <RoleGuard permission="canApproveExpense">
                  <div className="flex gap-2">
                    <button className="text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-900/20 px-3 py-2 rounded transition-colors">
                      Deny
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(req.id)}
                      className="bg-white text-black text-xs font-bold uppercase tracking-widest px-4 py-2 rounded hover:bg-white/90 transition-colors"
                    >
                      {approveMutation.isPending ? '...' : 'Authorize'}
                    </button>
                  </div>
                </RoleGuard>
              </div>
            </div>
          ))}

          {/* OT Budget impact for non-emergency */}
          <div className="bg-[#1c1b1b] border border-white/5 p-5 rounded-sm">
            <h3 className="text-base font-black text-white mb-4">Active Overtime Monitor</h3>
            <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full w-fit mb-6 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Live: Unit A</span>
            </div>
            <div className="flex gap-10 items-center mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Time Elapsed</p>
                <p className="text-4xl font-black text-white font-mono">03:42:15</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Est. Accrued Cost</p>
                <p className="text-4xl font-black text-white">₹3,45,200</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                <p className="text-xs font-bold text-white">Crew Utilization (120 Pax)</p>
                <p className="text-xs font-bold text-white">88% of Shift Cap</p>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-white w-[88%] rounded-full" />
              </div>
            </div>
            <RoleGuard permission="canApproveExpense">
              <div className="mt-8 flex gap-3">
                <button className="flex-1 bg-transparent border border-white/20 text-white py-3 font-black uppercase text-xs tracking-[0.2em] hover:bg-white/5 transition-colors">
                  Wrap Shift Now
                </button>
                <button className="flex-1 bg-white text-black py-3 font-black uppercase text-xs tracking-[0.2em] hover:bg-white/90 transition-colors">
                  Approve Ext. (1hr)
                </button>
              </div>
            </RoleGuard>
          </div>
        </div>

        {/* Unified Queue */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div>
            <h3 className="text-xs font-black tracking-widest uppercase text-white/40 px-1 mb-3">Unified Approval Queue</h3>
            <div className="bg-[#0e0e0e] border border-white/5 rounded-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2a2a2a]/30 border-b border-white/5">
                    {['Type', 'Dept', 'Requested By', 'Amount', 'Time'].map((h, i) => (
                      <th key={h} className={cn('px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white/30', i === 4 && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pending.map(req => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedReq(req)}
                      className="hover:bg-[#2a2a2a]/40 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-white/30 text-base">
                            {req.type === 'TravelAuth' ? 'local_taxi' : req.type === 'Catering' ? 'lunch_dining' : req.type === 'PropsRental' ? 'inventory_2' : 'palette'}
                          </span>
                          <span className="text-white font-medium text-sm">{req.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-white/40 text-sm">{req.department}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#353534] flex items-center justify-center text-[10px] font-bold text-white">
                            {req.requestedByInitials}
                          </div>
                          <span className="text-white/70 text-sm">{req.requestedBy}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-white font-bold text-sm">₹{req.amountINR.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right text-white/30 text-[10px] font-mono uppercase">{new Date(req.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Impact */}
          <div className="bg-[#1c1b1b] border border-white/5 p-5 rounded-sm">
            <h3 className="text-base font-black text-white mb-5">Budget Impact Insight</h3>
            <div className="grid grid-cols-2 gap-5 mb-5">
              {[
                { label: 'Pre-Approval State', pct: 62, used: '₹14.2M', total: 'of ₹23M Total Budget' },
                { label: 'Post-Approval Projection', pct: 68, used: '₹15.6M Est.', total: '+₹1.4M Variance', highlight: true },
              ].map(b => (
                <div key={b.label} className={cn('p-5 bg-[#0e0e0e] border border-white/5 rounded-sm', b.highlight && 'relative overflow-hidden')}>
                  {b.highlight && <div className="absolute inset-0 bg-white/3" />}
                  <p className="text-[10px] font-bold uppercase text-white/30 mb-4 tracking-widest relative">{b.label}</p>
                  <div className="flex items-center gap-3 relative">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle cx="16" cy="16" r="14" fill="none" stroke="white" strokeWidth="3"
                        strokeDasharray={`${b.pct * 0.88} 88`} strokeLinecap="round" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-white">{b.used}</p>
                      <p className="text-[10px] text-white/30">{b.total}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-3">Department Exposure</h4>
              {[['Art Department', '+1.2%'], ['Camera & Electrical', '+0.8%'], ['Production General', '+2.4%']].map(([dept, val]) => (
                <div key={dept} className="flex justify-between items-center text-xs py-2 border-b border-white/5">
                  <span className="text-white/60">{dept}</span>
                  <span className="text-white font-mono font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Approval Velocity Chart */}
          <div className="bg-[#1c1b1b] border border-white/5 p-5 rounded-sm">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-base font-black text-white mb-1">Approval Velocity & Trends</h3>
                <p className="text-white/30 text-xs uppercase tracking-widest">Activity across the last 14 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={VELOCITY_DATA}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
                <Bar dataKey="count" fill="rgba(255,255,255,0.2)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-[#0e0e0e] border border-white/5 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-xs font-black tracking-widest uppercase text-white/40">Approval History & Audit Trail</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#2a2a2a]/30 border-b border-white/5">
              {['Request ID', 'Approved By', 'Timestamp', 'Audit Note', 'Action'].map((h, i) => (
                <th key={h} className={cn('px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white/30', i === 4 && 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {history.map(h => (
              <tr key={h.requestId} className="text-sm">
                <td className="px-5 py-4 text-white/30 font-mono">{h.requestId}</td>
                <td className="px-5 py-4 text-white font-bold">{h.approvedBy}</td>
                <td className="px-5 py-4 text-white/40">{h.timestamp}</td>
                <td className="px-5 py-4 italic text-white/40">"{h.auditNote}"</td>
                <td className="px-5 py-4 text-right">
                  <StatusBadge variant={h.action === 'approved' ? 'approved' : 'rejected'} label={h.action} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
