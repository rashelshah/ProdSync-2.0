import type { User } from '@/types'

type UserLike = Pick<User, 'role' | 'projectRoleTitle' | 'departmentId'> | null | undefined

function hasProjectRole(user: UserLike, titles: string[]) {
  return Boolean(user?.projectRoleTitle && titles.includes(user.projectRoleTitle))
}

export function isProducerUser(user: UserLike) {
  return Boolean(
    user?.role === 'EP'
      || user?.role === 'LineProducer'
      || hasProjectRole(user, ['Executive Producer', 'Line Producer', 'Production Manager']),
  )
}

export function isCameraDop(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['DOP'])
      || (user?.departmentId === 'camera' && user.role === 'HOD'),
  )
}

export function isCameraFirstAc(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['1st AC'])
      || (user?.departmentId === 'camera' && user.role === 'Supervisor'),
  )
}

export function isCameraOperator(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['Camera Operator'])
      || (user?.departmentId === 'camera' && user.role === 'Crew'),
  )
}

export function isArtDirector(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['Art Director'])
      || (user?.departmentId === 'art' && user.role === 'HOD'),
  )
}

export function isArtAssistant(user: UserLike) {
  return Boolean(
    hasProjectRole(user, ['Art Assistant'])
      || (user?.departmentId === 'art' && (user.role === 'Supervisor' || user.role === 'Crew')),
  )
}

export function canAccessCameraWorkspace(user: UserLike) {
  return isProducerUser(user) || isCameraDop(user) || isCameraFirstAc(user) || isCameraOperator(user)
}

export function canManageCameraWishlist(user: UserLike) {
  return isProducerUser(user) || isCameraDop(user)
}

export function canSubmitCameraRequest(user: UserLike) {
  return canAccessCameraWorkspace(user)
}

export function canLogCameraMovement(user: UserLike) {
  return canAccessCameraWorkspace(user)
}

export function canReportCameraDamage(user: UserLike) {
  return canAccessCameraWorkspace(user)
}

export function canReviewCameraRequestAtDopStage(user: UserLike) {
  return isProducerUser(user) || isCameraDop(user)
}

export function canReviewCameraRequestAtProducerStage(user: UserLike) {
  return isProducerUser(user)
}

export function canAccessArtWorkspace(user: UserLike) {
  return isProducerUser(user) || isArtDirector(user) || isArtAssistant(user)
}

export function canCreateArtExpense(user: UserLike) {
  return canAccessArtWorkspace(user)
}

export function canDeleteArtExpense(user: UserLike) {
  return isProducerUser(user) || isArtDirector(user)
}

export function canManageArtProps(user: UserLike) {
  return canAccessArtWorkspace(user)
}

export function canDeleteArtProps(user: UserLike) {
  return isProducerUser(user) || isArtDirector(user)
}

export function canManageArtSets(user: UserLike) {
  return canAccessArtWorkspace(user)
}

export function canViewArtBudget(user: UserLike) {
  return isProducerUser(user) || isArtDirector(user)
}

export function canApproveArtExpense(user: UserLike) {
  return isProducerUser(user)
}
