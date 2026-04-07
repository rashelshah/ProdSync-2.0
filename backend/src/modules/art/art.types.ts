export type ArtExpenseCategory = 'construction' | 'props' | 'materials' | 'misc'
export type ArtExpenseApprovalStatus = 'pending' | 'approved' | 'denied'
export type ArtPropSourcingType = 'sourced' | 'hired'
export type ArtPropStatus = 'in_use' | 'in_storage' | 'returned' | 'missing'
export type ArtSetStatus = 'planned' | 'in_progress' | 'completed'

export interface ArtExpenseRecord {
  id: string
  projectId: string
  description: string
  category: ArtExpenseCategory
  quantity: number
  amount: number
  manualAmount: number
  extractedAmount: number
  anomaly: boolean
  status: 'verified' | 'anomaly' | 'pending_review'
  ocrText: string | null
  receiptUrl: string | null
  receiptFileName: string | null
  ocrData: Record<string, unknown>
  createdById: string | null
  createdByName: string | null
  createdAt: string
  hasReceipt: boolean
  mismatchFlag: boolean
  approvalId: string | null
  approvalStatus: ArtExpenseApprovalStatus
  approvalNote: string | null
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
}

export interface ArtPropRecord {
  id: string
  projectId: string
  propName: string
  category: string
  sourcingType: ArtPropSourcingType
  status: ArtPropStatus
  vendorName: string | null
  returnDueDate: string | null
  createdAt: string
  isOverdue: boolean
}

export interface ArtSetRecord {
  id: string
  projectId: string
  setName: string
  estimatedCost: number
  actualCost: number
  status: ArtSetStatus
  progressPercentage: number
  createdAt: string
  updatedAt: string
  isOverBudget: boolean
}

export interface ArtBudgetRecord {
  projectId: string
  department: 'art'
  allocatedBudget: number
  usedBudget: number
  remainingBudget: number
  isExceeded: boolean
}

export interface ArtAlertRecord {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}
