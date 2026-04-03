export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-6 h-6 border border-white/20 border-t-white rounded-full animate-spin" />
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">{message}</p>
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong', retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
      <p className="text-sm font-bold text-white">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="text-[10px] font-bold uppercase tracking-widest border border-white/20 px-4 py-2 hover:bg-white/5 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, icon = 'inbox' }: { title: string; description?: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <span className="material-symbols-outlined text-4xl text-white/10">{icon}</span>
      <p className="text-sm font-bold text-white/40">{title}</p>
      {description && <p className="text-xs text-white/20 max-w-xs">{description}</p>}
    </div>
  )
}
