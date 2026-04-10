import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/system/SystemStates'
import { getDefaultAuthorizedPath } from './access-rules'
import { hasActiveSession, useAuthStore } from './auth.store'

export function PublicOnlyRoute() {
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const isAuthReady = useAuthStore(state => state.isAuthReady)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)
  const needsOnboarding = useAuthStore(state => state.needsOnboarding)
  const logout = useAuthStore(state => state.logout)
  const isActive = hasActiveSession({ user, isAuthenticated, sessionExpiresAt })

  useEffect(() => {
    if (!isActive && isAuthenticated) {
      logout()
    }
  }, [isActive, isAuthenticated, logout])

  if (!isAuthReady) {
    return <LoadingState message="Checking session..." />
  }

  if (isActive && user && !needsOnboarding) {
    return <Navigate to={getDefaultAuthorizedPath(user)} replace />
  }

  if (isActive && user && needsOnboarding && location.pathname !== '/auth') {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}

export function ProtectedRoute() {
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const isAuthReady = useAuthStore(state => state.isAuthReady)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)
  const needsOnboarding = useAuthStore(state => state.needsOnboarding)
  const logout = useAuthStore(state => state.logout)
  const isActive = hasActiveSession({ user, isAuthenticated, sessionExpiresAt })

  useEffect(() => {
    if (!isActive && isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, isActive, logout])

  if (!isAuthReady) {
    return <LoadingState message="Checking session..." />
  }

  if (!isActive) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  if (needsOnboarding) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
