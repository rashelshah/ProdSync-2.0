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
    console.log('[transport][fuel][list] route hit', { query: req.query })

    if (!req.query.projectId) {
      return res.status(400).json({ error: 'Missing projectId' })
    }

    const query = fuelListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const logs = await listFuelLogsForActor(query, req.authUser?.id ?? null, roles)

    if (!logs || !Array.isArray(logs.data)) {
      return res.status(200).json(getEmptyFuelLogsResponse(req))
    }

    console.log('[transport][fuel][list] db result', { projectId: query.projectId, count: logs.data.length })
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
  console.log('[transport][fuel][create] route hit', { body: req.body, files: Object.keys((req.files as Record<string, unknown> | undefined) ?? {}) })
  const payload = fuelCreateBodySchema.parse(req.body)
  const roles = getTransportAccessRoles(req)
  const fuelLog = await createFuelLog({
    body: payload,
    actorUserId: req.authUser?.id ?? '',
    isDriver: roles.has('DRIVER'),
    files: req.files as Parameters<typeof createFuelLog>[0]['files'],
  })
  console.log('[transport][fuel][create] db result', { fuelLogId: fuelLog.id, projectId: fuelLog.projectId })

  res.status(201).json({ fuelLog })
}

export async function reviewFuelLogController(req: Request, res: Response) {
  console.log('[transport][fuel][review] route hit', { id: req.params.id, body: req.body })
  const payload = fuelReviewSchema.parse(req.body)
  const fuelLog = await reviewFuelLog(String(req.params.id ?? ''), payload, req.authUser?.id ?? '')
  console.log('[transport][fuel][review] db result', { fuelLogId: fuelLog.id, projectId: fuelLog.projectId })

  res.json({ fuelLog })
}

export async function validateFuelOdometerController(req: Request, res: Response) {
  console.log('[transport][fuel][ocr] route hit', { body: req.body })
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
