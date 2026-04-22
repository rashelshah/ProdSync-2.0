import { z } from 'zod'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format.')
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Expected time in HH:MM format.')

export const actorsProjectQuerySchema = z.object({
  projectId: uuidSchema,
})

export const juniorArtistQuerySchema = actorsProjectQuerySchema.extend({
  shootDate: dateSchema.optional(),
})

export const juniorArtistCreateSchema = z.object({
  projectId: uuidSchema,
  shootDate: dateSchema,
  agentName: z.string().trim().min(1).max(160),
  numberOfArtists: z.coerce.number().int().min(0).max(10_000),
  ratePerArtist: z.coerce.number().min(0).max(1_000_000),
})

export const actorRecordParamSchema = z.object({
  id: uuidSchema,
})

export const callSheetCreateSchema = z.object({
  projectId: uuidSchema,
  shootDate: dateSchema,
  location: z.string().trim().min(1).max(300),
  callTime: timeSchema,
  actorName: z.string().trim().min(1).max(160),
  characterName: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2_000).optional(),
})

export const actorLookQuerySchema = actorsProjectQuerySchema.extend({
  actor: z.string().trim().max(160).optional(),
  character: z.string().trim().max(160).optional(),
})

export const actorLookCreateSchema = z.object({
  projectId: uuidSchema,
  actorName: z.string().trim().min(1).max(160),
  characterName: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2_000).optional(),
})

export const actorPaymentCreateSchema = z.object({
  projectId: uuidSchema,
  actorName: z.string().trim().min(1).max(160),
  paymentType: z.enum(['batta', 'remuneration']),
  amount: z.coerce.number().min(0).max(1_000_000_000),
  paymentDate: dateSchema,
  status: z.enum(['pending', 'paid']).default('pending'),
})

export const actorPaymentUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['pending', 'paid']),
})

export type JuniorArtistCreateInput = z.infer<typeof juniorArtistCreateSchema>
export type JuniorArtistQueryInput = z.infer<typeof juniorArtistQuerySchema>
export type CallSheetCreateInput = z.infer<typeof callSheetCreateSchema>
export type ActorLookQueryInput = z.infer<typeof actorLookQuerySchema>
export type ActorLookCreateInput = z.infer<typeof actorLookCreateSchema>
export type ActorPaymentCreateInput = z.infer<typeof actorPaymentCreateSchema>
export type ActorPaymentUpdateInput = z.infer<typeof actorPaymentUpdateSchema>
