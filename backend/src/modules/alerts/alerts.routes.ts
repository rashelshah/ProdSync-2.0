import { Router } from 'express'
import { adminClient } from '../../config/supabaseClient'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { HttpError } from '../../utils/httpError'

function requireProjectId(projectId: string | undefined) {
  if (!projectId) {
    throw new HttpError(400, 'Project id is required.')
  }

  return projectId
}

function alertSeverityWeight(severity: string | null | undefined) {
  if (severity === 'critical') return 3
  if (severity === 'warning') return 2
  return 1
}

export const alertsRouter = Router()

alertsRouter.get('/', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    console.log('[alerts][list] route hit', { projectId, query: req.query })

    const { data, error } = await adminClient
      .from('alerts')
      .select('id, source, severity, title, message, status, created_at')
      .eq('project_id', projectId)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    const alerts = (data ?? [])
      .map(row => ({
        id: String(row.id),
        source: String(row.source ?? 'system'),
        severity: String(row.severity ?? 'info'),
        title: String(row.title ?? 'Alert'),
        message: String(row.message ?? ''),
        timestamp: String(row.created_at),
        acknowledged: String(row.status) !== 'open',
      }))
      .sort((left, right) => {
        const severityDelta = alertSeverityWeight(right.severity) - alertSeverityWeight(left.severity)
        if (severityDelta !== 0) {
          return severityDelta
        }

        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      })

    console.log('[alerts][list] db result', { projectId, count: alerts.length })
    res.json({ alerts })
  } catch (error) {
    next(error)
  }
})

alertsRouter.post('/acknowledge-all', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    const userId = req.authUser?.id
    console.log('[alerts][acknowledgeAll] route hit', { projectId, userId })

    const { error } = await adminClient
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('project_id', projectId)
      .eq('status', 'open')

    if (error) {
      throw error
    }

    console.log('[alerts][acknowledgeAll] db result', { projectId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

alertsRouter.post('/:alertId/acknowledge', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    const alertId = String(req.params.alertId ?? '')
    const userId = req.authUser?.id
    console.log('[alerts][acknowledge] route hit', { projectId, alertId, userId })

    const { data, error } = await adminClient
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('project_id', projectId)
      .eq('id', alertId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new HttpError(404, 'Alert not found.')
    }

    console.log('[alerts][acknowledge] db result', { projectId, alertId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
