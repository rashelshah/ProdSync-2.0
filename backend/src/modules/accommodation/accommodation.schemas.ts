import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const accommodationProjectQuerySchema = z.object({
  projectId: uuidSchema,
})

export const hotelCreateSchema = z.object({
  projectId: uuidSchema,
  hotelName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().max(160).optional(),
  contactNumber: z.string().trim().max(40).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
})

export const hotelUpdateSchema = hotelCreateSchema.partial().extend({
  projectId: uuidSchema,
})

export const allocationCreateSchema = z.object({
  projectId: uuidSchema,
  personName: z.string().trim().min(1).max(160),
  roleTitle: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  hotelName: z.string().trim().min(1).max(160),
  roomNumber: z.string().trim().min(1).max(80),
  checkInDate: z.string().trim().min(10).max(40),
  checkOutDate: z.string().trim().min(10).max(40),
  bookingStatus: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).default('confirmed'),
  notes: z.string().trim().max(2000).optional(),
})

export const allocationUpdateSchema = allocationCreateSchema.partial().extend({
  projectId: uuidSchema,
})

export type AccommodationProjectQuery = z.infer<typeof accommodationProjectQuerySchema>
export type HotelCreateInput = z.infer<typeof hotelCreateSchema>
export type HotelUpdateInput = z.infer<typeof hotelUpdateSchema>
export type AllocationCreateInput = z.infer<typeof allocationCreateSchema>
export type AllocationUpdateInput = z.infer<typeof allocationUpdateSchema>
