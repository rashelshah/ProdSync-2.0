import { Router } from 'express'
import { adminClient } from '../../config/supabaseClient'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { roleMiddleware } from '../../middleware/role.middleware'
import { HttpError } from '../../utils/httpError'

export const requestsRouter = Router()

interface ApprovalRow {
  id: string
  type: string
  department: string
  requested_by: string
  request_title: string
  request_description: string | null
  amount: number | string | null
  priority: 'normal' | 'high' | 'emergency'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  submitted_at: string
  approved_at: string | null
  rejected_at: string | null
}

interface ApprovalActionRow {
  approval_id: string
  action: 'submitted' | 'approved' | 'rejected' | 'cancelled'
  actor_id: string | null
  note: string | null
  created_at: string
}

interface UserRow {
  id: string
  full_name: string | null
  role: string | null
}

function formatDepartment(value: string | null | undefined) {
  if (!value) {
    return 'Production'
  }

  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function makeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

async function getUserMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>()
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, role')
    .in('id', userIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map(row => [String(row.id), row as UserRow]))
}

async function getApprovalsForProject(projectId: string) {
  const { data, error } = await adminClient
    .from('approvals')
    .select('id, type, department, requested_by, request_title, request_description, amount, priority, status, submitted_at, approved_at, rejected_at')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ApprovalRow[]
}

requestsRouter.get('/:projectId', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    console.log('[requests][pending][list] route hit', { projectId })

    const approvals = await getApprovalsForProject(projectId)
    const pendingApprovals = approvals.filter(row => row.status === 'pending')
    const userMap = await getUserMap(Array.from(new Set(pendingApprovals.map(row => row.requested_by))))

    const requests = pendingApprovals.map(row => {
      const requester = userMap.get(row.requested_by)
      const requesterName = requester?.full_name ?? 'Requester'
      return {
        id: row.id,
        type: row.request_title || row.type,
        department: formatDepartment(row.department),
        requestedBy: requesterName,
        requestedByInitials: makeInitials(requesterName || 'R'),
        amountINR: Number(row.amount ?? 0),
        timestamp: row.submitted_at,
        status: row.status,
        priority: row.priority,
        notes: row.request_description ?? undefined,
      }
    })

    console.log('[requests][pending][list] db result', { projectId, count: requests.length })
    res.json({ requests })
  } catch (error) {
    next(error)
  }
})

requestsRouter.get('/:projectId/history', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    console.log('[requests][history][list] route hit', { projectId })

    const [{ data: actionsData, error: actionsError }, approvals] = await Promise.all([
      adminClient
        .from('approval_actions')
        .select('approval_id, action, actor_id, note, created_at')
        .eq('project_id', projectId)
        .in('action', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(25),
      getApprovalsForProject(projectId),
    ])

    if (actionsError) {
      throw actionsError
    }

    const typedActions = (actionsData ?? []) as ApprovalActionRow[]
    const userMap = await getUserMap(Array.from(new Set(typedActions.map(row => row.actor_id).filter((value): value is string => Boolean(value)))))
    const approvalMap = new Map(approvals.map(row => [row.id, row]))

    const history = typedActions.map(row => {
      const actor = row.actor_id ? userMap.get(row.actor_id) : null
      const approval = approvalMap.get(row.approval_id)
      return {
        requestId: approval?.request_title ?? row.approval_id,
        approvedBy: actor?.full_name ?? 'ProdSync',
        role: actor?.role ?? 'Approver',
        timestamp: row.created_at,
        auditNote: row.note ?? approval?.request_description ?? '',
        action: row.action === 'rejected' ? 'rejected' : 'approved',
      }
    })

    console.log('[requests][history][list] db result', { projectId, count: history.length })
    res.json({ history })
  } catch (error) {
    next(error)
  }
})

requestsRouter.get('/:projectId/kpis', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    console.log('[requests][kpis] route hit', { projectId })

    const approvals = await getApprovalsForProject(projectId)
    const today = new Date().toISOString().slice(0, 10)
    const completed = approvals.filter(row => row.status === 'approved' || row.status === 'rejected')
    const averageActionTimeMinutes = completed.length === 0
      ? 0
      : Math.round(
          completed.reduce((total, row) => {
            const completedAt = row.approved_at ?? row.rejected_at ?? row.submitted_at
            const deltaMinutes = (new Date(completedAt).getTime() - new Date(row.submitted_at).getTime()) / 60_000
            return total + Math.max(0, deltaMinutes)
          }, 0) / completed.length,
        )

    const kpis = {
      totalPending: approvals.filter(row => row.status === 'pending').length,
      highValue: approvals.filter(
        row => row.status === 'pending' && (row.priority === 'high' || row.priority === 'emergency' || Number(row.amount ?? 0) >= 100000),
      ).length,
      approvedToday: approvals.filter(row => row.status === 'approved' && (row.approved_at ?? '').startsWith(today)).length,
      rejectedToday: approvals.filter(row => row.status === 'rejected' && (row.rejected_at ?? '').startsWith(today)).length,
      pendingValueINR: approvals
        .filter(row => row.status === 'pending')
        .reduce((total, row) => total + Number(row.amount ?? 0), 0),
      avgActionTimeMinutes: averageActionTimeMinutes,
    }

    console.log('[requests][kpis] db result', { projectId, kpis })
    res.json({ kpis })
  } catch (error) {
    next(error)
  }
})

requestsRouter.post('/:projectId/:requestId/approve', authMiddleware, projectAccessMiddleware, roleMiddleware(['EP', 'LINE_PRODUCER']), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    const requestId = String(req.params.requestId ?? '')
    const reviewerId = req.authUser?.id
    console.log('[requests][approve] route hit', { projectId, requestId, reviewerId })

    const { data, error } = await adminClient
      .from('approvals')
      .update({
        status: 'approved',
        approved_by: reviewerId,
        approved_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
      })
      .eq('project_id', projectId)
      .eq('id', requestId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new HttpError(404, 'Approval request not found.')
    }

    console.log('[requests][approve] db result', { projectId, requestId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

requestsRouter.post('/:projectId/:requestId/reject', authMiddleware, projectAccessMiddleware, roleMiddleware(['EP', 'LINE_PRODUCER']), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    const requestId = String(req.params.requestId ?? '')
    const reviewerId = req.authUser?.id
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    console.log('[requests][reject] route hit', { projectId, requestId, reviewerId, hasReason: Boolean(reason) })

    const { data, error } = await adminClient
      .from('approvals')
      .update({
        status: 'rejected',
        approved_by: reviewerId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || 'Rejected from approvals center.',
      })
      .eq('project_id', projectId)
      .eq('id', requestId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new HttpError(404, 'Approval request not found.')
    }

    console.log('[requests][reject] db result', { projectId, requestId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
