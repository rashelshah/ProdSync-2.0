import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const artProjectQuerySchema = z.object({
  projectId: uuidSchema,
})

export const artExpenseCreateSchema = z.object({
  projectId: uuidSchema,
  description: z.string().trim().min(2).max(200),
  category: z.enum(['construction', 'props', 'materials', 'misc']),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  manualAmount: z.coerce.number().min(0).max(100000000).optional(),
  amount: z.coerce.number().min(0).max(100000000).optional(),
}).refine(
  payload => payload.manualAmount !== undefined || payload.amount !== undefined,
  {
    path: ['manualAmount'],
    message: 'Manual amount is required.',
  },
).transform(payload => ({
  projectId: payload.projectId,
  description: payload.description,
  category: payload.category,
  quantity: payload.quantity,
  manualAmount: payload.manualAmount ?? payload.amount ?? 0,
}))

export const artPropCreateSchema = z.object({
  projectId: uuidSchema,
  propName: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(120),
  sourcingType: z.enum(['sourced', 'hired']),
  status: z.enum(['in_use', 'in_storage', 'returned', 'missing']).default('in_storage'),
  vendorName: z.string().trim().max(160).optional(),
  returnDueDate: z.string().trim().date().optional(),
})

export const artPropUpdateSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['in_use', 'in_storage', 'returned', 'missing']),
  vendorName: z.string().trim().max(160).optional(),
  returnDueDate: z.string().trim().date().optional(),
})

export const artSetCreateSchema = z.object({
  projectId: uuidSchema,
  setName: z.string().trim().min(2).max(200),
  estimatedCost: z.coerce.number().min(0).max(100000000).default(0),
  actualCost: z.coerce.number().min(0).max(100000000).default(0),
  status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
  progressPercentage: z.coerce.number().int().min(0).max(100).default(0),
})

export const artSetUpdateSchema = z.object({
  projectId: uuidSchema,
  estimatedCost: z.coerce.number().min(0).max(100000000).optional(),
  actualCost: z.coerce.number().min(0).max(100000000).optional(),
  status: z.enum(['planned', 'in_progress', 'completed']).optional(),
  progressPercentage: z.coerce.number().int().min(0).max(100).optional(),
})

export type ArtProjectQuery = z.infer<typeof artProjectQuerySchema>
export type ArtExpenseCreateInput = z.infer<typeof artExpenseCreateSchema>
export type ArtPropCreateInput = z.infer<typeof artPropCreateSchema>
export type ArtPropUpdateInput = z.infer<typeof artPropUpdateSchema>
export type ArtSetCreateInput = z.infer<typeof artSetCreateSchema>
export type ArtSetUpdateInput = z.infer<typeof artSetUpdateSchema>
