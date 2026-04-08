import { Router, type Request } from 'express'
import { adminClient } from '../../config/supabaseClient'
import { authMiddleware } from '../../middleware/auth.middleware'
import { resolveTransportApprovalDecision } from '../../services/transportApproval.service'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { HttpError } from '../../utils/httpError'
import { resolveArtExpenseApprovalDecision } from '../art/art.service'

export const requestsRouter = Router()

interface ApprovalRow {
  id: string
  project_id: string
  type: string
  department: string
  requested_by: string
  request_title: string
  request_description: string | null
  amount: number | string | null
  priority: 'normal' | 'high' | 'emergency'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  submitted_at: string
  updated_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  approvable_table: string | null
  approvable_id: string | null
  metadata: Record<string, unknown> | null
}

interface UserRow {
  id: string
  full_name: string | null
  role: string | null
}

type PendingWorkflowStatus = 'pending' | 'pending_dop' | 'pending_art_director' | 'pending_producer' | 'approved' | 'rejected'

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeRole(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
}

function canManageApprovals(req: Request) {
  const authRole = normalizeRole(req.authUser?.role)
  const membershipRole = normalizeRole(req.projectAccess?.membershipRole)
  const projectRole = normalizeRole(req.projectAccess?.projectRole)

  return Boolean(
    req.projectAccess?.isOwner
      || authRole === 'EP'
      || authRole === 'LINE_PRODUCER'
      || membershipRole === 'EP'
      || membershipRole === 'LINE_PRODUCER'
      || projectRole === 'EXECUTIVE_PRODUCER'
      || projectRole === 'LINE_PRODUCER'
      || projectRole === 'PRODUCTION_MANAGER',
  )
}

function isCameraApproval(row: ApprovalRow) {
  const metadata = asObject(row.metadata)
  return asString(metadata.cameraModuleType) === 'camera_request' || row.approvable_table === 'camera_requests'
}

function isArtExpenseApproval(row: ApprovalRow) {
  const metadata = asObject(row.metadata)
  return (
    row.approvable_table === 'expenses'
    && (row.department === 'art' || asString(metadata.artModuleType) === 'expense_approval')
  )
}

function canManageArtDirectorExpenseApprovals(req: Request) {
  const authRole = normalizeRole(req.authUser?.role)
  const membershipRole = normalizeRole(req.projectAccess?.membershipRole)
  const projectRole = normalizeRole(req.projectAccess?.projectRole)
  const department = normalizeRole(req.projectAccess?.department)

  return Boolean(
    projectRole === 'ART_DIRECTOR'
      || (department === 'ART' && membershipRole === 'HOD')
      || (department === 'ART' && authRole === 'HOD'),
  )
}

function artExpenseDecision(row: ApprovalRow) {
  if (!isArtExpenseApproval(row)) {
    return null
  }

  const metadata = asObject(row.metadata)
  const decision = asString(metadata.decision)
  return decision === 'approved' || decision === 'rejected' ? decision : null
}

function artExpenseWorkflowStatus(row: ApprovalRow) {
  if (!isArtExpenseApproval(row)) {
    return null
  }

  const metadata = asObject(row.metadata)
  const workflowStatus = asString(metadata.workflowStatus)

  if (workflowStatus === 'pending_art_director' || workflowStatus === 'pending_producer' || workflowStatus === 'approved' || workflowStatus === 'rejected') {
    return workflowStatus
  }

  const decision = artExpenseDecision(row)
  if (decision === 'approved') return 'approved'
  if (decision === 'rejected') return 'rejected'
  return 'pending_producer'
}

function approvalWorkflowStatus(row: ApprovalRow): PendingWorkflowStatus {
  const artStatus = artExpenseWorkflowStatus(row)
  if (artStatus) {
    return artStatus
  }

  if (isCameraApproval(row)) {
    return workflowStatus(row)
  }

  if (row.status === 'approved' || row.status === 'rejected') {
    return row.status
  }

  return 'pending'
}

