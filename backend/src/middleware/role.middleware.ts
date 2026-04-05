import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../utils/httpError'

export function roleMiddleware(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = typeof req.authUser?.role === 'string'
      ? req.authUser.role.trim().toUpperCase().replace(/[\s-]+/g, '_')
      : null

    if (!role) {
      return next(new HttpError(403, 'Role is not available for this user.'))
    }

    if (!allowedRoles.includes(role)) {
      return next(new HttpError(403, 'You do not have permission to access this resource.'))
    }

    return next()
  }
}
