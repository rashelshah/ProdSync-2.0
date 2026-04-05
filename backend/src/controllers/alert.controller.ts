import type { Request, Response } from 'express'
import { alertsListQuerySchema } from '../models/transport.schemas'
import { listTransportAlerts } from '../services/alert.service'

export async function getTransportAlertsController(req: Request, res: Response) {
  console.log('[transport][alerts][list] route hit', { query: req.query })
  const query = alertsListQuerySchema.parse(req.query)
  const alerts = await listTransportAlerts(query)
  console.log('[transport][alerts][list] db result', { projectId: query.projectId, count: alerts.data.length })

  res.json(alerts)
}
