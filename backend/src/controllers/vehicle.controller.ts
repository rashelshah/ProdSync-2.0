import type { Request, Response } from 'express'
import { vehicleCreateSchema, vehicleDriversQuerySchema, vehicleListQuerySchema, vehicleUpdateSchema } from '../models/transport.schemas'
import { createVehicle, listAssignableDrivers, listVehiclesForActor, updateVehicle } from '../services/vehicle.service'
import { getTransportAccessRoles } from '../utils/role'

export async function getVehiclesController(req: Request, res: Response) {
  console.log('[transport][vehicles][list] route hit', { query: req.query })
  const query = vehicleListQuerySchema.parse(req.query)
  const roles = getTransportAccessRoles(req)
  const vehicles = await listVehiclesForActor(query, req.authUser?.id ?? null, roles)
  console.log('[transport][vehicles][list] db result', { projectId: query.projectId, count: vehicles.data.length })

  res.json(vehicles)
}

export async function getAssignableDriversController(req: Request, res: Response) {
  try {
    console.log('[transport][vehicles][drivers] route hit', { query: req.query })
    const query = vehicleDriversQuerySchema.parse(req.query)
    const drivers = await listAssignableDrivers(query.projectId)
    console.log('[transport][vehicles][drivers] db result', { projectId: query.projectId, count: drivers.length })

    return res.json({ drivers })
  } catch (error) {
    console.warn('[transport][vehicles][drivers] safe fallback', {
      query: req.query,
      error: error instanceof Error ? error.message : error,
    })
    return res.json({ drivers: [] })
  }
}

export async function createVehicleController(req: Request, res: Response) {
  console.log('[transport][vehicles][create] route hit', { body: req.body })
  const payload = vehicleCreateSchema.parse(req.body)
  const vehicle = await createVehicle(payload)
  console.log('[transport][vehicles][create] db result', { vehicleId: vehicle.id, projectId: vehicle.projectId })

  res.status(201).json({ vehicle })
}

export async function updateVehicleController(req: Request, res: Response) {
  console.log('[transport][vehicles][update] route hit', { id: req.params.id, body: req.body })
  const payload = vehicleUpdateSchema.parse(req.body)
  const vehicle = await updateVehicle(String(req.params.id ?? ''), payload)
  console.log('[transport][vehicles][update] db result', { vehicleId: vehicle.id, projectId: vehicle.projectId })

  res.json({ vehicle })
}
