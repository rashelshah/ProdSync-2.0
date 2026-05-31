import { z } from 'zod'

const locationTypeValues = ['government', 'private', 'studio', 'outdoor', 'indoor'] as const
const riskLevelValues = ['low', 'medium', 'high'] as const
const statusValues = ['draft', 'recce_complete', 'permissions_pending', 'shoot_ready', 'completed'] as const
const permissionTypeValues = [
  'police_permission',
  'corporation_approval',
  'traffic_department',
  'fire_department',
  'private_owner_agreement',
  'environmental_clearance',
  'custom',
] as const
const permissionStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'expired'] as const
const amenityTypeValues = ['hospital', 'police_station', 'petrol_bunk'] as const
const timelineEventValues = [
  'location_created',
  'recce_completed',
  'permission_submitted',
  'permission_approved',
  'shoot_started',
  'shoot_completed',
  'status_changed',
  'upload_added',
  'upload_deleted',
  'document_uploaded',
  'document_deleted',
  'custom',
] as const
const costTypeValues = ['rent', 'permit_fee', 'security_fee', 'other'] as const

function optionalText(max: number) {
  return z.preprocess(
    value => typeof value === 'string' ? value.trim() || undefined : value,
    z.string().max(max).optional(),
  )
}

function nullableText(max: number) {
  return z.preprocess(
    value => typeof value === 'string' ? value.trim() || null : value ?? null,
    z.string().max(max).nullable(),
  )
}

function optionalNumber(min?: number, max?: number) {
  let schema = z.coerce.number()
  if (typeof min === 'number') schema = schema.min(min)
  if (typeof max === 'number') schema = schema.max(max)
  return z.preprocess(
    value => value === '' || value == null ? undefined : value,
    schema.optional(),
  )
}

function optionalBoolean() {
  return z.preprocess(value => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1') return true
      if (normalized === 'false' || normalized === '0') return false
    }
    return value
  }, z.boolean().optional())
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date.')
const optionalIsoDateSchema = z.preprocess(
  value => typeof value === 'string' ? value.trim() || undefined : value,
  isoDateSchema.optional(),
)

export const locationsProjectQuerySchema = z.object({
  projectId: z.string().uuid(),
})

export const locationsListQuerySchema = locationsProjectQuerySchema.extend({
  search: optionalText(160),
  status: z.enum(statusValues).optional(),
  riskLevel: z.enum(riskLevelValues).optional(),
  locationType: z.enum(locationTypeValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

export const createLocationSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(500),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  locationType: z.enum(locationTypeValues),
  shootStartDate: optionalIsoDateSchema,
  shootEndDate: optionalIsoDateSchema,
  riskLevel: z.enum(riskLevelValues).default('medium'),
  status: z.enum(statusValues).default('draft'),
  notes: optionalText(2_000),
}).refine(input => {
  if (!input.shootStartDate || !input.shootEndDate) return true
  return input.shootEndDate >= input.shootStartDate
}, {
  message: 'Shoot end date cannot be before shoot start date.',
  path: ['shootEndDate'],
})

export const updateLocationSchema = z.object({
  projectId: z.string().uuid(),
  name: optionalText(160),
  address: optionalText(500),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  locationType: z.enum(locationTypeValues).optional(),
  shootStartDate: optionalIsoDateSchema,
  shootEndDate: optionalIsoDateSchema,
  riskLevel: z.enum(riskLevelValues).optional(),
  status: z.enum(statusValues).optional(),
  notes: optionalText(2_000),
}).refine(input => {
  if (!input.shootStartDate || !input.shootEndDate) return true
  return input.shootEndDate >= input.shootStartDate
}, {
  message: 'Shoot end date cannot be before shoot start date.',
  path: ['shootEndDate'],
})

const locationPermissionBaseSchema = z.object({
  projectId: z.string().uuid(),
  permissionType: z.enum(permissionTypeValues),
  customLabel: optionalText(160),
  authorityName: optionalText(160),
  authorityContact: optionalText(120),
  status: z.enum(permissionStatusValues).default('pending'),
  issueDate: optionalIsoDateSchema,
  expiryDate: optionalIsoDateSchema,
  notes: optionalText(2_000),
})

export const createLocationPermissionSchema = locationPermissionBaseSchema.refine(input => {
  if (input.permissionType !== 'custom') return true
  return Boolean(input.customLabel)
}, {
  message: 'Custom permissions require a label.',
  path: ['customLabel'],
}).refine(input => {
  if (!input.issueDate || !input.expiryDate) return true
  return input.expiryDate >= input.issueDate
}, {
  message: 'Expiry date cannot be before issue date.',
  path: ['expiryDate'],
})

export const updateLocationPermissionSchema = locationPermissionBaseSchema.partial().extend({
  projectId: z.string().uuid(),
}).refine(input => {
  if (input.permissionType !== 'custom') return true
  return Boolean(input.customLabel)
}, {
  message: 'Custom permissions require a label.',
  path: ['customLabel'],
}).refine(input => {
  if (!input.issueDate || !input.expiryDate) return true
  return input.expiryDate >= input.issueDate
}, {
  message: 'Expiry date cannot be before issue date.',
  path: ['expiryDate'],
})

export const upsertLocationAmenitySchema = z.object({
  projectId: z.string().uuid(),
  amenityType: z.enum(amenityTypeValues),
  name: nullableText(160),
  address: nullableText(500),
  phoneNumber: nullableText(80),
  distanceKm: optionalNumber(0),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  mapLink: nullableText(500),
  source: z.enum(['manual', 'mapbox']).default('manual'),
})

export const createLocationTimelineSchema = z.object({
  projectId: z.string().uuid(),
  eventType: z.enum(timelineEventValues).default('custom'),
  title: z.string().trim().min(1).max(160),
  description: optionalText(2_000),
  eventAt: z.preprocess(
    value => typeof value === 'string' ? value.trim() || undefined : value,
    z.string().datetime().optional(),
  ),
})

export const createLocationCommentSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().trim().min(1).max(2_000),
})

