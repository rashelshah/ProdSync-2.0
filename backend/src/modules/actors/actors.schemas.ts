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

const callSheetTypeSchema = z.enum(['standard', 'one_and_half', 'double', 'custom'])
const callSheetAssignmentTypeSchema = z.enum(['actor', 'crew'])

const callSheetAssignmentSchema = z.object({
  assignmentType: callSheetAssignmentTypeSchema,
  actorName: z.string().trim().max(160).optional(),
  characterName: z.string().trim().max(160).optional(),
  crewMemberId: uuidSchema.optional(),
  crewName: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  designation: z.string().trim().max(160).optional(),
})

export const callSheetCreateSchema = z.object({
  projectId: uuidSchema,
  shootDate: dateSchema,
  locationId: uuidSchema.optional(),
  location: z.string().trim().max(300).optional(),
  callType: callSheetTypeSchema.default('standard'),
  timeIn: timeSchema,
  timeOut: timeSchema,
  callTime: timeSchema.optional(),
  assignmentType: callSheetAssignmentTypeSchema.optional(),
  assignments: z.array(callSheetAssignmentSchema).max(200).optional(),
  actors: z.array(z.object({
    actorName: z.string().trim().min(1).max(160),
    characterName: z.string().trim().max(160).optional(),
  })).max(200).optional(),
  crew: z.array(z.object({
    crewMemberId: uuidSchema.optional(),
    crewName: z.string().trim().min(1).max(160),
    department: z.string().trim().min(1).max(120),
    designation: z.string().trim().min(1).max(160),
  })).max(200).optional(),
  actorName: z.string().trim().max(160).optional(),
  characterName: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2_000).optional(),
})

export const callSheetUpdateSchema = callSheetCreateSchema.partial().extend({
  projectId: uuidSchema,
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
export type CallSheetUpdateInput = z.infer<typeof callSheetUpdateSchema>
export type ActorLookQueryInput = z.infer<typeof actorLookQuerySchema>
export type ActorLookCreateInput = z.infer<typeof actorLookCreateSchema>
export type ActorPaymentCreateInput = z.infer<typeof actorPaymentCreateSchema>
export type ActorPaymentUpdateInput = z.infer<typeof actorPaymentUpdateSchema>
