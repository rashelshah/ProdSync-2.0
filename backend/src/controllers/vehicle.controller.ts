import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { vehicleCreateSchema, vehicleDriversQuerySchema, vehicleListQuerySchema, vehicleUpdateSchema } from '../models/transport.schemas'
import { createVehicle, listAssignableDrivers, listVehiclesForActor, updateVehicle } from '../services/vehicle.service'
import { getTransportAccessRoles } from '../utils/role'

function getEmptyVehiclesResponse(req: Request) {
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

export async function getVehiclesController(req: Request, res: Response) {
  try {
    const query = vehicleListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const vehicles = await listVehiclesForActor(query, req.authUser?.id ?? null, roles)
    return res.json(vehicles)
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: error.flatten(),
      })
    }

    console.warn('[transport][vehicles][list] safe fallback', {
      query: req.query,
      userId: req.authUser?.id ?? null,
      error: error instanceof Error ? error.message : error,
    })
    return res.json(getEmptyVehiclesResponse(req))
  }
}

export async function getAssignableDriversController(req: Request, res: Response) {
  try {
    const query = vehicleDriversQuerySchema.parse(req.query)
    const drivers = await listAssignableDrivers(query.projectId)

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
  const payload = vehicleCreateSchema.parse(req.body)
  const vehicle = await createVehicle(payload)

  res.status(201).json({ vehicle })
}

export async function updateVehicleController(req: Request, res: Response) {
  const payload = vehicleUpdateSchema.parse(req.body)
  const vehicle = await updateVehicle(String(req.params.id ?? ''), payload)

  res.json({ vehicle })
}
