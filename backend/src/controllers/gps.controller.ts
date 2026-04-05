import type { Request, Response } from 'express'
import { gpsLogsListQuerySchema } from '../models/transport.schemas'
import { listGpsLogs } from '../services/gps.service'

export async function getGpsLogsController(req: Request, res: Response) {
  console.log('[transport][gps][list] route hit', { query: req.query })
  const query = gpsLogsListQuerySchema.parse(req.query)
  const logs = await listGpsLogs(query)
  console.log('[transport][gps][list] db result', { projectId: query.projectId, count: logs.data.length })

  res.json(logs)
}