function workflowStatus(row: ApprovalRow) {
  const metadata = asObject(row.metadata)
  const value = asString(metadata.workflowStatus)

  if (value === 'pending_dop' || value === 'pending_producer' || value === 'approved' || value === 'rejected') {
    return value
  }

  if (row.status === 'approved' || row.status === 'rejected') {
    return row.status
  }

  return 'pending_dop'
}

function isPendingForProducer(row: ApprovalRow) {
  if (isArtExpenseApproval(row)) {
    const artStatus = artExpenseWorkflowStatus(row)
    return row.status === 'pending' && (artStatus === 'pending_art_director' || artStatus === 'pending_producer')
  }

  if (!isCameraApproval(row)) {
    return row.status === 'pending'
  }

  return workflowStatus(row) === 'pending_producer'
}

function canActOnPendingApproval(req: Request, row: ApprovalRow) {
  if (isArtExpenseApproval(row)) {
    const artStatus = artExpenseWorkflowStatus(row)

    if (artStatus === 'pending_art_director') {
      return canManageArtDirectorExpenseApprovals(req)
    }

    if (artStatus === 'pending_producer') {
      return canManageApprovals(req)
    }

    return false
  }

  if (isCameraApproval(row)) {
    return canManageApprovals(req) && workflowStatus(row) === 'pending_producer'
  }

  return canManageApprovals(req) && row.status === 'pending'
}

function stageLabelForPendingApproval(row: ApprovalRow) {
  const status = approvalWorkflowStatus(row)

  if (status === 'pending_art_director') {
    return 'Awaiting Art Director'
  }

  if (status === 'pending_producer') {
    return 'Awaiting Producer'
  }

  if (status === 'pending_dop') {
    return 'Awaiting DOP'
  }

  return 'Pending'
}

