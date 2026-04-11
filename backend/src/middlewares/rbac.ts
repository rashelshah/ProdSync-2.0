import type { NextFunction, Request, Response } from 'express'
import { projectAccessMiddleware } from '../middleware/projectAccess.middleware'
import { HttpError } from '../utils/httpError'
import { hasTransportAccessRole, hasTransportTrackingViewerAccess, type TransportAccessRole } from '../utils/role'

export const requireProjectAccess = projectAccessMiddleware

export type ProducerRoleAlias = 'EP' | 'LP' | 'LINE_PRODUCER'

function normalizeAllowedRole(role: TransportAccessRole | ProducerRoleAlias): TransportAccessRole {
  if (role === 'EP' || role === 'LP' || role === 'LINE_PRODUCER') {
    return 'LINE_PRODUCER'
  }

  return role
}

export function requireRole(...allowedRoles: TransportAccessRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasTransportAccessRole(req, allowedRoles)) {
      return next(new HttpError(403, 'You do not have permission to access this transport resource.'))
    }

    return next()
  }
}

export function authorizeRoles(allowedRoles: Array<TransportAccessRole | ProducerRoleAlias>) {
  return requireRole(...allowedRoles.map(normalizeAllowedRole))
}

export function requireTrackingViewer(req: Request, _res: Response, next: NextFunction) {
  if (!hasTransportTrackingViewerAccess(req)) {
    return next(new HttpError(403, 'You do not have permission to access live transport tracking.'))
  }

  return next()
}
