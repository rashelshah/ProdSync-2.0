import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getDefaultAuthorizedPath } from './access-rules'
import { hasActiveSession, useAuthStore } from './auth.store'

export function PublicOnlyRoute() {
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)
  const logout = useAuthStore(state => state.logout)
  const isActive = hasActiveSession({ user, isAuthenticated, sessionExpiresAt })

  useEffect(() => {
    if (!isActive && isAuthenticated) {
      logout()
    }
  }, [isActive, isAuthenticated, logout])

  if (isActive && user) {
    return <Navigate to={getDefaultAuthorizedPath(user)} replace />
  }

  return <Outlet />
}

export function ProtectedRoute() {
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)
  const logout = useAuthStore(state => state.logout)
  const isActive = hasActiveSession({ user, isAuthenticated, sessionExpiresAt })

  useEffect(() => {
    if (!isActive && isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, isActive, logout])

  if (!isActive) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