function formatAuditTimestamp(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function pendingApprovalNote(row: ApprovalRow, userMap: Map<string, UserRow>) {
  const metadata = asObject(row.metadata)

  if (!isArtExpenseApproval(row)) {
    return asString(metadata.notes) ?? row.request_description ?? undefined
  }

  const artStatus = artExpenseWorkflowStatus(row)
  const detailNote = row.request_description ?? asString(metadata.notes) ?? undefined

  if (artStatus === 'pending_art_director') {
    return detailNote
      ? `Awaiting Art Director approval. ${detailNote}`
      : 'Awaiting Art Director approval before producer sign-off.'
  }

  if (artStatus === 'pending_producer') {
    const directorId = asString(metadata.artDirectorReviewedBy)
    const directorName = directorId ? userMap.get(directorId)?.full_name ?? 'Art Director' : 'Art Director'
    const reviewedAt = formatAuditTimestamp(asString(metadata.artDirectorReviewedAt))
    const approvalLine = reviewedAt
      ? `${directorName} approved on ${reviewedAt}. Awaiting producer approval.`
      : `${directorName} approved this expense. Awaiting producer approval.`

    return detailNote
      ? `${approvalLine} ${detailNote}`
      : approvalLine
  }

  return asString(metadata.notes) ?? detailNote
}

function isCompletedApproval(row: ApprovalRow) {
  const artStatus = artExpenseWorkflowStatus(row)
  if (artStatus === 'approved' || artStatus === 'rejected') {
    return true
  }

  if (!isCameraApproval(row)) {
    return row.status === 'approved' || row.status === 'rejected'
  }

  const status = workflowStatus(row)
  return status === 'approved' || status === 'rejected'
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

async function getUserMap(userIds: string[]): Promise<Map<string, UserRow>> {
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

  return new Map<string, UserRow>((data ?? []).map(row => [String(row.id), row as UserRow]))
}

async function getApprovalsForProject(projectId: string) {
  const { data, error } = await adminClient
    .from('approvals')
    .select('id, project_id, type, department, requested_by, request_title, request_description, amount, priority, status, submitted_at, updated_at, approved_by, approved_at, rejected_at, rejection_reason, approvable_table, approvable_id, metadata')
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
    const pendingApprovals = approvals.filter(isPendingForProducer)
    const userIds = Array.from(
      new Set(
        pendingApprovals.flatMap(row => {
          const metadata = asObject(row.metadata)
          return [row.requested_by, asString(metadata.artDirectorReviewedBy)].filter((value): value is string => Boolean(value))
        }),
      ),
    )
    const userMap = await getUserMap(userIds)

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
        workflowStatus: approvalWorkflowStatus(row),
        stageLabel: stageLabelForPendingApproval(row),
        canAct: canActOnPendingApproval(req, row),
        notes: pendingApprovalNote(row, userMap),
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

    const approvals = await getApprovalsForProject(projectId)
    const completedApprovals = approvals
      .filter(isCompletedApproval)
      .sort((left, right) => {
        const leftTime = left.approved_at ?? left.rejected_at ?? left.updated_at ?? left.submitted_at
        const rightTime = right.approved_at ?? right.rejected_at ?? right.updated_at ?? right.submitted_at
        return new Date(rightTime).getTime() - new Date(leftTime).getTime()
      })
      .slice(0, 25)

    const actorIds = Array.from(
      new Set(completedApprovals.map(row => row.approved_by).filter((value): value is string => Boolean(value))),
    )
    const userMap = await getUserMap(actorIds)

    const history = completedApprovals.map(row => {
      const actor = row.approved_by ? userMap.get(row.approved_by) : null
      const action = isArtExpenseApproval(row)
        ? (artExpenseWorkflowStatus(row) === 'rejected' ? 'rejected' : 'approved')
        : (workflowStatus(row) === 'rejected' ? 'rejected' : 'approved')
      const metadata = asObject(row.metadata)
      return {
        requestId: row.request_title || row.id,
        approvedBy: actor?.full_name ?? 'ProdSync',
        role: actor?.role ?? 'Approver',
        timestamp: row.approved_at ?? row.rejected_at ?? asString(metadata.updatedAt) ?? row.updated_at ?? row.submitted_at,
        auditNote: action === 'rejected'
          ? row.rejection_reason ?? asString(metadata.notes) ?? row.request_description ?? ''
          : asString(metadata.notes) ?? row.request_description ?? '',
        action,
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
    const pendingApprovals = approvals.filter(isPendingForProducer)
    const today = new Date().toISOString().slice(0, 10)
    const completed = approvals.filter(isCompletedApproval)
    const averageActionTimeMinutes = completed.length === 0
      ? 0
      : Math.round(
          completed.reduce((total, row) => {
            const completedAt = asString(asObject(row.metadata).updatedAt) ?? row.approved_at ?? row.rejected_at ?? row.updated_at ?? row.submitted_at
            const deltaMinutes = (new Date(completedAt).getTime() - new Date(row.submitted_at).getTime()) / 60_000
            return total + Math.max(0, deltaMinutes)
          }, 0) / completed.length,
        )

    const kpis = {
      totalPending: pendingApprovals.length,
      highValue: pendingApprovals.filter(
        row => row.priority === 'high' || row.priority === 'emergency' || Number(row.amount ?? 0) >= 100000,
      ).length,
      approvedToday: approvals.filter(row => {
        const artStatus = artExpenseWorkflowStatus(row)
        if (artStatus === 'approved') {
          return (asString(asObject(row.metadata).updatedAt) ?? row.approved_at ?? '').startsWith(today)
        }

        return workflowStatus(row) === 'approved' && (row.approved_at ?? '').startsWith(today)
      }).length,
      rejectedToday: approvals.filter(row => {
        const artStatus = artExpenseWorkflowStatus(row)
        if (artStatus === 'rejected') {
          return (asString(asObject(row.metadata).updatedAt) ?? row.rejected_at ?? '').startsWith(today)
        }

        return workflowStatus(row) === 'rejected' && (row.rejected_at ?? '').startsWith(today)
      }).length,
      pendingValueINR: pendingApprovals
        .reduce((total, row) => total + Number(row.amount ?? 0), 0),
      avgActionTimeMinutes: averageActionTimeMinutes,
    }

    console.log('[requests][kpis] db result', { projectId, kpis })
    res.json({ kpis })
  } catch (error) {
    next(error)
  }
})

requestsRouter.post('/:projectId/:requestId/approve', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    const requestId = String(req.params.requestId ?? '')
    const reviewerId = req.authUser?.id
    console.log('[requests][approve] route hit', { projectId, requestId, reviewerId })

    const approvals = await getApprovalsForProject(projectId)
    const approval = approvals.find(row => row.id === requestId)

    if (!approval) {
      throw new HttpError(404, 'Approval request not found.')
    }

    if (isArtExpenseApproval(approval)) {
      const artStatus = artExpenseWorkflowStatus(approval)
      const canManageArtApproval = artStatus === 'pending_art_director'
        ? canManageArtDirectorExpenseApprovals(req)
        : canManageApprovals(req)

      if (!canManageArtApproval) {
        throw new HttpError(403, artStatus === 'pending_art_director'
          ? 'Only the Art Director can approve this expense at the department stage.'
          : 'Only production leadership can approve this expense.')
      }
    } else if (!canManageApprovals(req)) {
      throw new HttpError(403, 'Only production leadership can approve requests.')
    }

    if (isCameraApproval(approval) && workflowStatus(approval) !== 'pending_producer') {
      throw new HttpError(409, 'This camera request is not ready for producer approval yet.')
    }

    const metadata = asObject(approval.metadata)
    const now = new Date().toISOString()

    if (isArtExpenseApproval(approval)) {
      const artStatus = artExpenseWorkflowStatus(approval)

      if (artStatus !== 'pending_art_director' && artStatus !== 'pending_producer') {
        throw new HttpError(409, 'This art expense is not awaiting approval.')
      }

      await resolveArtExpenseApprovalDecision({
        projectId,
        expenseId: approval.approvable_id,
        approvalId: requestId,
        reviewerId: reviewerId ?? null,
        stage: artStatus === 'pending_art_director' ? 'art_director' : 'producer',
        decision: 'approved',
        reason: null,
      })

      const { data, error } = await adminClient
        .from('approvals')
        .update({
          approved_by: artStatus === 'pending_producer' ? reviewerId : null,
          approved_at: artStatus === 'pending_producer' ? now : null,
          rejected_at: null,
          rejection_reason: null,
          metadata: {
            ...metadata,
            workflowStatus: artStatus === 'pending_art_director' ? 'pending_producer' : 'approved',
            decision: artStatus === 'pending_producer' ? 'approved' : null,
            notes: artStatus === 'pending_art_director'
              ? 'Art Director approved. Awaiting producer approval.'
              : (asString(metadata.notes) ?? approval.request_description ?? 'Approved from producer approvals.'),
            artDirectorReviewedBy: artStatus === 'pending_art_director' ? reviewerId : asString(metadata.artDirectorReviewedBy),
            artDirectorReviewedAt: artStatus === 'pending_art_director' ? now : asString(metadata.artDirectorReviewedAt),
            producerReviewedBy: artStatus === 'pending_producer' ? reviewerId : asString(metadata.producerReviewedBy),
            producerReviewedAt: artStatus === 'pending_producer' ? now : asString(metadata.producerReviewedAt),
            updatedAt: now,
            actedBy: reviewerId,
          },
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

      console.log('[requests][approve][art] db result', { projectId, requestId })
      res.json({ ok: true })
      return
    }

    const { data, error } = await adminClient
      .from('approvals')
      .update({
        status: isCameraApproval(approval) ? approval.status : 'approved',
        approved_by: reviewerId,
        approved_at: now,
        rejected_at: null,
        rejection_reason: null,
        metadata: {
          ...metadata,
          workflowStatus: 'approved',
          updatedAt: now,
          actedBy: reviewerId,
        },
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

    await resolveTransportApprovalDecision({
      projectId,
      reviewerId: reviewerId ?? null,
      decision: 'approved',
      reason: null,
      metadata,
    })

    console.log('[requests][approve] db result', { projectId, requestId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

requestsRouter.post('/:projectId/:requestId/reject', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId ?? '')
    const requestId = String(req.params.requestId ?? '')
    const reviewerId = req.authUser?.id
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    console.log('[requests][reject] route hit', { projectId, requestId, reviewerId, hasReason: Boolean(reason) })

    const approvals = await getApprovalsForProject(projectId)
    const approval = approvals.find(row => row.id === requestId)

    if (!approval) {
      throw new HttpError(404, 'Approval request not found.')
    }

    if (isArtExpenseApproval(approval)) {
      const artStatus = artExpenseWorkflowStatus(approval)
      const canManageArtApproval = artStatus === 'pending_art_director'
        ? canManageArtDirectorExpenseApprovals(req)
        : canManageApprovals(req)

      if (!canManageArtApproval) {
        throw new HttpError(403, artStatus === 'pending_art_director'
          ? 'Only the Art Director can reject this expense at the department stage.'
          : 'Only production leadership can reject this expense.')
      }
    } else if (!canManageApprovals(req)) {
      throw new HttpError(403, 'Only production leadership can reject requests.')
    }

    if (isCameraApproval(approval) && workflowStatus(approval) !== 'pending_producer') {
      throw new HttpError(409, 'This camera request is not ready for producer rejection yet.')
    }

    const metadata = asObject(approval.metadata)
    const now = new Date().toISOString()

    if (isArtExpenseApproval(approval)) {
      const artStatus = artExpenseWorkflowStatus(approval)

      if (artStatus !== 'pending_art_director' && artStatus !== 'pending_producer') {
        throw new HttpError(409, 'This art expense is not awaiting approval.')
      }

      await resolveArtExpenseApprovalDecision({
        projectId,
        expenseId: approval.approvable_id,
        approvalId: requestId,
        reviewerId: reviewerId ?? null,
        stage: artStatus === 'pending_art_director' ? 'art_director' : 'producer',
        decision: 'rejected',
        reason: reason || (artStatus === 'pending_art_director' ? 'Denied by Art Director.' : 'Denied from producer approvals.'),
      })

      const { data, error } = await adminClient
        .from('approvals')
        .update({
          approved_by: reviewerId,
          approved_at: null,
          rejected_at: now,
          rejection_reason: reason || (artStatus === 'pending_art_director' ? 'Denied by Art Director.' : 'Denied from producer approvals.'),
          metadata: {
            ...metadata,
            decision: 'rejected',
            workflowStatus: 'rejected',
            notes: reason || asString(metadata.notes) || (artStatus === 'pending_art_director' ? 'Denied by Art Director.' : 'Denied from producer approvals.'),
            artDirectorReviewedBy: artStatus === 'pending_art_director' ? reviewerId : asString(metadata.artDirectorReviewedBy),
            artDirectorReviewedAt: artStatus === 'pending_art_director' ? now : asString(metadata.artDirectorReviewedAt),
            producerReviewedBy: artStatus === 'pending_producer' ? reviewerId : asString(metadata.producerReviewedBy),
            producerReviewedAt: artStatus === 'pending_producer' ? now : asString(metadata.producerReviewedAt),
            updatedAt: now,
            actedBy: reviewerId,
          },
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

      console.log('[requests][reject][art] db result', { projectId, requestId })
      res.json({ ok: true })
      return
    }

    const { data, error } = await adminClient
      .from('approvals')
      .update({
        status: isCameraApproval(approval) ? approval.status : 'rejected',
        approved_by: reviewerId,
        approved_at: null,
        rejected_at: now,
        rejection_reason: reason || 'Denied from producer approvals.',
        metadata: {
          ...metadata,
          workflowStatus: 'rejected',
          notes: reason || asString(metadata.notes) || 'Denied from producer approvals.',
          updatedAt: now,
          actedBy: reviewerId,
        },
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

    await resolveTransportApprovalDecision({
      projectId,
      reviewerId: reviewerId ?? null,
      decision: 'rejected',
      reason: reason || 'Denied from producer approvals.',
      metadata,
    })

    console.log('[requests][reject] db result', { projectId, requestId })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
