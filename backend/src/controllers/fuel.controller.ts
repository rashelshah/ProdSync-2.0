import type { Request, Response } from 'express'
import { fuelCreateBodySchema, fuelListQuerySchema, fuelReviewSchema } from '../models/transport.schemas'
import { createFuelLog, listFuelLogsForActor, reviewFuelLog } from '../services/fuel.service'
import { getTransportAccessRoles } from '../utils/role'

export async function getFuelLogsController(req: Request, res: Response) {
  try {
    console.log('[transport][fuel][list] route hit', { query: req.query })
    
    // Validate projectId
    if (!req.query.projectId) {
      return res.status(400).json({ error: "Missing projectId" })
    }

    const query = fuelListQuerySchema.parse(req.query)
    const roles = getTransportAccessRoles(req)
    const logs = await listFuelLogsForActor(query, req.authUser?.id ?? null, roles)
    
    // Ensure we always return an array if valid but no data
    if (!logs || !logs.data) {
      return res.status(200).json({ data: [], metadata: { total: 0, page: 1, pageSize: 50, totalPages: 0 } })
    }

    console.log('[transport][fuel][list] db result', { projectId: query.projectId, count: logs.data.length })
    res.json(logs)
  } catch (err) {
    console.error('[transport][fuel][list] Error:', err)
    return res.status(500).json({ error: "Failed to fetch fuel data" })
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
