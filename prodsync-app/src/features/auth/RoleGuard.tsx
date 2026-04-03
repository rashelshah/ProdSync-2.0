import type { ReactNode } from 'react'
import { useAuthStore, Permissions } from './auth.store'
import type { UserRole } from '@/types'

interface RoleGuardProps {
  allowedRoles?: UserRole[]
  permission?: keyof typeof Permissions
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Wrap any section to restrict access by role or permission.
 * If the user's role is not in allowedRoles, renders fallback (or nothing).
 */
export function RoleGuard({ allowedRoles, permission, children, fallback = null }: RoleGuardProps) {
  const user = useAuthStore(s => s.user)

  if (!user) return <>{fallback}</>

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  if (permission && !Permissions[permission](user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
