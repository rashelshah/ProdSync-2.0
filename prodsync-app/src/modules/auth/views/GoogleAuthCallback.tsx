import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLoader } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { supabase } from '@/lib/supabase'
import { showError, showInfo, showSuccess } from '@/lib/toast'

async function waitForGoogleSession(timeoutMs = 8_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return data.session
    }

    await new Promise(resolve => window.setTimeout(resolve, 150))
  }

  return null
}

export function GoogleAuthCallback() {
  const navigate = useNavigate()
  const finalizeGoogleSignIn = useAuthStore(state => state.finalizeGoogleSignIn)
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) {
      return
    }

    hasProcessed.current = true

    void (async () => {
      const session = await waitForGoogleSession()
      if (!session) {
        showError('Google sign-in could not be completed.', { id: 'auth-google-callback' })
        navigate('/auth', { replace: true })
        return
      }

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
  }, [finalizeGoogleSignIn, navigate])

  return <PageLoader open message="Finalizing Google sign-in..." />
}
