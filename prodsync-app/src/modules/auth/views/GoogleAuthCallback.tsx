import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { showError, showInfo, showSuccess } from '@/lib/toast'

export function GoogleAuthCallback() {
  const navigate = useNavigate()
  const isAuthReady = useAuthStore(state => state.isAuthReady)
  const finalizeGoogleSignIn = useAuthStore(state => state.finalizeGoogleSignIn)
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (!isAuthReady || hasProcessed.current) {
      return
    }

    hasProcessed.current = true

    void (async () => {
      const result = await finalizeGoogleSignIn()

      if (!result.ok) {
        showError(result.message ?? 'Google sign-in could not be completed.', { id: 'auth-google-callback' })
        navigate('/auth', { replace: true })
        return
      }

      if (result.needsOnboarding) {
        showInfo('Finish your onboarding setup to continue.', { id: 'auth-google-callback' })
        navigate('/auth', { replace: true })
        return
      }

      showSuccess('Welcome back!', { id: 'auth-google-callback' })
      navigate('/projects', { replace: true })
    })()
  }, [finalizeGoogleSignIn, isAuthReady, navigate])

  return <LoadingState message="Finalizing Google sign-in..." />
}
