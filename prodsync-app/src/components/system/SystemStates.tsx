import { Surface } from '@/components/shared/Surface'

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <Surface variant="muted" className="mx-auto mt-8 max-w-xl" padding="lg">
      <div className="flex h-56 flex-col items-center justify-center gap-5 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-orange-500 animate-spin dark:border-zinc-800 dark:border-t-orange-500" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
    </Surface>
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
