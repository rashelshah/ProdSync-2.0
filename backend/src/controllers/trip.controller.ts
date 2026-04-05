import type { Request, Response } from 'express'
import { tripEndSchema, tripListQuerySchema, tripStartSchema } from '../models/transport.schemas'
import { endTrip, listTripsForActor, startTrip } from '../services/trip.service'
import { getTransportAccessRoles } from '../utils/role'

export async function getTripsController(req: Request, res: Response) {
  console.log('[transport][trips][list] route hit', {
    query: req.query,
    user: req.authUser ? { id: req.authUser.id, email: req.authUser.email } : null,
  })

  try {
    const query = tripListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const trips = await listTripsForActor(query, req.authUser?.id ?? null, roles)
    console.log('[transport][trips][list] db result', { projectId: query.projectId, count: trips.data.length })

    res.json(trips)
  } catch (error) {
    console.error('[transport][trips][list] failed', {
      query: req.query,
      userId: req.authUser?.id ?? null,
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

export async function startTripController(req: Request, res: Response) {
  console.log('[transport][trips][start] route hit', { body: req.body })
  const payload = tripStartSchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const trip = await startTrip(payload, req.authUser?.id ?? '', roles.has('DRIVER'))
  console.log('[transport][trips][start] db result', { tripId: trip.id, projectId: trip.projectId })

  res.status(201).json({ trip })
}

export async function endTripController(req: Request, res: Response) {
  console.log('[transport][trips][end] route hit', { body: req.body })
  const payload = tripEndSchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const trip = await endTrip(payload, req.authUser?.id ?? '', roles.has('DRIVER'))
  console.log('[transport][trips][end] db result', { tripId: trip.id, projectId: trip.projectId })

  res.json({ trip })
}
