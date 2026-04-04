import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalsService } from '@/services/approvals.service'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { RoleGuard } from '@/features/auth/RoleGuard'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'

export function ApprovalsView() {
  const qc = useQueryClient()
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()

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

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!activeProjectId) return
      const pending = pendingQ.data ?? []
      await Promise.all(pending.map(item => approvalsService.approveItem(activeProjectId, item.id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals', activeProjectId] })
      qc.invalidateQueries({ queryKey: ['approval-history', activeProjectId] })
      qc.invalidateQueries({ queryKey: ['approvals-kpis', activeProjectId] })
      qc.invalidateQueries({ queryKey: ['activity', activeProjectId] })
    },
  })

  if (isLoadingProjectContext || pendingQ.isLoading) return <LoadingState message="Loading approvals..." />
  if (isErrorProjectContext || pendingQ.isError || historyQ.isError || kpisQ.isError) return <ErrorState message="Failed to load approvals" />

  const pending = pendingQ.data ?? []
  const history = historyQ.data ?? []
  const kpis = kpisQ.data
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
          <button onClick={() => approveMutation.mutate()} className="btn-primary" disabled={!activeProjectId || pending.length === 0 || approveMutation.isPending}>
            <span className="material-symbols-outlined text-sm">done_all</span>
            {approveMutation.isPending ? 'Updating...' : 'Approve All'}
          </button>
        </RoleGuard>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Pending" value={String(kpis?.totalPending ?? 0)} subLabel="Live queue size" />
        <KpiCard label="High-Value" value={String(kpis?.highValue ?? 0)} subLabel="Awaiting real thresholds" />
        <KpiCard label="Approved Today" value={String(kpis?.approvedToday ?? 0)} subLabel="Today only" />
        <KpiCard label="Rejected Today" value={String(kpis?.rejectedToday ?? 0)} subLabel="Today only" />
        <KpiCard label="Pending Value" value={`Rs ${(kpis?.pendingValueINR ?? 0).toLocaleString()}`} subLabel="Live financial exposure" />
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
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.type}</p>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.department} • Rs {item.amountINR.toLocaleString()}</p>
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
                  <div key={item.requestId} className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.requestId}</p>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.approvedBy} • {item.action}</p>
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
