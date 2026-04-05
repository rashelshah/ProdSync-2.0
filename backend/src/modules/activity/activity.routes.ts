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

function formatWords(value: string | null | undefined) {
  if (!value) {
    return 'Activity'
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const activityRouter = Router()

activityRouter.get('/', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    console.log('[activity][list] route hit', { projectId, query: req.query })

    const { data, error } = await adminClient
      .from('activity_logs')
      .select('id, action, entity, entity_label, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      throw error
    }

    const events = (data ?? []).map(row => {
      const entityLabel = row.entity_label ? String(row.entity_label) : formatWords(String(row.entity))
      const actionLabel = formatWords(String(row.action))
      const module = String(row.entity ?? 'system').split('_')[0] || 'system'

      return {
        id: String(row.id),
        type: String(row.action ?? 'updated'),
        title: `${actionLabel} ${entityLabel}`.trim(),
        description: `${entityLabel} was ${String(row.action ?? 'updated').replace(/_/g, ' ')}.`,
        timestamp: String(row.created_at),
        module,
      }
    })

    console.log('[activity][list] db result', { projectId, count: events.length })
    res.json({ events })
  } catch (error) {
    next(error)
  }
})
