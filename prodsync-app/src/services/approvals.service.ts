import type { ApprovalRequest, ApprovalHistory, ApprovalsKpis } from '@/types'
import { apiFetch, readApiJson } from '@/lib/api'

function withProjectId(projectId: string) {
  return encodeURIComponent(projectId)
}

export const approvalsService = {
  async getPendingApprovals(projectId: string): Promise<ApprovalRequest[]> {
    console.log('[approvalsService] fetching pending approvals', { projectId })
    const response = await apiFetch(`/requests/${withProjectId(projectId)}`)
    const payload = await readApiJson<{ requests: ApprovalRequest[] }>(response)
    console.log('[approvalsService] pending approvals loaded', { projectId, count: payload.requests?.length ?? 0 })
    return payload.requests ?? []
  },
  async getApprovalHistory(projectId: string): Promise<ApprovalHistory[]> {
    console.log('[approvalsService] fetching approval history', { projectId })
    const response = await apiFetch(`/requests/${withProjectId(projectId)}/history`)
    const payload = await readApiJson<{ history: ApprovalHistory[] }>(response)
    console.log('[approvalsService] approval history loaded', { projectId, count: payload.history?.length ?? 0 })
    return payload.history ?? []
  },
  async getKpis(projectId: string): Promise<ApprovalsKpis> {
    console.log('[approvalsService] fetching approval KPIs', { projectId })
    const response = await apiFetch(`/requests/${withProjectId(projectId)}/kpis`)
    const payload = await readApiJson<{ kpis: ApprovalsKpis }>(response)
    console.log('[approvalsService] approval KPIs loaded', { projectId, totalPending: payload.kpis?.totalPending ?? 0 })
    return payload.kpis
  },
  async approveItem(projectId: string, id: string): Promise<void> {
    console.log('[approvalsService] approving request', { projectId, id })
    const response = await apiFetch(`/requests/${withProjectId(projectId)}/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    })
    await readApiJson<{ ok: boolean }>(response)
    console.log('[approvalsService] request approved', { projectId, id })
  },
  async rejectItem(projectId: string, id: string, reason?: string): Promise<void> {
    console.log('[approvalsService] rejecting request', { projectId, id })
    const response = await apiFetch(`/requests/${withProjectId(projectId)}/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    })
    await readApiJson<{ ok: boolean }>(response)
    console.log('[approvalsService] request rejected', { projectId, id })
  },
}
