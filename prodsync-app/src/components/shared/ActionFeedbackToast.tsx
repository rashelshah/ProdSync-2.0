import { useEffect } from 'react'
import { Surface } from '@/components/shared/Surface'

export interface ActionFeedbackState {
  type: 'success' | 'error'
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
  useEffect(() => {
    if (!feedback) {
      return
    }

    const timeout = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timeout)
  }, [durationMs, feedback, onDismiss])

  if (!feedback) {
    return null
  }

  const isError = feedback.type === 'error'

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] w-full max-w-sm sm:right-6 sm:top-6">
      <Surface
        variant={isError ? 'danger' : 'table'}
        padding="sm"
        className={isError ? '' : 'border-emerald-200 bg-emerald-50/95 dark:border-emerald-500/20 dark:bg-emerald-500/10'}
      >
        <div className="pointer-events-auto flex items-start gap-3">
          <span className={`material-symbols-outlined mt-0.5 text-lg ${isError ? 'text-red-500' : 'text-emerald-500'}`}>
            {isError ? 'error' : 'check_circle'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {isError ? 'Action Failed' : 'Action Complete'}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{feedback.message}</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Close
          </button>
        </div>
      </Surface>
    </div>
  )
}
