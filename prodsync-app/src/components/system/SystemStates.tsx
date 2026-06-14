import { useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/shared/Surface'
import { cn } from '@/utils'
const EXIT_FADE_MS = 180

function LoaderSkeleton({ message = 'Loading...' }: { message?: string }) {
  return (
    <Surface variant="muted" className="relative w-full max-w-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60" padding="md">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
          <div className="h-3.5 w-72 max-w-full animate-pulse rounded-full bg-zinc-200/55 dark:bg-zinc-800/55" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-16 animate-pulse rounded-[18px] bg-zinc-100/90 dark:bg-zinc-900/90" />
          <div className="h-16 animate-pulse rounded-[18px] bg-zinc-100/90 dark:bg-zinc-900/90" />
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded-full bg-zinc-200/55 dark:bg-zinc-800/55" />
          <div className="h-3.5 w-10/12 animate-pulse rounded-full bg-zinc-200/55 dark:bg-zinc-800/55" />
          <div className="h-3.5 w-8/12 animate-pulse rounded-full bg-zinc-200/55 dark:bg-zinc-800/55" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
    </Surface>
  )
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-2xl px-4">
      <LoaderSkeleton message={message} />
    </div>
  )
}

export function TubeLightLoaderOverlay({
  open,
  message = 'Loading...',
}: {
  open: boolean
  message?: string
}) {
  const [isMounted, setIsMounted] = useState(open)
  const [isExiting, setIsExiting] = useState(false)
  const exitTimerRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }

  const beginExit = () => {
    if (isExiting || exitTimerRef.current != null) {
      return
    }

    setIsExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null
      setIsMounted(false)
      setIsExiting(false)
    }, EXIT_FADE_MS)
  }

  useEffect(() => {
    if (open) {
      clearTimers()
      setIsMounted(true)
      setIsExiting(false)
    }
  }, [open])

  useEffect(() => {
    if (!open && isMounted) {
      beginExit()
    }
  }, [isMounted, open])

  useEffect(() => () => clearTimers(), [])

  if (!isMounted) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[220] flex items-start justify-center overflow-auto px-4 py-6 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isExiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-bg)_90%,transparent),color-mix(in_srgb,var(--app-bg)_95%,transparent))] dark:bg-[linear-gradient(180deg,rgba(9,9,11,0.72),rgba(9,9,11,0.78))]" />

      <div className="relative flex w-full justify-center pt-8">
        <LoaderSkeleton message={message} />
      </div>
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong', retry }: { message?: string; retry?: () => void }) {
  return (
    <Surface variant="danger" className="mx-auto mt-8 max-w-xl" padding="lg">
      <div className="flex h-56 flex-col items-center justify-center gap-4 text-center">
        <span className="material-symbols-outlined text-5xl text-red-500 dark:text-red-400">error_outline</span>
        <p className="text-base font-semibold text-zinc-900 dark:text-white">{message}</p>
        {retry && (
          <button
            onClick={retry}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
          >
            Retry
          </button>
        )}
      </div>
    </Surface>
  )
}

export function EmptyState({ title, description, icon = 'inbox' }: { title: string; description?: string; icon?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</p>
        {description && <p className="mx-auto max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
    </div>
  )
}
