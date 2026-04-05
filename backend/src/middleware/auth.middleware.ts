import type { NextFunction, Request, Response } from 'express'
import { getUserFromAccessToken } from '../services/auth.service'
import { HttpError } from '../utils/httpError'

function getBearerToken(headerValue?: string) {
  if (!headerValue?.startsWith('Bearer ')) {
    return null
  }

  return headerValue.slice('Bearer '.length).trim()
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const accessToken = getBearerToken(req.headers.authorization)

    if (!accessToken) {
      throw new HttpError(401, 'Authorization header missing bearer token.')
    }

    req.authUser = await getUserFromAccessToken(accessToken)
    next()
  } catch (error) {
    next(error)
  }
}

