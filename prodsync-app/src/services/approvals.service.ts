import type { ApprovalRequest, ApprovalHistory, ApprovalsKpis } from '@/types'

export const approvalsService = {
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    return []
  },
  async getApprovalHistory(): Promise<ApprovalHistory[]> {
    return []
  },
  async getKpis(): Promise<ApprovalsKpis> {
    return {
      totalPending: 0,
      highValue: 0,
      approvedToday: 0,
      rejectedToday: 0,
      pendingValueINR: 0,
      avgActionTimeMinutes: 0,
    }
  },
  async approveItem(id: string): Promise<void> {
    void id
  },
  async rejectItem(id: string): Promise<void> {
    void id
  },
}
