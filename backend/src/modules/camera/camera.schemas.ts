import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const cameraProjectQuerySchema = z.object({
  projectId: uuidSchema,
})

export const cameraWishlistCreateSchema = z.object({
  projectId: uuidSchema,
  itemName: z.string().trim().min(2).max(160),
  category: z.enum(['camera', 'lighting', 'grip']),
  vendorName: z.string().trim().max(160).optional(),
  estimatedRate: z.coerce.number().min(0).max(100000000).optional(),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
})

export const cameraWishlistUpdateSchema = cameraWishlistCreateSchema.partial().extend({
  projectId: uuidSchema,
})

export const cameraRequestCreateSchema = z.object({
  projectId: uuidSchema,
  itemName: z.string().trim().min(2).max(160),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  notes: z.string().trim().max(1000).optional(),
})

export const cameraRequestUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['pending_dop', 'pending_producer', 'approved', 'rejected']),
  notes: z.string().trim().max(1000).optional(),
})

export const cameraScanSchema = z.object({
  projectId: uuidSchema,
  assetName: z.string().trim().min(1).max(160),
  assetId: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export const cameraDamageCreateSchema = z.object({
  projectId: uuidSchema,
  assetName: z.string().trim().min(1).max(160),
  assetId: z.string().trim().max(160).optional(),
  issueType: z.enum(['damaged', 'lost', 'received_damaged']),
  imageUrl: z.string().trim().url().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type CameraProjectQuery = z.infer<typeof cameraProjectQuerySchema>
export type CameraWishlistCreateInput = z.infer<typeof cameraWishlistCreateSchema>
export type CameraWishlistUpdateInput = z.infer<typeof cameraWishlistUpdateSchema>
export type CameraRequestCreateInput = z.infer<typeof cameraRequestCreateSchema>
export type CameraRequestUpdateInput = z.infer<typeof cameraRequestUpdateSchema>
export type CameraScanInput = z.infer<typeof cameraScanSchema>
export type CameraDamageCreateInput = z.infer<typeof cameraDamageCreateSchema>
