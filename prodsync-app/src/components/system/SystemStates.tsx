import { useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/shared/Surface'
import { useAuthStore } from '@/features/auth/auth.store'
import { cn } from '@/utils'

const TUBE_LIGHT_LOADER_SRC = '/video/tubelight%20loader.webm'
const EXIT_FADE_MS = 180

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <Surface variant="muted" className="mx-auto mt-8 max-w-xl" padding="lg">
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
          <div className="h-4 w-11/12 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
          <div className="h-4 w-8/12 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
    </Surface>
  )
}

export function TubeLightLoaderOverlay({
  open,
  message = 'Loading...',
}: {
  open: boolean
  message?: string
}) {
  const isAuthReady = useAuthStore(state => state.isAuthReady)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const [isMounted, setIsMounted] = useState(open)
  const [isExiting, setIsExiting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const [dotCount, setDotCount] = useState(1)
  const showAuthLoader = !isAuthReady || !isAuthenticated

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
      const video = videoRef.current
      if (video) {
        video.currentTime = 0
        void video.play().catch(() => {
          // Muted autoplay may still be rejected in a few environments.
        })
      }
    }
  }, [open])

  useEffect(() => {
    if (!open && isMounted) {
      beginExit()
    }
  }, [isMounted, open])

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    if (!open || isExiting) {
      return
    }

    const timerId = window.setInterval(() => {
      setDotCount(current => (current % 3) + 1)
    }, 360)

    return () => window.clearInterval(timerId)
  }, [isExiting, open])

  if (!isMounted) {
    return null
  }

  if (!showAuthLoader) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden px-4 py-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05),transparent_28%),linear-gradient(180deg,color-mix(in_srgb,var(--app-bg)_92%,transparent),color-mix(in_srgb,var(--app-bg)_86%,transparent))] backdrop-blur-[1px] dark:bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05),transparent_28%),linear-gradient(180deg,rgba(9,9,11,0.82),rgba(9,9,11,0.76))]" />
        <Surface variant="muted" className="relative w-full max-w-4xl" padding="lg">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-5 w-56 animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-28 animate-pulse rounded-[24px] bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-28 animate-pulse rounded-[24px] bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-28 animate-pulse rounded-[24px] bg-zinc-100 dark:bg-zinc-900 md:col-span-2 xl:col-span-1" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
        </Surface>
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[220] flex items-center justify-center overflow-hidden px-4 py-8 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isExiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.06),transparent_28%),linear-gradient(180deg,color-mix(in_srgb,var(--app-bg)_92%,transparent),color-mix(in_srgb,var(--app-bg)_86%,transparent))] backdrop-blur-[1.5px] dark:bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08),transparent_28%),linear-gradient(180deg,rgba(9,9,11,0.84),rgba(9,9,11,0.78))]" />

      <div className="relative flex flex-col items-center justify-center">
        <video
          ref={videoRef}
          src={TUBE_LIGHT_LOADER_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="block w-[min(72vw,18rem)] max-w-[18rem] select-none object-contain mix-blend-screen [filter:drop-shadow(0_0_18px_rgba(249,115,22,0.16))_drop-shadow(0_0_44px_rgba(249,115,22,0.10))]"
        />
        <p className="-mt-1.5 text-sm font-medium leading-none tracking-[0.02em] text-[color:var(--app-text)]">
          <span className="inline-flex items-center justify-center">
            <span className="inline-block">Loading</span>
            <span
              aria-hidden="true"
              className="inline-block w-[3ch] text-left"
            >
              {'.'.repeat(dotCount)}
            </span>
          </span>
          <span className="sr-only">{message}</span>
        </p>
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
