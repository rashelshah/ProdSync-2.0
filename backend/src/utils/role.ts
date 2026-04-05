import type { Request } from 'express'

export type TransportAccessRole = 'DRIVER' | 'TRANSPORT_CAPTAIN' | 'LINE_PRODUCER'

function normalizeRole(value?: string | null) {
  if (!value) return null

  return value.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function getTransportAccessRoles(req: Request): Set<TransportAccessRole> {
  const roles = new Set<TransportAccessRole>()
  const authRole = normalizeRole(req.authUser?.role)
  const membershipRole = normalizeRole(req.projectAccess?.membershipRole)
  const projectRole = normalizeRole(req.projectAccess?.projectRole)
  const department = normalizeRole(req.projectAccess?.department)

  if (req.projectAccess?.isOwner || membershipRole === 'EP' || membershipRole === 'LINE_PRODUCER' || authRole === 'EP' || authRole === 'LINE_PRODUCER') {
    roles.add('LINE_PRODUCER')
  }

  if (projectRole === 'DRIVER' || authRole === 'DRIVER') {
    roles.add('DRIVER')
  }

  if (
    projectRole === 'TRANSPORT_CAPTAIN' ||
    (department === 'TRANSPORT' && (membershipRole === 'HOD' || membershipRole === 'SUPERVISOR'))
  ) {
    roles.add('TRANSPORT_CAPTAIN')
  }

  return roles
}

export function hasTransportAccessRole(req: Request, allowed: TransportAccessRole[]) {
  const roles = getTransportAccessRoles(req)
  return allowed.some(role => roles.has(role))
}
