import type { PaginationMeta } from '@/types'

export type LocationType = 'government' | 'private' | 'studio' | 'outdoor' | 'indoor'
export type LocationRiskLevel = 'low' | 'medium' | 'high'
export type LocationStatus = 'draft' | 'recce_complete' | 'permissions_pending' | 'shoot_ready' | 'completed'
export type LocationReadinessStatus = 'not_ready' | 'almost_ready' | 'ready'
export type LocationPermissionType =
  | 'police_permission'
  | 'corporation_approval'
  | 'traffic_department'
  | 'fire_department'
  | 'private_owner_agreement'
  | 'environmental_clearance'
  | 'custom'
export type LocationPermissionStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired'
export type LocationAmenityType = 'hospital' | 'police_station' | 'petrol_bunk'
export type LocationCostType = 'rent' | 'permit_fee' | 'security_fee' | 'other'

export interface LocationReadinessRecord {
  recceComplete: boolean
  permissionsComplete: boolean
  amenitiesAdded: boolean
  documentsUploaded: boolean
  readinessScore: number
  readinessStatus: LocationReadinessStatus
  summary: string
  updatedAt: string
}

export interface LocationRecord {
  id: string
  projectId: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  locationType: LocationType
  shootStartDate: string | null
  shootEndDate: string | null
  riskLevel: LocationRiskLevel
  status: LocationStatus
  notes: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  readiness: LocationReadinessRecord | null
  metrics: {
    mediaCount: number
    documentCount: number
    permissionCount: number
    approvedPermissionCount: number
    commentCount: number
    totalCost: number
  }
}

export interface LocationMediaRecord {
  id: string
  locationId: string
  mediaKind: 'image' | 'video'
  originalName: string
  storedName: string
  url: string
  mimeType: string
  fileExt: string
  fileSizeBytes: number
  latitude: number | null
  longitude: number | null
  uploadTime: string
  notes: string | null
  uploadedBy: string | null
  uploadedByName: string | null
}

export interface LocationDocumentRecord {
  id: string
  locationId: string
  permissionId: string | null
  category: string
  originalName: string
  storedName: string
  url: string
  mimeType: string
  fileExt: string
  fileSizeBytes: number
  notes: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  createdAt: string
}

