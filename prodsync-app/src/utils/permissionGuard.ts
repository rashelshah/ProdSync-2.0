import type { User } from '@/types'

type UserLike = Pick<User, 'role' | 'projectRoleTitle' | 'departmentId'> | null | undefined

function hasProjectRole(user: UserLike, titles: string[]) {
  return Boolean(user?.projectRoleTitle && titles.includes(user.projectRoleTitle))
}

export function isTransportCaptain(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['Transport Captain']) ||
    (user?.role === 'HOD' && user.departmentId === 'transport'),
  )
}

export function isProductionManagerUser(user: UserLike) {
  return Boolean(hasProjectRole(user, ['Production Manager']))
}

export function canAccessCrewModule(user: UserLike) {
  if (!user || isTransportCaptain(user)) {
    return false
  }

  return Boolean(
    user.role === 'EP' ||
    user.role === 'LineProducer' ||
    isProductionManagerUser(user) ||
    user.role === 'Crew' ||
    user.role === 'Driver' ||
    user.role === 'DataWrangler' ||
    user.role === 'HOD',
  )
}

export function canViewCrewTable(user: UserLike) {
  if (!user || isTransportCaptain(user)) {
    return false
  }

  return Boolean(
    user.role === 'EP' ||
    user.role === 'LineProducer' ||
    isProductionManagerUser(user) ||
    user.role === 'HOD',
  )
}

export function canViewFullCrew(user: UserLike) {
  if (!user) {
    return false
  }

  return Boolean(
    user.role === 'EP' ||
    user.role === 'LineProducer' ||
    isProductionManagerUser(user),
  )
}

export function canEditGeofence(user: UserLike) {
  if (!user) {
    return false
  }

  return Boolean(
    user.role === 'EP' ||
    user.role === 'LineProducer' ||
    isProductionManagerUser(user),
  )
}
