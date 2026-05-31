import { z } from 'zod'

const mealPeriodValues = ['breakfast', 'lunch', 'dinner', 'snacks'] as const
const invoiceStatusValues = ['draft', 'submitted', 'approved', 'rejected', 'paid'] as const

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

function optionalNumber(min?: number) {
  let schema = z.coerce.number()
  if (typeof min === 'number') schema = schema.min(min)
  return z.preprocess(value => value === '' || value == null ? undefined : value, schema.optional())
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date.')
const optionalIsoDateSchema = z.preprocess(
  value => typeof value === 'string' ? value.trim() || undefined : value,
  isoDateSchema.optional(),
)

export const foodBeveragesProjectQuerySchema = z.object({
  projectId: z.string().uuid(),
})

export const foodBeverageVendorSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  category: optionalText(120),
  contactName: optionalText(160),
  email: optionalText(160),
  phone: optionalText(80),
  paymentTerms: optionalText(200),
  notes: optionalText(2_000),
  active: optionalBoolean().default(true),
})

export const foodBeverageForecastSchema = z.object({
  projectId: z.string().uuid(),
  forecastDate: isoDateSchema,
  department: z.string().trim().min(2).max(120),
  mealCount: z.coerce.number().int().min(0).max(100_000),
  mealPeriod: z.enum(mealPeriodValues).nullable().optional(),
  notes: optionalText(2_000),
})

export const foodBeverageMealLogSchema = z.object({
  projectId: z.string().uuid(),
  mealDate: isoDateSchema,
  department: z.string().trim().min(2).max(120),
  mealPeriod: z.enum(mealPeriodValues),
  mealsServed: z.coerce.number().int().min(0).max(100_000),
  wasteCount: z.coerce.number().int().min(0).max(100_000).default(0),
  vendorId: z.string().uuid().nullable().optional(),
  notes: optionalText(2_000),
})

export const foodBeverageDietaryProfileSchema = z.object({
  projectId: z.string().uuid(),
  department: z.string().trim().min(2).max(120),
  vegetarianCount: z.coerce.number().int().min(0).max(100_000).default(0),
  veganCount: z.coerce.number().int().min(0).max(100_000).default(0),
  jainCount: z.coerce.number().int().min(0).max(100_000).default(0),
  glutenFreeCount: z.coerce.number().int().min(0).max(100_000).default(0),
  allergenNotes: optionalText(2_000),
  contactName: optionalText(160),
  contactPhone: optionalText(80),
  notes: optionalText(2_000),
})

const invoiceBaseSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().trim().min(1).max(120),
  invoiceDate: isoDateSchema,
  amount: z.coerce.number().min(0).max(1_000_000_000),
  currencyCode: z.preprocess(
    value => typeof value === 'string' ? value.trim().toUpperCase() || 'INR' : value,
    z.string().min(3).max(8).default('INR'),
  ),
  approvalRequested: optionalBoolean().default(false),
  status: z.enum(invoiceStatusValues).default('submitted'),
  notes: optionalText(2_000),
})

export const createFoodBeverageInvoiceSchema = invoiceBaseSchema

export const updateFoodBeverageInvoiceSchema = invoiceBaseSchema.partial().extend({
  projectId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(120).optional(),
  invoiceDate: optionalIsoDateSchema,
  amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  currencyCode: z.preprocess(
    value => typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
    z.string().min(3).max(8).optional(),
  ),
})

export const foodBeverageVendorListQuerySchema = foodBeveragesProjectQuerySchema.extend({
  active: z.preprocess(
    value => typeof value === 'string' ? (value === 'true' ? true : value === 'false' ? false : undefined) : value,
    z.boolean().optional(),
  ),
})

export const foodBeverageForecastListQuerySchema = foodBeveragesProjectQuerySchema.extend({
  date: optionalIsoDateSchema,
  department: optionalText(120),
})

export const foodBeverageMealLogListQuerySchema = foodBeveragesProjectQuerySchema.extend({
  date: optionalIsoDateSchema,
})

export const foodBeverageTimelineQuerySchema = foodBeveragesProjectQuerySchema
export const foodBeverageAnalyticsQuerySchema = foodBeveragesProjectQuerySchema
export const foodBeverageOverviewQuerySchema = foodBeveragesProjectQuerySchema
export const foodBeverageDietaryListQuerySchema = foodBeveragesProjectQuerySchema.extend({
  department: optionalText(120),
})
export const foodBeverageInvoiceListQuerySchema = foodBeveragesProjectQuerySchema.extend({
  status: z.enum(invoiceStatusValues).optional(),
})

export type FoodBeverageVendorInput = z.infer<typeof foodBeverageVendorSchema>
export type FoodBeverageForecastInput = z.infer<typeof foodBeverageForecastSchema>
export type FoodBeverageMealLogInput = z.infer<typeof foodBeverageMealLogSchema>
export type FoodBeverageDietaryProfileInput = z.infer<typeof foodBeverageDietaryProfileSchema>
export type FoodBeverageInvoiceInput = z.infer<typeof createFoodBeverageInvoiceSchema>
