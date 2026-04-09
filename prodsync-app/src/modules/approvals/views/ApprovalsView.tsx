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
    <div className="page-shell">
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
  )
}
