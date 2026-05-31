import type { Request } from 'express'

function normalize(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
}

function authRole(req: Request) {
  return normalize(req.authUser?.role)
}

function membershipRole(req: Request) {
  return normalize(req.projectAccess?.membershipRole)
}

function projectRole(req: Request) {
  return normalize(req.projectAccess?.projectRole ?? req.authUser?.projectRoleTitle)
}

export function canViewFoodBeverages(req: Request) {
  return Boolean(
    req.projectAccess?.isOwner
      || authRole(req) === 'EP'
      || authRole(req) === 'LINE_PRODUCER'
      || membershipRole(req) === 'EP'
      || membershipRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'EXECUTIVE_PRODUCER'
      || projectRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'PRODUCTION_MANAGER'
      || projectRole(req) === 'PRODUCTION_COORDINATOR'
      || authRole(req) === 'HOD'
      || membershipRole(req) === 'HOD',
  )
}

export function canManageFoodBeverages(req: Request) {
  return Boolean(
    req.projectAccess?.isOwner
      || authRole(req) === 'EP'
      || authRole(req) === 'LINE_PRODUCER'
      || membershipRole(req) === 'EP'
      || membershipRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'EXECUTIVE_PRODUCER'
      || projectRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'PRODUCTION_MANAGER'
      || projectRole(req) === 'PRODUCTION_COORDINATOR',
  )
}

export function canSubmitFoodForecast(req: Request) {
  return canViewFoodBeverages(req)
}
