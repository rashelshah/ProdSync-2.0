import fs from 'node:fs/promises'
import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { fuelCreateBodySchema, fuelListQuerySchema, fuelOdometerOcrSchema, fuelReviewSchema } from '../models/transport.schemas'
import { createFuelLog, listFuelLogsForActor, reviewFuelLog } from '../services/fuel.service'
import { validateOdometerImage } from '../services/transportOcr.service'
import { getTransportAccessRoles } from '../utils/role'

function getEmptyFuelLogsResponse(req: Request) {
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

export async function getFuelLogsController(req: Request, res: Response) {
  try {
    if (!req.query.projectId) {
      return res.status(400).json({ error: 'Missing projectId' })
    }

    const query = fuelListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const logs = await listFuelLogsForActor(query, req.authUser?.id ?? null, roles)

    if (!logs || !Array.isArray(logs.data)) {
      return res.status(200).json(getEmptyFuelLogsResponse(req))
    }

    res.json(logs)
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: err.flatten(),
      })
    }

    console.error('[transport][fuel][list] falling back to empty response', err)
    return res.status(200).json(getEmptyFuelLogsResponse(req))
  }
}

export async function createFuelLogController(req: Request, res: Response) {
  const payload = fuelCreateBodySchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const fuelLog = await createFuelLog({
    body: payload,
    actorUserId: req.authUser?.id ?? '',
    isDriver: roles.has('DRIVER'),
    files: req.files as Parameters<typeof createFuelLog>[0]['files'],
  })

  res.status(201).json({ fuelLog })
}

export async function reviewFuelLogController(req: Request, res: Response) {
  const payload = fuelReviewSchema.parse(req.body)
  const fuelLog = await reviewFuelLog(String(req.params.id ?? ''), payload, req.authUser?.id ?? '')

  res.json({ fuelLog })
}

export async function validateFuelOdometerController(req: Request, res: Response) {
  const payload = fuelOdometerOcrSchema.parse(req.body)
  const odometerImage = (req.file ?? null) as Express.Multer.File | null

  if (!odometerImage) {
    return res.status(400).json({ error: 'Odometer image is required.' })
  }

  try {
    const validation = await validateOdometerImage({
      file: odometerImage,
      manualOdometerKm: payload.manualOdometerKm ?? null,
    })

    res.json({ validation })
  } finally {
    if (odometerImage.path) {
      await fs.unlink(odometerImage.path).catch(() => undefined)
    }
  }
}
