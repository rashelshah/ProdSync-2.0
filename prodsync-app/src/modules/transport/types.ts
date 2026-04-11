export type VehicleStatus = 'active' | 'idle' | 'maintenance' | 'exception'
export type TripStatus = 'planned' | 'active' | 'completed' | 'flagged' | 'cancelled'
export type AuditStatus = 'verified' | 'mismatch' | 'pending'
export type FraudStatus = 'NORMAL' | 'SUSPICIOUS' | 'FRAUD'
export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface LocationPoint {
  latitude?: number
  longitude?: number
  address?: string
}

export interface Vehicle {
  id: string
  projectId: string
  name: string
  vehicleType: string
  status: VehicleStatus
  registrationNumber: string | null
  capacity: number | null
  assignedDriverUserId: string | null
  assignedDriverName: string | null
  baseLocation: string | null
  notes?: string | null
}

export interface TransportDriver {
  userId: string
  fullName: string
  department: string | null
  role: string | null
}

export interface Trip {
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
  idleMinutes?: number | null
  status: TripStatus
  outstationFlag: boolean
  abnormalityScore: number
  origin?: string | null
  destination?: string | null
  purpose?: string | null
  metadata?: Record<string, unknown>
}

export interface FuelLog {
  id: string
  projectId: string
  vehicleId: string
  vehicleName: string
  tripId: string | null
  loggedBy: string
  loggedByName: string | null
  logDate: string
  liters: number
  cost: number | null
  expectedMileage: number
  actualMileage: number
  auditStatus: AuditStatus
  fraudStatus: FraudStatus
  fraudScore: number
  fraudReason: string | null
  odometerKm?: number | null
  notes?: string | null
  receiptFilePath: string | null
  odometerImagePath: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  approvalNote?: string | null
  metadata?: Record<string, unknown>
}

export interface TransportAlert {
  id: string
  projectId: string
  vehicleId?: string | null
  tripId?: string | null
  fuelLogId?: string | null
  severity: AlertSeverity
  alertType: string
  title: string
  message: string
  status: 'open' | 'acknowledged' | 'resolved'
  triggeredAt: string
  metadata?: Record<string, unknown>
}

export interface GpsLog {
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
}

export interface LiveVehicleLocation {
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
  previousLatitude?: number | null
  previousLongitude?: number | null
  previousCapturedAt?: string | null
  routeCoordinates?: Array<[number, number]>
  routeProvider?: 'mapbox' | 'straight_line' | 'none'
  plannedRouteCoordinates?: Array<[number, number]>
  plannedRouteProvider?: 'mapbox' | 'straight_line' | 'none'
  updateIntervalMs?: number | null
  expectedNextUpdateAt?: string | null
  distanceRemainingKm?: number | null
  trackingMode?: 'short_trip' | 'long_trip' | 'approaching_destination' | 'idle' | 'arrived'
  movingStatus?: 'enroute' | 'approaching_destination' | 'arrived' | 'idle' | 'stale'
}

export interface LiveTrackingMeta {
  mapEnabled: boolean
  provider: 'mapbox' | 'osm'
  mode: 'normal' | 'restricted' | 'disabled' | 'fallback'
  fallback: boolean
  reason?: string | null
  mapboxMode: 'healthy' | 'restricted' | 'disabled'
  mapboxEnabledForAdmin: boolean
  fallbackActive: boolean
}

export interface TripUI extends Trip {
  durationLabel: string
  statusLabel: string
  idleLabel: string
}

export interface FuelLogUI extends FuelLog {
  mismatchPercent: number
  efficiencyRating: 'good' | 'warning' | 'critical'
}

export interface TransportKpis {
  activeVehicles: number
  inTransit: number
  idleVehicles: number
  tripsToday: number
  totalDistanceKm: number
  fuelCost: number
  fuelBurnStatus: 'ok' | 'warning' | 'critical'
}

export interface StartTripInput {
  projectId: string
  vehicleId: string
  driverId?: string
  startLocation: LocationPoint
  destinationLocation?: LocationPoint
  origin?: string
  destination?: string
  purpose?: string
  odometerKm?: number
}

export interface EndTripInput {
  projectId: string
  tripId: string
  endLocation: LocationPoint
  odometerKm: number
  destination?: string
  remarks?: string
}

export interface CreateVehicleInput {
  projectId: string
  name: string
  vehicleType: string
  registrationNumber?: string
  status?: VehicleStatus
  capacity?: number
  assignedDriverUserId?: string | null
  baseLocation?: string
  notes?: string
}

export interface UpdateVehicleInput {
  projectId: string
  name?: string
  vehicleType?: string
  registrationNumber?: string
  status?: VehicleStatus
  capacity?: number
  assignedDriverUserId?: string | null
  baseLocation?: string
  notes?: string
}

export interface FuelLogInput {
  projectId: string
  vehicleId: string
  tripId?: string
  liters: number
  cost?: number
  odometerKm?: number
  fuelType?: string
  expectedMileage?: number
  notes?: string
  receiptImage: File
  odometerImage: File
}

export interface OdometerValidation {
  success: boolean
  text: string
  previewText: string
  extractedOdometerKm: number | null
  manualOdometerKm: number | null
  deltaKm: number | null
  marginKm: number
  withinMargin: boolean | null
  flagged: boolean
  errorMessage: string | null
  extractionSource: 'tesseract'
}

export interface ReviewFuelInput {
  projectId: string
  auditStatus: 'verified' | 'mismatch'
  approvalNote?: string
}

export interface LiveTrackingMapOptions {
  width?: number
  height?: number
}

export interface TripFilters {
  vehicleId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  status?: TripStatus | ''
}
