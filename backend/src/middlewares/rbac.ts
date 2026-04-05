import type { NextFunction, Request, Response } from 'express'
import { projectAccessMiddleware } from '../middleware/projectAccess.middleware'
import { HttpError } from '../utils/httpError'
import { hasTransportAccessRole, type TransportAccessRole } from '../utils/role'

export const requireProjectAccess = projectAccessMiddleware

export function requireRole(...allowedRoles: TransportAccessRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasTransportAccessRole(req, allowedRoles)) {
      return next(new HttpError(403, 'You do not have permission to access this transport resource.'))
    }

    return next()
  }
}
