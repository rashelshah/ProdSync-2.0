import type { NextFunction, Request, Response } from 'express'
import { getProjectAccess } from '../services/project-access.service'
import { HttpError } from '../utils/httpError'

export async function projectAccessMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const projectId = String(req.params?.projectId ?? req.body?.projectId ?? req.query?.projectId ?? '')
    const userId = req.authUser?.id

    if (!projectId) {
      throw new HttpError(400, 'Project id is required for this request.')
    }

    if (!userId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const access = await getProjectAccess(projectId, userId)

    if (!access.isMember && !access.isOwner && !access.hasApprovedJoinRequest) {
      throw new HttpError(403, 'Cross-project access is not allowed.')
    }

    req.projectAccess = {
      projectId,
      membershipRole: access.membershipRole,
      projectRole: access.projectRole,
      department: access.department,
      isOwner: access.isOwner,
    }

    next()
  } catch (error) {
    next(error)
  }
}
