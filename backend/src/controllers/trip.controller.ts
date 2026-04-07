import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { tripEndSchema, tripListQuerySchema, tripStartSchema } from '../models/transport.schemas'
import { endTrip, listTripsForActor, startTrip } from '../services/trip.service'
import { getTransportAccessRoles } from '../utils/role'

function getEmptyTripsResponse(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20) || 20))

  return {
    data: [],
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  }
}

export async function getTripsController(req: Request, res: Response) {
  try {
    const query = tripListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const trips = await listTripsForActor(query, req.authUser?.id ?? null, roles)
    return res.json(trips)
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: error.flatten(),
      })
    }

    console.warn('[transport][trips][list] safe fallback', {
      query: req.query,
      userId: req.authUser?.id ?? null,
      error: error instanceof Error ? error.message : error,
    })
    return res.json(getEmptyTripsResponse(req))
  }
}

export async function startTripController(req: Request, res: Response) {
  const payload = tripStartSchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const trip = await startTrip(payload, req.authUser?.id ?? '', roles.has('DRIVER'))

  res.status(201).json({ trip })
}

export async function endTripController(req: Request, res: Response) {
  const payload = tripEndSchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const trip = await endTrip(payload, req.authUser?.id ?? '', roles.has('DRIVER'))

  res.json({ trip })
}
