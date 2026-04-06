export type ArtExpenseCategory = 'construction' | 'props' | 'materials' | 'misc'
export type ArtPropSourcingType = 'sourced' | 'hired'
export type ArtPropStatus = 'in_use' | 'in_storage' | 'returned' | 'missing'
export type ArtSetStatus = 'planned' | 'in_progress' | 'completed'

export interface ArtExpense {
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
}

export interface ArtProp {
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

export interface ArtSet {
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

export interface ArtBudget {
  projectId: string
  department: 'art'
  allocatedBudget: number
  usedBudget: number
  remainingBudget: number
  isExceeded: boolean
}

export interface ArtAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}

export interface CreateArtExpenseInput {
  projectId: string
  description: string
  category: ArtExpenseCategory
  quantity: number
  manualAmount: number
  receipt?: File | null
}

export interface CreateArtExpenseResult {
  success: boolean
  expense: ArtExpense
  anomaly: boolean
  extractedAmount: number
  manualAmount: number
  message: string
}

export interface CreateArtPropInput {
  projectId: string
  propName: string
  category: string
  sourcingType: ArtPropSourcingType
  status: ArtPropStatus
  vendorName?: string
  returnDueDate?: string
}

export interface UpdateArtPropInput {
  projectId: string
  status: ArtPropStatus
  vendorName?: string
  returnDueDate?: string
}

export interface CreateArtSetInput {
  projectId: string
  setName: string
  estimatedCost: number
  actualCost: number
  status: ArtSetStatus
  progressPercentage: number
}

export interface UpdateArtSetInput {
  projectId: string
  estimatedCost?: number
  actualCost?: number
  status?: ArtSetStatus
  progressPercentage?: number
}
