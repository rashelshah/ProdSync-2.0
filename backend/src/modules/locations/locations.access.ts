import type { Request } from 'express'

function normalize(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
}

const LOCATION_HEAD_PROJECT_ROLES = new Set([
  'DOP',
  'ART_DIRECTOR',
  'TRANSPORT_CAPTAIN',
  'COSTUME_SUPERVISOR',
  'EDITOR',
  'ACTOR_COORDINATOR',
])

function authRole(req: Request) {
  return normalize(req.authUser?.role)
}

function membershipRole(req: Request) {
  return normalize(req.projectAccess?.membershipRole)
}

function projectRole(req: Request) {
  return normalize(req.projectAccess?.projectRole ?? req.authUser?.projectRoleTitle)
}

export function canManageLocations(req: Request) {
  const auth = authRole(req)
  const membership = membershipRole(req)
  const project = projectRole(req)

  return Boolean(
    req.projectAccess?.isOwner
      || auth === 'EP'
      || auth === 'LINE_PRODUCER'
      || membership === 'EP'
      || membership === 'LINE_PRODUCER'
      || project === 'EXECUTIVE_PRODUCER'
      || project === 'LINE_PRODUCER'
      || project === 'PRODUCTION_MANAGER',
  )
}

export function canViewLocations(req: Request) {
  return canManageLocations(req)
    || authRole(req) === 'HOD'
    || membershipRole(req) === 'HOD'
    || LOCATION_HEAD_PROJECT_ROLES.has(projectRole(req) ?? '')
}

export function canUploadLocationMedia(req: Request) {
  return canViewLocations(req)
}

export function canCommentOnLocations(req: Request) {
  return canViewLocations(req)
}

export function canViewAllLocations(req: Request) {
  return canManageLocations(req)
}
