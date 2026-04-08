import type { User, UserRole } from '@/types'
import { canAccessArtWorkspace, canAccessCameraWorkspace, canAccessReportsWorkspace, isProducerUser } from './role-capabilities'

export type AppRouteId =
  | 'dashboard'
  | 'projects'
  | 'transport'
  | 'camera'
  | 'crew'
  | 'expenses'
  | 'wardrobe'
  | 'approvals'
  | 'reports'
  | 'settings'

export const APP_NAV_ITEMS: { path: string; label: string; icon: string; routeId: AppRouteId; exact?: boolean }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', routeId: 'dashboard', exact: true },
  { path: '/projects', label: 'Projects', icon: 'workspaces', routeId: 'projects' },
  { path: '/transport', label: 'Transport & Logistics', icon: 'local_shipping', routeId: 'transport' },
  { path: '/camera', label: 'Camera & Assets', icon: 'photo_camera', routeId: 'camera' },
  { path: '/crew', label: 'Crew & Wages', icon: 'groups', routeId: 'crew' },
  { path: '/expenses', label: 'Art & Expenses', icon: 'palette', routeId: 'expenses' },
  { path: '/wardrobe', label: 'Wardrobe & Makeup', icon: 'checkroom', routeId: 'wardrobe' },
  { path: '/approvals', label: 'Approvals', icon: 'verified_user', routeId: 'approvals' },
  { path: '/reports', label: 'Reports', icon: 'analytics', routeId: 'reports' },
  { path: '/settings', label: 'Settings', icon: 'settings', routeId: 'settings' },
]

const COMMAND_ROLES: UserRole[] = ['EP', 'LineProducer']
const FIELD_ROLES: UserRole[] = ['Crew', 'Driver', 'DataWrangler']

function hasDepartmentAccess(user: User, departments: string[]) {
  return Boolean(user.departmentId && departments.includes(user.departmentId))
}

function hasProjectRoleTitle(user: User, titles: string[]) {
  return Boolean(user.projectRoleTitle && titles.includes(user.projectRoleTitle))
}

export function isProducerRole(role: UserRole) {
  return COMMAND_ROLES.includes(role)
}

export function isFieldRole(role: UserRole) {
  return FIELD_ROLES.includes(role)
}

export function canAccessRoute(user: User, routeId: AppRouteId) {
  switch (routeId) {
    case 'dashboard':
      return isProducerUser(user)
    case 'projects':
      return true
    case 'transport':
      return isProducerRole(user.role) || user.role === 'Driver' || hasDepartmentAccess(user, ['transport', 'production'])
    case 'camera':
      return canAccessCameraWorkspace(user) || user.role === 'DataWrangler' || hasDepartmentAccess(user, ['camera', 'post'])
    case 'crew':
      return (
        isProducerRole(user.role) ||
        ['HOD', 'Supervisor', 'Crew'].includes(user.role) ||
        hasDepartmentAccess(user, ['production', 'transport']) ||
        hasProjectRoleTitle(user, ['Production Manager', 'Transport Captain'])
      )
    case 'expenses':
      return canAccessArtWorkspace(user) || hasDepartmentAccess(user, ['production'])
    case 'wardrobe':
      return isProducerRole(user.role) || hasDepartmentAccess(user, ['wardrobe'])
    case 'approvals':
      return isProducerUser(user)
    case 'reports':
      return canAccessReportsWorkspace(user)
    case 'settings':
      return isProducerUser(user)
    default:
      return false
  }
}

export function getDefaultAuthorizedPath(user: User) {
  return '/projects'
}

export function getDefaultWorkspacePath(user: User) {
  for (const item of APP_NAV_ITEMS) {
    if (item.routeId === 'projects') continue
    if (canAccessRoute(user, item.routeId)) {
      return item.path
    }
  }
  return '/projects'
}

export function resolveAuthorizedPath(user: User, requestedPath?: string | null) {
  if (!requestedPath) return getDefaultAuthorizedPath(user)

  const matchingRoute = APP_NAV_ITEMS.find(item => requestedPath === item.path || requestedPath.startsWith(`${item.path}/`))
  if (matchingRoute?.routeId === 'projects' && canAccessRoute(user, 'projects')) {
    return '/projects'
  }

  return getDefaultAuthorizedPath(user)
}
