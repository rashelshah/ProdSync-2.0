import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().trim().max(300).optional(),
})
  .refine(value => (value.latitude == null && value.longitude == null) || (value.latitude != null && value.longitude != null), {
    message: 'Latitude and longitude must both be provided when using GPS coordinates.',
    path: ['latitude'],
  })
  .refine(value => (value.latitude != null && value.longitude != null) || Boolean(value.address?.trim()), {
    message: 'Either GPS coordinates or an address is required.',
    path: ['address'],
  })

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const vehicleListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
  status: z.enum(['active', 'idle', 'maintenance', 'exception']).optional(),
})

export const vehicleDriversQuerySchema = z.object({
  projectId: uuidSchema,
})

export const vehicleCreateSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  vehicleType: z.string().trim().min(2).max(80),
  registrationNumber: z.string().trim().max(50).optional(),
  status: z.enum(['active', 'idle', 'maintenance', 'exception']).default('active'),
  capacity: z.number().int().min(0).max(500).optional(),
  assignedDriverUserId: uuidSchema.optional().nullable(),
  gpsDeviceId: z.string().trim().max(120).optional(),
  baseLocation: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export const vehicleUpdateSchema = vehicleCreateSchema.partial().extend({
  projectId: uuidSchema,
})

export const tripListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
  status: z.enum(['planned', 'active', 'completed', 'flagged', 'cancelled']).optional(),
  vehicleId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
})

export const tripStartSchema = z.object({
  projectId: uuidSchema,
  vehicleId: uuidSchema,
  driverId: uuidSchema.optional(),
  startTime: z.string().datetime().optional(),
  startLocation: locationSchema,
  destinationLocation: locationSchema.optional(),
  origin: z.string().trim().max(200).optional(),
  destination: z.string().trim().max(200).optional(),
  purpose: z.string().trim().max(500).optional(),
  callSheetReference: z.string().trim().max(120).optional(),
  odometerKm: z.number().min(0).max(10000000).optional(),
})

export const tripEndSchema = z.object({
  projectId: uuidSchema,
  tripId: uuidSchema,
  endTime: z.string().datetime().optional(),
  endLocation: locationSchema,
  odometerKm: z.number().min(0).max(10000000),
  destination: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(500).optional(),
})

export const locationReverseGeocodeQuerySchema = z.object({
  projectId: uuidSchema,
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
})
  .refine(value => value.lat != null || value.latitude != null, {
    message: 'Latitude is required.',
    path: ['lat'],
  })
  .refine(value => value.lng != null || value.longitude != null, {
    message: 'Longitude is required.',
    path: ['lng'],
  })
  .transform(value => ({
    projectId: value.projectId,
    latitude: value.latitude ?? value.lat ?? 0,
    longitude: value.longitude ?? value.lng ?? 0,
  }))

export const locationSearchQuerySchema = z.object({
  projectId: uuidSchema,
  q: z.string().trim().min(2).max(200).optional(),
  query: z.string().trim().min(2).max(200).optional(),
})
  .refine(value => Boolean(value.q ?? value.query), {
    message: 'Search query is required.',
    path: ['q'],
  })
  .transform(value => ({
    projectId: value.projectId,
    query: value.query ?? value.q ?? '',
  }))

export const trackingLiveQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
})

export const trackingMapQuerySchema = z.object({
  projectId: uuidSchema,
  width: z.coerce.number().int().min(320).max(1600).default(1080),
  height: z.coerce.number().int().min(200).max(900).default(420),
})

export const liveLocationUpdateSchema = z.object({
  projectId: uuidSchema,
  vehicleId: uuidSchema,
  tripId: uuidSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKph: z.number().min(0).max(300).optional().nullable(),
  heading: z.number().min(0).max(360).optional().nullable(),
  accuracyMeters: z.number().min(0).max(5000).optional().nullable(),
  capturedAt: z.string().datetime().optional(),
})

export const fuelListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
  auditStatus: z.enum(['verified', 'mismatch', 'pending']).optional(),
  vehicleId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
})

export const fuelCreateBodySchema = z.object({
  projectId: uuidSchema,
  vehicleId: uuidSchema,
  tripId: uuidSchema.optional(),
  logDate: z.string().date().optional(),
  fuelType: z.string().trim().min(2).max(50).default('diesel'),
  liters: z.coerce.number().positive().max(10000),
  cost: z.coerce.number().min(0).max(100000000).optional(),
  currencyCode: z.string().trim().min(3).max(8).default('USD'),
  odometerKm: z.coerce.number().min(0).max(10000000).optional(),
  expectedMileage: z.coerce.number().positive().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export const fuelReviewSchema = z.object({
  projectId: uuidSchema,
  auditStatus: z.enum(['verified', 'mismatch']),
  approvalNote: z.string().trim().max(500).optional(),
})

export const fuelOdometerOcrSchema = z.object({
  projectId: uuidSchema,
  manualOdometerKm: z.coerce.number().min(0).max(10000000).optional(),
})

export const alertsListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
})

export const gpsLogsListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema,
  tripId: uuidSchema.optional(),
  vehicleId: uuidSchema.optional(),
})

export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>
export type VehicleDriversQuery = z.infer<typeof vehicleDriversQuerySchema>
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>
export type TripListQuery = z.infer<typeof tripListQuerySchema>
export type TripStartInput = z.infer<typeof tripStartSchema>
export type TripEndInput = z.infer<typeof tripEndSchema>
export type LocationReverseGeocodeQuery = z.infer<typeof locationReverseGeocodeQuerySchema>
export type LocationSearchQuery = z.infer<typeof locationSearchQuerySchema>
export type TrackingLiveQuery = z.infer<typeof trackingLiveQuerySchema>
export type TrackingMapQuery = z.infer<typeof trackingMapQuerySchema>
export type LiveLocationUpdateInput = z.infer<typeof liveLocationUpdateSchema>
export type FuelListQuery = z.infer<typeof fuelListQuerySchema>
export type FuelCreateBodyInput = z.infer<typeof fuelCreateBodySchema>
export type FuelReviewInput = z.infer<typeof fuelReviewSchema>
export type FuelOdometerOcrInput = z.infer<typeof fuelOdometerOcrSchema>
export type AlertsListQuery = z.infer<typeof alertsListQuerySchema>
export type GpsLogsListQuery = z.infer<typeof gpsLogsListQuerySchema>
