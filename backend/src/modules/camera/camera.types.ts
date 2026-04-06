export type CameraWishlistCategory = 'camera' | 'lighting' | 'grip'
export type CameraRequestStatus = 'pending_dop' | 'pending_producer' | 'approved' | 'rejected'
export type CameraLogStatus = 'checked_in' | 'checked_out'
export type CameraIssueType = 'damaged' | 'lost' | 'received_damaged'
export type CameraApprovalStage = 'dop' | 'producer'

export interface CameraWishlistRecord {
  id: string
  projectId: string
  itemName: string
  category: CameraWishlistCategory
  vendorName: string | null
  estimatedRate: number | null
  quantity: number
  createdById: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string | null
}

export interface CameraRequestRecord {
  id: string
  projectId: string
  itemName: string
  quantity: number
  requestedById: string | null
  requestedByName: string | null
  department: string
  status: CameraRequestStatus
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export interface CameraAssetLogRecord {
  id: string
  projectId: string
  assetId: string
  assetName: string
  checkInTime: string | null
  checkOutTime: string | null
  scannedById: string | null
  scannedByName: string | null
  status: CameraLogStatus
  notes: string | null
  createdAt: string
}

export interface DamageReportRecord {
  id: string
  projectId: string
  assetId: string | null
  assetName: string
  issueType: CameraIssueType
  reportedById: string | null
  reportedByName: string | null
  imageUrl: string | null
  notes: string | null
  createdAt: string
}

export interface CameraAlertRecord {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}
