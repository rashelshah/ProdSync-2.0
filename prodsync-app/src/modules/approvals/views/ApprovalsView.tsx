import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateProjectData } from '@/context/project-sync'
import { approvalsService } from '@/services/approvals.service'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import type { ApprovalRequest } from '@/types'
import { formatCurrency, formatDate, formatTime, timeAgo } from '@/utils'

function approvalStageBadge(item: ApprovalRequest) {
  if (item.workflowStatus === 'pending_art_director') {
    return <StatusBadge variant="pending" label="Waiting for Director" />
  }

  if (item.workflowStatus === 'pending_producer') {
    return <StatusBadge variant="pending" label="Ready for Producer" />
  }

  if (item.workflowStatus === 'pending_dop') {
    return <StatusBadge variant="pending" label="Waiting for DOP" />
  }

  return <StatusBadge variant="pending" label={item.stageLabel ?? 'Pending'} />
}

export function ApprovalsView() {
  const qc = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const [activeAction, setActiveAction] = useState<string | null>(null)

  const pendingQ = useQuery({
    queryKey: ['pending-approvals', activeProjectId],
    queryFn: () => approvalsService.getPendingApprovals(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const historyQ = useQuery({
    queryKey: ['approval-history', activeProjectId],
    queryFn: () => approvalsService.getApprovalHistory(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const kpisQ = useQuery({
    queryKey: ['approvals-kpis', activeProjectId],
    queryFn: () => approvalsService.getKpis(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      if (!activeProjectId) return
      const pending = (pendingQ.data ?? []).filter(item => item.canAct !== false)
      await Promise.all(pending.map(item => approvalsService.approveItem(activeProjectId, item.id)))
    },
  })

  async function invalidateApprovalQueries() {
    await invalidateProjectData(qc, {
      projectId: activeProjectId,
      userId: user?.id,
    })
  }

  async function runApprovalAction(
    action: () => Promise<unknown>,
    options: {
      successMessage: string
      loadingKey: string
      loadingMessage: string
      errorMessage: string
    },
  ) {
    setActiveAction(options.loadingKey)
    showLoading(options.loadingMessage, { id: options.loadingKey })

    try {
      await action()
      await invalidateApprovalQueries()
      showSuccess(options.successMessage, { id: options.loadingKey })
    } catch (error) {
      await invalidateApprovalQueries()
      showError(resolveErrorMessage(error, options.errorMessage), { id: options.loadingKey })
    } finally {
      setActiveAction(null)
    }
  }

  if (isLoadingProjectContext || pendingQ.isLoading) return <LoadingState message="Loading approvals..." />
  if (isErrorProjectContext || pendingQ.isError || historyQ.isError || kpisQ.isError) return <ErrorState message="Failed to load approvals" />

  const pending = pendingQ.data ?? []
  const history = historyQ.data ?? []
  const kpis = kpisQ.data
  const actionablePending = pending.filter(item => item.canAct !== false)
  const hasData = pending.length > 0 || history.length > 0 || Boolean(kpis && (kpis.totalPending > 0 || kpis.pendingValueINR > 0))

  return (
    <div className="page-shell space-y-6 md:space-y-0 pb-safe">
      {/* DESKTOP UI */}
      <div className="hidden xl:block space-y-6">
      <header className="page-header">
        <div>
          <span className="page-kicker">Decision Layer</span>
          <h1 className="page-title page-title-compact">Approvals Center</h1>
          <p className="page-subtitle">Approval workflows now read and update the live backend queue for the selected project.</p>
        </div>
        <RoleGuard permission="canApproveExpense">
          <button
            onClick={() => runApprovalAction(() => approveAllMutation.mutateAsync(), {
              successMessage: 'All pending requests approved.',
              loadingKey: 'approve-all',
              loadingMessage: 'Approving all pending requests...',
              errorMessage: 'Bulk approval failed.',
            })}
            className="btn-primary"
            disabled={!activeProjectId || actionablePending.length === 0 || activeAction !== null}
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            {activeAction === 'approve-all' ? 'Updating...' : 'Approve All'}
          </button>
        </RoleGuard>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Pending" value={String(kpis?.totalPending ?? 0)} subLabel="Live queue size" />
        <KpiCard label="High-Value" value={String(kpis?.highValue ?? 0)} subLabel="Awaiting real thresholds" />
        <KpiCard label="Approved Today" value={String(kpis?.approvedToday ?? 0)} subLabel="Today only" />
        <KpiCard label="Rejected Today" value={String(kpis?.rejectedToday ?? 0)} subLabel="Today only" />
        <KpiCard label="Pending Value" value={formatCurrency(kpis?.pendingValueINR ?? 0)} subLabel="Live financial exposure" />
        <KpiCard label="Avg Action Time" value={`${kpis?.avgActionTimeMinutes ?? 0}m`} subLabel="Computed from audits" />
      </section>

      {!hasData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="verified_user"
            title="No approval records yet"
            description="No stored approval records are available for the selected project yet."
          />
        </Surface>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Pending</p>
                <h2 className="section-title">Open Requests</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {pending.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending approvals.</p>
              ) : (
                pending.map(item => (
                  <div key={item.id} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.type}</p>
                      {approvalStageBadge(item)}
                      {item.sourceModule && (
                        <span className="rounded-full bg-zinc-200/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                          {item.sourceModule}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.department} | {formatCurrency(item.amountINR)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                      {item.requestedBy} | {timeAgo(item.timestamp)}
                    </p>
                    {item.notes && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{item.notes}</p>}
                    {item.canAct === false && (
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                        Visible for sync. Action unlocks after the current department approval stage is completed.
                      </p>
                    )}
                    <RoleGuard permission="canApproveExpense">
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => runApprovalAction(() => approvalsService.approveItem(activeProjectId!, item.id), {
                            successMessage: 'Approved successfully',
                            loadingKey: `approve-${item.id}`,
                            loadingMessage: 'Approving request...',
                            errorMessage: 'Approval failed.',
                          })}
                          className="btn-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                          disabled={!activeProjectId || activeAction !== null || item.canAct === false}
                        >
                          {activeAction === `approve-${item.id}` ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => runApprovalAction(() => approvalsService.rejectItem(activeProjectId!, item.id), {
                            successMessage: 'Request flagged',
                            loadingKey: `reject-${item.id}`,
                            loadingMessage: 'Flagging request...',
                            errorMessage: 'Request could not be flagged.',
                          })}
                          className="btn-ghost px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-500 dark:text-red-400"
                          disabled={!activeProjectId || activeAction !== null || item.canAct === false}
                        >
                          {activeAction === `reject-${item.id}` ? 'Denying...' : 'Deny'}
                        </button>
                      </div>
                    </RoleGuard>
                  </div>
                ))
              )}
            </div>
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">History</p>
                <h2 className="section-title">Audit Trail</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No approval history yet.</p>
              ) : (
                history.map(item => (
                  <div key={`${item.requestId}-${item.timestamp}`} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.requestId}</p>
                      <StatusBadge
                        variant={item.action === 'rejected' ? 'rejected' : 'approved'}
                        label={item.action === 'rejected' ? 'Denied' : 'Approved'}
                      />
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {item.approvedBy} | {item.role}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                      {formatDate(item.timestamp)} | {formatTime(item.timestamp)}
                    </p>
                    {item.auditNote && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{item.auditNote}</p>}
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      )}
    </div>

    {/* MOBILE UI */}
    <div className="flex flex-col md:hidden mt-2 px-1 pb-[140px] min-h-screen">
      {/* Header */}
      <header className="px-3 mb-6">
        <div className="flex items-center justify-between overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <div>
            <span className="page-kicker text-orange-500">Decision Layer</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white tracking-tight leading-none">Approvals Center</h1>
          </div>
          <RoleGuard permission="canApproveExpense">
            <button
              onClick={() => runApprovalAction(() => approveAllMutation.mutateAsync(), {
                  successMessage: 'All pending requests approved.',
                  loadingKey: 'approve-all',
                  loadingMessage: 'Approving all pending requests...',
                  errorMessage: 'Bulk approval failed.',
              })}
              className="bg-orange-500 text-white px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 tracking-wider shadow-md active:scale-95 transition-transform text-center"
              disabled={!activeProjectId || actionablePending.length === 0 || activeAction !== null}
             >
              Approve<br/>All
            </button>
          </RoleGuard>
        </div>
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3 pt-6 pb-[240px]">
        <section className="px-1 pb-2">
           <div className="flex items-center gap-4 mb-4">
             <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">LIVE PIPELINE</h2>
             <div className="h-[1px] flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">In Pipeline</span>
               <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{kpis?.totalPending ?? 0}</div>
             </div>
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Avg Time</span>
               <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{kpis?.avgActionTimeMinutes ?? 0}m</div>
             </div>
             <div className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
               <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Pending Value</span>
               <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{formatCurrency(kpis?.pendingValueINR ?? 0)}</div>
             </div>
           </div>
        </section>

        {/* pending requests */}
        <section>
           <div className="flex items-center gap-4 mb-4">
             <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">CRITICAL PENDING REQUESTS</h2>
           </div>
           <div className="space-y-4">
             {pending.length === 0 ? (
               <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending approvals.</p>
             ) : (
               pending.map(item => (
                <div key={item.id} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-[24px] overflow-hidden flex flex-col relative">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                       <div>
                         <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{item.type}</h3>
                         <div className="flex items-center gap-2 mt-1">
                           {item.sourceModule && (
                             <span className="bg-[#3B1F0F] text-orange-500 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase">
                               {item.sourceModule}
                             </span>
                           )}
                           <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold">{item.requestedBy} | {timeAgo(item.timestamp)}</span>
                         </div>
                       </div>
                       <div className="text-right">
                          <p className="text-lg font-bold text-zinc-900 dark:text-white leading-none">{formatCurrency(item.amountINR)}</p>
                          <p className="text-[8px] font-bold text-orange-500 uppercase tracking-[0.15em] mt-2">WAITING FOR INFO</p>
                       </div>
                    </div>

                    <div className="mt-5 bg-white dark:bg-zinc-950 rounded-[16px] p-4 space-y-3.5 border border-zinc-200 dark:border-white/5 shadow-sm">
                       {item.notes && (
                         <div className="flex gap-3 text-xs text-zinc-600 dark:text-zinc-400 items-start">
                            <span className="material-symbols-outlined text-[16px] text-zinc-400 dark:text-zinc-500 mt-0.5">description</span>
                            <p className="leading-relaxed">{item.notes}</p>
                         </div>
                       )}
                       <div className="flex gap-3 text-xs items-center font-medium italic text-zinc-600 dark:text-zinc-400">
                         <span className="material-symbols-outlined text-[16px] text-orange-500">hourglass_empty</span>
                         {item.canAct === false ? 'Awaiting department approval...' : 'Awaiting your approval...'}
                       </div>
                    </div>
                  </div>
                  <RoleGuard permission="canApproveExpense">
                     <div className="flex w-full mt-2">
                        <button
                          onClick={() => runApprovalAction(() => approvalsService.rejectItem(activeProjectId!, item.id), {
                            successMessage: 'Request flagged',
                            loadingKey: `reject-${item.id}`,
                            loadingMessage: 'Flagging request...',
                            errorMessage: 'Request could not be flagged.',
                          })}
                          className="flex-1 py-3.5 bg-transparent text-red-500 dark:text-red-400 font-bold text-xs tracking-[0.2em] text-center uppercase transition-colors disabled:opacity-50"
                          disabled={!activeProjectId || activeAction !== null || item.canAct === false}
                        >
                          {activeAction === `reject-${item.id}` ? 'DENYING' : 'DENY'}
                        </button>
                        <button
                          onClick={() => runApprovalAction(() => approvalsService.approveItem(activeProjectId!, item.id), {
                            successMessage: 'Approved successfully',
                            loadingKey: `approve-${item.id}`,
                            loadingMessage: 'Approving request...',
                            errorMessage: 'Approval failed.',
                          })}
                          className="flex-1 py-3.5 bg-orange-500 text-white font-bold text-xs tracking-[0.2em] text-center uppercase active:bg-orange-600 transition-colors shadow-inner disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:shadow-none font-sans"
                          disabled={!activeProjectId || activeAction !== null || item.canAct === false}
                        >
                          {activeAction === `approve-${item.id}` ? 'APPROVING' : 'APPROVE'}
                        </button>
                     </div>
                  </RoleGuard>
                </div>
               ))
             )}
           </div>
        </section>

        {/* history */}
        <section>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">RECENT HISTORY</h2>
             <button className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500">VIEW ALL</button>
           </div>
           
           <div className="bg-white dark:bg-[#151515] border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5 shadow-sm">
             {history.length === 0 ? (
               <p className="text-sm text-zinc-500 dark:text-zinc-400 p-4">No approval history yet.</p>
             ) : (
               history.map(item => (
                <div key={`${item.requestId}-${item.timestamp}`} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900">
                   <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.action === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                       <span className="material-symbols-outlined text-[18px]">{item.action === 'rejected' ? 'close' : 'check_circle'}</span>
                     </div>
                     <div>
                       <h4 className="text-zinc-900 dark:text-white font-bold text-[13px] uppercase tracking-wider">{item.requestId}</h4>
                       <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">{item.action === 'rejected' ? 'DENIED' : 'APPROVED'} BY {item.approvedBy} • {timeAgo(item.timestamp).toUpperCase()}</p>
                     </div>
                   </div>
                   <div className="text-zinc-900 dark:text-zinc-300 font-bold text-[13px]">
                      {/* Fake amount like screenshot, since history doesn't have it natively we show a fixed generic layout or omit.*/}
                      {/* Usually the frontend would need to fetch the original invoice amount, but in this specific example we will leave it empty if there's no amount, but the image shows '₹1,200', let's use a subtle check. Since history object in this mockup lacks `amount`, we'll just not show it as there is nothing to map to without faking. OH wait, "make sure u exactly replicate that ui which is given in the images". I'll add `₹1,200` generically or random for now just to match if I have to. However, `item.auditNote` may contain the amount. Let's just leave it blank or just rely on backend data if `amountINR` gets added later. Actually, the user says "exactly replicate that ui". "₹1,200" is for PAINT, "₹8,500" for MIRROR, "₹12,000" for CHAIRS. Those correspond to requests! But in our app they are `requestId`. So I will just render: */}
                      {typeof (item as any).amountINR === 'number' ? formatCurrency((item as any).amountINR) : ''}
                   </div>
                </div>
               ))
             )}
           </div>
        </section>
      </div>
    </div>

    </div>
  )
}
