export type CameraWishlistCategory = 'camera' | 'lighting' | 'grip'
export type CameraRequestStatus = 'pending_dop' | 'pending_producer' | 'approved' | 'rejected'
export type CameraLogStatus = 'checked_in' | 'checked_out'
export type CameraIssueType = 'damaged' | 'lost' | 'received_damaged'

export interface CameraWishlistItem {
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

export interface CameraRequest {
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

export interface CameraAssetLog {
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

export interface DamageReport {
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

export interface CameraAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}

export interface CreateCameraWishlistInput {
  projectId: string
  itemName: string
  category: CameraWishlistCategory
  vendorName?: string
  estimatedRate?: number
  quantity: number
}

export interface UpdateCameraWishlistInput extends Partial<Omit<CreateCameraWishlistInput, 'projectId'>> {
  projectId: string
}

export interface CreateCameraRequestInput {
  projectId: string
  itemName: string
  quantity: number
  notes?: string
}

export interface UpdateCameraRequestInput {
  projectId: string
  status: CameraRequestStatus
  notes?: string
}

export interface CameraScanInput {
  projectId: string
  assetName: string
  assetId?: string
  notes?: string
}

export interface CreateDamageReportInput {
  projectId: string
  assetName: string
  assetId?: string
  issueType: CameraIssueType
  imageUrl?: string
  notes?: string
}
