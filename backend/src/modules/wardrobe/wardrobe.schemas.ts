import { z } from 'zod'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format.')
const batchIdSchema = z.string().trim().min(1).max(120)

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      return trimmed
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(Boolean)
    }
  }

  return value
}

export const wardrobeProjectQuerySchema = z.object({
  projectId: uuidSchema,
})

export const wardrobeContinuityQuerySchema = z.object({
  projectId: uuidSchema,
  scene: z.string().trim().max(80).optional(),
  character: z.string().trim().max(120).optional(),
})

export const wardrobeContinuityCreateSchema = z.object({
  projectId: uuidSchema,
  sceneNumber: z.string().trim().min(1).max(80),
  characterName: z.string().trim().min(1).max(120),
  actorName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  costumeId: uuidSchema.optional(),
})

export const wardrobeLaundryCreateSchema = z.object({
  projectId: uuidSchema,
  batchId: batchIdSchema.optional(),
  items: z.preprocess(
    normalizeStringArray,
    z.array(z.string().trim().min(1).max(160)).min(1).max(50),
  ),
  vendorName: z.string().trim().min(1).max(160),
  sentDate: dateSchema,
  expectedReturnDate: dateSchema,
  status: z.enum(['sent', 'in_cleaning', 'returned', 'delayed']).default('sent'),
})

export const wardrobeLaundryUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['sent', 'in_cleaning', 'returned', 'delayed']),
  actualReturnDate: dateSchema.optional(),
})

export const wardrobeInventoryCreateSchema = z.object({
  projectId: uuidSchema,
  costumeName: z.string().trim().min(1).max(160),
  characterName: z.string().trim().max(120).optional(),
  actorName: z.string().trim().max(120).optional(),
  status: z.enum(['on_set', 'in_storage', 'in_laundry', 'missing']).default('in_storage'),
  lastUsedScene: z.string().trim().max(80).optional(),
})

export const wardrobeInventoryUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['on_set', 'in_storage', 'in_laundry', 'missing']),
  lastUsedScene: z.string().trim().max(80).optional(),
})

export const wardrobeAccessoryCreateSchema = z.object({
  projectId: uuidSchema,
  itemName: z.string().trim().min(1).max(160),
  category: z.enum(['jewellery', 'accessory']),
  assignedCharacter: z.string().trim().max(120).optional(),
  status: z.enum(['on_set', 'in_safe', 'in_use', 'missing']).default('in_safe'),
})

export const wardrobeAccessoryUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['on_set', 'in_safe', 'in_use', 'missing']),
  assignedCharacter: z.string().trim().max(120).optional(),
})

export const wardrobeBatchParamSchema = z.object({
  id: batchIdSchema,
})

export type WardrobeContinuityCreateInput = z.infer<typeof wardrobeContinuityCreateSchema>
export type WardrobeContinuityQuery = z.infer<typeof wardrobeContinuityQuerySchema>
export type WardrobeLaundryCreateInput = z.infer<typeof wardrobeLaundryCreateSchema>
export type WardrobeLaundryUpdateInput = z.infer<typeof wardrobeLaundryUpdateSchema>
export type WardrobeInventoryCreateInput = z.infer<typeof wardrobeInventoryCreateSchema>
export type WardrobeInventoryUpdateInput = z.infer<typeof wardrobeInventoryUpdateSchema>
export type WardrobeAccessoryCreateInput = z.infer<typeof wardrobeAccessoryCreateSchema>
export type WardrobeAccessoryUpdateInput = z.infer<typeof wardrobeAccessoryUpdateSchema>
