import type { ApprovalRequest, ApprovalHistory, ApprovalsKpis } from '@/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const MOCK_PENDING: ApprovalRequest[] = [
  { id: 'req-8294', type: 'CameraRental', department: 'Camera', requestedBy: 'Crew Member', requestedByInitials: 'CM', amountINR: 85000, timestamp: new Date().toISOString(), status: 'pending', priority: 'emergency', notes: 'RED Dragon 8K Replacement — Unit B sensor failure on set.' },
  { id: 'req-8293', type: 'OvertimeExt', department: 'Production', requestedBy: 'K. Sharma', requestedByInitials: 'KS', amountINR: 420000, timestamp: new Date().toISOString(), status: 'pending', priority: 'high', notes: 'Scene "The Rain Heist" running 4 hours over schedule.' },
  { id: 'req-8292', type: 'ArtExpense', department: 'Art Dept', requestedBy: 'M. Kapoor', requestedByInitials: 'MK', amountINR: 12400, timestamp: new Date().toISOString(), status: 'pending', priority: 'normal' },
  { id: 'req-8291', type: 'TravelAuth', department: 'Logistics', requestedBy: 'J. Doe', requestedByInitials: 'JD', amountINR: 4500, timestamp: new Date().toISOString(), status: 'pending', priority: 'normal' },
  { id: 'req-8290', type: 'Catering', department: 'Production', requestedBy: 'A. Singh', requestedByInitials: 'AS', amountINR: 28000, timestamp: new Date().toISOString(), status: 'pending', priority: 'normal' },
  { id: 'req-8289', type: 'PropsRental', department: 'Art Dept', requestedBy: 'R. Malik', requestedByInitials: 'RM', amountINR: 65000, timestamp: new Date().toISOString(), status: 'pending', priority: 'high' },
]

const MOCK_HISTORY: ApprovalHistory[] = [
  { requestId: '#REQ-8291', approvedBy: 'K. Sharma (LP)', role: 'Line Producer', timestamp: 'Oct 24, 09:12 AM', auditNote: 'Authorized for scene 12 only.', action: 'approved' },
  { requestId: '#REQ-8288', approvedBy: 'S. Verve (Prod)', role: 'Line Producer', timestamp: 'Oct 24, 08:45 AM', auditNote: 'Standard rental rate applied.', action: 'approved' },
  { requestId: '#REQ-8285', approvedBy: 'K. Sharma (LP)', role: 'Line Producer', timestamp: 'Oct 23, 11:30 PM', auditNote: 'Rejected. Out of budget scope.', action: 'rejected' },
]

const MOCK_KPIS: ApprovalsKpis = {
  totalPending: 42,
  highValue: 8,
  approvedToday: 154,
  rejectedToday: 4,
  pendingValueINR: 1_200_000,
  avgActionTimeMinutes: 12,
}

export const approvalsService = {
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    await delay(300)
    return MOCK_PENDING
  },
  async getApprovalHistory(): Promise<ApprovalHistory[]> {
    await delay(250)
    return MOCK_HISTORY
  },
  async getKpis(): Promise<ApprovalsKpis> {
    await delay(150)
    return MOCK_KPIS
  },
  async approveItem(id: string): Promise<void> {
    await delay(500)
    console.log(`Approved: ${id}`)
  },
  async rejectItem(id: string): Promise<void> {
    await delay(500)
    console.log(`Rejected: ${id}`)
  },
}