export interface LocationPermissionRecord {
  id: string
  locationId: string
  permissionType: LocationPermissionType
  label: string
  authorityName: string | null
  authorityContact: string | null
  status: LocationPermissionStatus
  issueDate: string | null
  expiryDate: string | null
  daysRemaining: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LocationAmenityRecord {
  id: string
  locationId: string
  amenityType: LocationAmenityType
  name: string | null
  address: string | null
  phoneNumber: string | null
  distanceKm: number | null
  latitude: number | null
  longitude: number | null
  mapLink: string | null
  source: 'manual' | 'mapbox'
  updatedAt: string
}

export interface LocationTimelineRecord {
  id: string
  locationId: string
  eventType: string
  title: string
  description: string | null
  eventAt: string
  createdBy: string | null
  createdByName: string | null
}

export interface LocationCommentRecord {
  id: string
  locationId: string
  userId: string | null
  userName: string | null
  message: string
  createdAt: string
}

export interface LocationCostRecord {
  id: string
  locationId: string
  costType: LocationCostType
  label: string
  amount: number
  currencyCode: string
  approvalRequested: boolean
  approvalId: string | null
  approvalStatus: 'not_requested' | 'pending' | 'approved' | 'rejected'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LocationDetailRecord {
  location: LocationRecord
  permissions: LocationPermissionRecord[]
  amenities: LocationAmenityRecord[]
  timeline: LocationTimelineRecord[]
  comments: LocationCommentRecord[]
  costs: LocationCostRecord[]
}

export interface PaginatedLocations {
  data: LocationRecord[]
  pagination: PaginationMeta
}

export interface PaginatedLocationMedia {
  data: LocationMediaRecord[]
  pagination: PaginationMeta
}

export interface PaginatedLocationDocuments {
  data: LocationDocumentRecord[]
  pagination: PaginationMeta
}

export interface LocationDashboardRecord {
  activeLocations: number
  shootReadyLocations: number
  pendingPermissions: number
  expiringPermissions30Days: number
  expiringPermissions7Days: number
  expiredPermissions: number
  recentActivity: LocationTimelineRecord[]
}

export interface LocationReportsRecord {
  permissionCompliance: {
    total: number
    approved: number
    pending: number
    submitted: number
    rejected: number
    expired: number
  }
  locationSpend: {
    total: number
    rent: number
    permitFee: number
    securityFee: number
    other: number
    pendingApprovalCount: number
  }
  readinessStatus: {
    ready: number
    almostReady: number
    notReady: number
  }
  locationActivity: {
    recent: LocationTimelineRecord[]
    totalEvents: number
  }
  uploadActivity: {
    mediaCount: number
    documentCount: number
    recentMedia: LocationMediaRecord[]
    recentDocuments: LocationDocumentRecord[]
  }
}

export interface LocationListFilters {
  search?: string
  status?: LocationStatus | ''
  riskLevel?: LocationRiskLevel | ''
  locationType?: LocationType | ''
  page?: number
  pageSize?: number
}

export interface LocationSearchSuggestion {
  id: string
  label: string
  address: string
  latitude: number
  longitude: number
  source: 'backend' | 'mapbox'
  meta?: {
    featureType?: string
    poiCategories?: string[]
    cacheHit?: boolean
  }
}

export interface NearbyAmenitySuggestion {
  id: string
  amenityType: LocationAmenityType
  name: string
  address: string
  phoneNumber: string | null
  distanceKm: number
  latitude: number | null
  longitude: number | null
  mapLink: string | null
  source: 'mapbox' | 'manual'
  metadata?: {
    featureType?: string
    poiCategories?: string[]
  }
}

export interface NearbyHotelSuggestion {
  id: string
  name: string
  address: string
  phoneNumber: string | null
  distanceKm: number
  latitude: number | null
  longitude: number | null
  mapLink: string | null
  source: 'mapbox' | 'manual'
  metadata?: {
    featureType?: string
    poiCategories?: string[]
  }
}

export interface CreateLocationInput {
  projectId: string
  name: string
  address: string
  latitude?: number
  longitude?: number
  locationType: LocationType
  shootStartDate?: string
  shootEndDate?: string
  riskLevel: LocationRiskLevel
  status: LocationStatus
  notes?: string
}

export interface UpdateLocationInput extends Partial<Omit<CreateLocationInput, 'projectId'>> {
  projectId: string
}

export interface CreateLocationPermissionInput {
  projectId: string
  permissionType: LocationPermissionType
  customLabel?: string
  authorityName?: string
  authorityContact?: string
  status: LocationPermissionStatus
  issueDate?: string
  expiryDate?: string
  notes?: string
}

export interface UpsertLocationAmenityInput {
  projectId: string
  amenityType: LocationAmenityType
  name?: string | null
  address?: string | null
  phoneNumber?: string | null
  distanceKm?: number
  latitude?: number
  longitude?: number
  mapLink?: string | null
  source?: 'manual' | 'mapbox'
}

export interface CreateLocationCommentInput {
  projectId: string
  message: string
}

export interface CreateLocationTimelineInput {
  projectId: string
  title: string
  description?: string
  eventType?: string
  eventAt?: string
}

export interface CreateLocationCostInput {
  projectId: string
  costType: LocationCostType
  label?: string
  amount: number
  currencyCode?: string
  approvalRequested?: boolean
  notes?: string
}

export interface UpdateLocationCostInput extends Partial<Omit<CreateLocationCostInput, 'projectId'>> {
  projectId: string
}
