import { useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/shared/Surface'
import { cn } from '@/utils'
const EXIT_FADE_MS = 180

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return <PageLoader open message={message} />
}

export function PageLoader({
  open,
  message = 'Loading...',
}: {
  open?: boolean
  message?: string
}) {
  const [isMounted, setIsMounted] = useState(open !== false)
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
    if (open !== false) {
      clearTimers()
      setIsMounted(true)
      setIsExiting(false)
    }
  }, [open])

  useEffect(() => {
    if (open === false && isMounted) {
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
        'page-shell space-y-6 animate-pulse transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isExiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <header className="page-header flex justify-between items-start">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 mb-3" />
          <div className="h-8 w-64 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 mb-3" />
          <div className="h-4 w-96 max-w-full rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
        </div>
        <div className="hidden flex-col items-end gap-3 md:flex">
          <div className="h-8 w-32 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="mt-2 flex gap-3">
            <div className="h-9 w-28 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
            <div className="h-9 w-32 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Surface key={i} variant="muted" className="h-[104px]" padding="none" />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Surface variant="table" className="h-[400px]" padding="none" />
        </div>
        <div className="space-y-6">
          <Surface variant="table" className="h-[280px]" padding="none" />
          <Surface variant="table" className="h-[280px]" padding="none" />
        </div>
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
