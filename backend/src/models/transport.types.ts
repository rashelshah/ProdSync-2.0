export type VehicleStatus = 'active' | 'idle' | 'maintenance' | 'exception'
export type TripStatus = 'planned' | 'active' | 'completed' | 'flagged' | 'cancelled'
export type FuelAuditStatus = 'verified' | 'mismatch' | 'pending'
export type FraudStatus = 'NORMAL' | 'SUSPICIOUS' | 'FRAUD'
export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export interface LocationPoint {
  latitude?: number
  longitude?: number
  address?: string
}

export interface PaginationInput {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface VehicleRecord {
  id: string
  projectId: string
  name: string
  vehicleType: string
  status: VehicleStatus
  registrationNumber: string | null
  capacity: number | null
  assignedDriverUserId: string | null
  assignedDriverName: string | null
  gpsDeviceId: string | null
  baseLocation: string | null
  notes: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AssignableDriverRecord {
  userId: string
  fullName: string
  department: string | null
  role: string | null
}

export interface TripRecord {
  id: string
  projectId: string
  vehicleId: string
  vehicleName: string
  driverUserId: string | null
  driverName: string | null
  startTime: string
  endTime: string | null
  startLocation: LocationPoint | null
  endLocation: LocationPoint | null
  startOdometerKm: number | null
  endOdometerKm: number | null
  distanceKm: number
  durationMinutes: number | null
  idleMinutes: number | null
  origin: string | null
  destination: string | null
  purpose: string | null
  status: TripStatus
  outstationFlag: boolean
  abnormalityScore: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface FuelLogRecord {
  id: string
  projectId: string
  vehicleId: string
  vehicleName: string
  tripId: string | null
  loggedBy: string
  loggedByName: string | null
  logDate: string
  fuelType: string
  liters: number
  odometerKm: number | null
  expectedMileage: number | null
  actualMileage: number | null
  cost: number | null
  currencyCode: string
  auditStatus: FuelAuditStatus
  notes: string | null
  receiptFilePath: string | null
  odometerImagePath: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  approvalNote: string | null
  fraudStatus: FraudStatus
  fraudScore: number
  fraudReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TransportAlertRecord {
  id: string
  projectId: string
  vehicleId: string | null
  tripId: string | null
  fuelLogId: string | null
  severity: AlertSeverity
  alertType: string
  title: string
  message: string
  status: AlertStatus
  triggeredAt: string
  metadata: Record<string, unknown>
}

export interface GpsLogRecord {
  id: number
  projectId: string
  vehicleId: string
  tripId: string | null
  capturedAt: string
  latitude: number
  longitude: number
  speedKph: number | null
  heading: number | null
  geofenceStatus: string | null
  metadata: Record<string, unknown>
}

export interface LiveVehicleLocationRecord {
  projectId: string
  tripId: string
  vehicleId: string
  vehicleName: string
  registrationNumber: string | null
  driverUserId: string | null
  driverName: string | null
  latitude: number
  longitude: number
  speedKph: number | null
  heading: number | null
  accuracyMeters: number | null
  capturedAt: string
  source: 'cache' | 'database' | 'stream'
  previousLatitude: number | null
  previousLongitude: number | null
  previousCapturedAt: string | null
  routeCoordinates: Array<[number, number]>
  routeProvider: 'mapbox' | 'straight_line' | 'none'
  plannedRouteCoordinates?: Array<[number, number]>
  plannedRouteProvider?: 'mapbox' | 'straight_line' | 'none'
  updateIntervalMs: number | null
  expectedNextUpdateAt: string | null
  distanceRemainingKm: number | null
  trackingMode: 'short_trip' | 'long_trip' | 'approaching_destination' | 'idle' | 'arrived'
  movingStatus: 'enroute' | 'approaching_destination' | 'arrived' | 'idle' | 'stale'
}

export interface FraudAssessment {
  status: FraudStatus
  score: number
  reason: string | null
  actualMileage: number | null
  expectedMileage: number | null
  variancePercent: number | null
}