export const locationMediaUploadSchema = z.object({
  projectId: z.string().uuid(),
  notes: optionalText(2_000),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  uploadTime: z.preprocess(
    value => typeof value === 'string' ? value.trim() || undefined : value,
    z.string().datetime().optional(),
  ),
})

export const locationDocumentUploadSchema = z.object({
  projectId: z.string().uuid(),
  category: z.preprocess(
    value => typeof value === 'string' ? value.trim() || 'other' : value,
    z.string().min(1).max(80),
  ),
  permissionId: z.preprocess(
    value => typeof value === 'string' ? value.trim() || undefined : value,
    z.string().uuid().optional(),
  ),
  notes: optionalText(2_000),
})

export const createLocationCostSchema = z.object({
  projectId: z.string().uuid(),
  costType: z.enum(costTypeValues),
  label: optionalText(160),
  amount: z.coerce.number().min(0),
  currencyCode: z.preprocess(
    value => typeof value === 'string' ? value.trim().toUpperCase() || 'INR' : value,
    z.string().min(3).max(8).default('INR'),
  ),
  approvalRequested: optionalBoolean().default(false),
  notes: optionalText(2_000),
})

export const updateLocationCostSchema = createLocationCostSchema.partial().extend({
  projectId: z.string().uuid(),
})

export const locationMediaListQuerySchema = locationsProjectQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(18),
})

export const locationDocumentListQuerySchema = locationsProjectQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(18),
})

export type LocationsListQuery = z.infer<typeof locationsListQuerySchema>
export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
export type CreateLocationPermissionInput = z.infer<typeof createLocationPermissionSchema>
export type UpdateLocationPermissionInput = z.infer<typeof updateLocationPermissionSchema>
export type UpsertLocationAmenityInput = z.infer<typeof upsertLocationAmenitySchema>
export type CreateLocationTimelineInput = z.infer<typeof createLocationTimelineSchema>
export type CreateLocationCommentInput = z.infer<typeof createLocationCommentSchema>
export type LocationMediaUploadInput = z.infer<typeof locationMediaUploadSchema>
export type LocationDocumentUploadInput = z.infer<typeof locationDocumentUploadSchema>
export type CreateLocationCostInput = z.infer<typeof createLocationCostSchema>
export type UpdateLocationCostInput = z.infer<typeof updateLocationCostSchema>
