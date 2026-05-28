import type { Request, Response } from 'express'
import { accommodationProjectQuerySchema, allocationCreateSchema, allocationUpdateSchema, hotelCreateSchema, hotelUpdateSchema } from './accommodation.schemas'
import {
  createAllocation,
  createHotel,
  deleteAllocation,
  getTravelSync,
  listAccommodationAlerts,
  listAllocations,
  listHotels,
  listReminders,
  updateAllocation,
  updateHotel,
} from './accommodation.service'

export async function getHotelsController(_req: Request, res: Response) {
  const projectId = typeof _req.query.projectId === 'string' ? _req.query.projectId : null
  const hotels = await listHotels(projectId)
  res.json({ hotels })
}

export async function createHotelController(req: Request, res: Response) {
  const payload = hotelCreateSchema.parse(req.body)
  const hotel = await createHotel(payload)
  res.status(201).json({ hotel })
}

export async function updateHotelController(req: Request, res: Response) {
  const payload = hotelUpdateSchema.parse(req.body)
  const hotel = await updateHotel(String(req.params.id ?? ''), payload)
  res.json({ hotel })
}

export async function getAllocationsController(req: Request, res: Response) {
  const query = accommodationProjectQuerySchema.parse(req.query)
  const allocations = await listAllocations(query.projectId)
  res.json({ allocations })
}

export async function createAllocationController(req: Request, res: Response) {
  const payload = allocationCreateSchema.parse(req.body)
  const allocation = await createAllocation(payload)
  res.status(201).json({ allocation })
}

export async function updateAllocationController(req: Request, res: Response) {
  const payload = allocationUpdateSchema.parse(req.body)
  const allocation = await updateAllocation(String(req.params.id ?? ''), payload)
  res.json({ allocation })
}

export async function deleteAllocationController(req: Request, res: Response) {
  const query = accommodationProjectQuerySchema.parse(req.query)
  const result = await deleteAllocation(query.projectId, String(req.params.id ?? ''))
  res.json(result)
}

export async function getRemindersController(req: Request, res: Response) {
  const query = accommodationProjectQuerySchema.parse(req.query)
  const reminders = await listReminders(query.projectId)
  res.json({ reminders })
}

export async function getTravelSyncController(req: Request, res: Response) {
  const query = accommodationProjectQuerySchema.parse(req.query)
  const travel = await getTravelSync(query.projectId)
  res.json({ travel })
}

export async function getAccommodationAlertsController(req: Request, res: Response) {
  const query = accommodationProjectQuerySchema.parse(req.query)
  const alerts = await listAccommodationAlerts(query.projectId)
  res.json({ alerts })
}
