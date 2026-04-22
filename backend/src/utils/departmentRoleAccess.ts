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

function department(req: Request) {
  return normalize(req.projectAccess?.department ?? req.authUser?.department)
}

export function isProducerRequest(req: Request) {
  return Boolean(
    req.projectAccess?.isOwner
      || authRole(req) === 'EP'
      || authRole(req) === 'LINE_PRODUCER'
      || membershipRole(req) === 'EP'
      || membershipRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'EXECUTIVE_PRODUCER'
      || projectRole(req) === 'LINE_PRODUCER'
      || projectRole(req) === 'PRODUCTION_MANAGER',
  )
}

export function canAccessCameraModule(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'DOP'
      || projectRole(req) === '1ST_AC'
      || projectRole(req) === 'CAMERA_OPERATOR'
      || projectRole(req) === 'DATA_WRANGLER'
      || authRole(req) === 'DATA_WRANGLER'
      || department(req) === 'CAMERA'
      || department(req) === 'POST',
  )
}

export function canManageCameraWishlist(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'DOP'
      || (department(req) === 'CAMERA' && membershipRole(req) === 'HOD'),
  )
}

export function canSubmitCameraRequest(req: Request) {
  return canAccessCameraModule(req)
}

export function canLogCameraMovement(req: Request) {
  return canAccessCameraModule(req)
}

export function canReportCameraDamage(req: Request) {
  return canAccessCameraModule(req)
}

export function resolveCameraApprovalStage(req: Request) {
  if (isProducerRequest(req)) {
    return 'producer' as const
  }

  if (
    projectRole(req) === 'DOP'
    || (department(req) === 'CAMERA' && membershipRole(req) === 'HOD')
  ) {
    return 'dop' as const
  }

  return null
}

export function canAccessArtModule(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'ART_DIRECTOR'
      || projectRole(req) === 'ART_ASSISTANT'
      || department(req) === 'ART',
  )
}

export function canCreateArtExpense(req: Request) {
  return canAccessArtModule(req)
}

export function canDeleteArtExpense(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'ART_DIRECTOR'
      || (department(req) === 'ART' && membershipRole(req) === 'HOD'),
  )
}

export function canManageArtProps(req: Request) {
  return canAccessArtModule(req)
}

export function canDeleteArtProps(req: Request) {
  return canDeleteArtExpense(req)
}

export function canManageArtSets(req: Request) {
  return canAccessArtModule(req)
}

export function canViewArtBudget(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'ART_DIRECTOR'
      || (department(req) === 'ART' && membershipRole(req) === 'HOD'),
  )
}

export function canAccessWardrobeModule(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'COSTUME_SUPERVISOR'
      || projectRole(req) === 'WARDROBE_STYLIST'
      || department(req) === 'WARDROBE',
  )
}

export function canAccessActorsModule(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'ACTOR_COORDINATOR'
      || projectRole(req) === 'JUNIOR_ARTIST_COORDINATOR'
      || department(req) === 'ACTORS',
  )
}

export function canManageActorsModule(req: Request) {
  return canAccessActorsModule(req)
}

export function canDeleteActorLooks(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'ACTOR_COORDINATOR'
      || (department(req) === 'ACTORS' && membershipRole(req) === 'HOD'),
  )
}

export function canManageWardrobeContinuity(req: Request) {
  return canAccessWardrobeModule(req)
}

export function canDeleteWardrobeContinuity(req: Request) {
  return Boolean(
    isProducerRequest(req)
      || projectRole(req) === 'COSTUME_SUPERVISOR'
      || (department(req) === 'WARDROBE' && membershipRole(req) === 'HOD'),
  )
}

export function canManageWardrobeLaundry(req: Request) {
  return canAccessWardrobeModule(req)
}

export function canManageWardrobeInventory(req: Request) {
  return canAccessWardrobeModule(req)
}

export function canManageWardrobeAccessories(req: Request) {
  return canAccessWardrobeModule(req)
}
