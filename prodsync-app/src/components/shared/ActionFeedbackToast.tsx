import { useEffect, useRef } from 'react'
import { showError, showInfo, showSuccess } from '@/lib/toast'

export interface ActionFeedbackState {
  type: 'success' | 'error' | 'info'
  message: string
}

interface ActionFeedbackToastProps {
  feedback: ActionFeedbackState | null
  onDismiss: () => void
  durationMs?: number
}

export function ActionFeedbackToast({
  feedback,
  onDismiss,
  durationMs = 3200,
}: ActionFeedbackToastProps) {
  const previousFeedbackKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!feedback) {
      previousFeedbackKeyRef.current = null
      return
    }

    const feedbackKey = `${feedback.type}:${feedback.message}`
    if (previousFeedbackKeyRef.current !== feedbackKey) {
      previousFeedbackKeyRef.current = feedbackKey

      const toastId = feedbackKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
      if (feedback.type === 'error') {
        showError(feedback.message, { id: toastId })
      } else if (feedback.type === 'info') {
        showInfo(feedback.message, { id: toastId })
      } else {
        showSuccess(feedback.message, { id: toastId })
      }
    }

    const timeout = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timeout)
  }, [durationMs, feedback, onDismiss])

  return null
}
