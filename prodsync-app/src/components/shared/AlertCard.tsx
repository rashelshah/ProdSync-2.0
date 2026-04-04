import type { AlertItem } from '@/types'
import { Surface } from '@/components/shared/Surface'
import { cn, timeAgo } from '@/utils'

interface AlertCardProps {
  alert: AlertItem
  compact?: boolean
  onAcknowledge?: (alertId: string) => void
}

const severityConfig = {
  critical: {
    icon: 'error',
    label: 'Critical',
    text: 'text-red-500 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    tint: 'bg-red-50 dark:bg-red-500/10',
  },
  warning: {
    icon: 'warning',
    label: 'Warning',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-500/20',
    tint: 'bg-orange-50 dark:bg-orange-500/10',
  },
  info: {
    icon: 'info',
    label: 'Info',
    text: 'text-zinc-600 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-800',
    tint: 'bg-zinc-50 dark:bg-zinc-900',
  },
}

export function AlertCard({ alert, compact = false, onAcknowledge }: AlertCardProps) {
  const cfg = severityConfig[alert.severity]

  if (compact) {
    return (
      <div className={cn('rounded-[24px] border px-4 py-4', cfg.border, cfg.tint, alert.acknowledged && 'opacity-50')}>
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', cfg.tint, cfg.text)}>
            <span className="material-symbols-outlined text-[18px]">{cfg.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', cfg.text)}>{cfg.label}</p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{alert.title}</p>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{timeAgo(alert.timestamp)}</p>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{alert.source}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Surface variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'muted'} padding="md">
      <div className="flex items-start gap-4">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', cfg.tint, cfg.text)}>
          <span className="material-symbols-outlined text-[20px]">{cfg.icon}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={cn('text-[10px] font-semibold uppercase tracking-[0.22em]', cfg.text)}>{cfg.label}</span>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{alert.title}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{timeAgo(alert.timestamp)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{alert.message}</p>
          {!alert.acknowledged && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="mt-4 rounded-full border border-zinc-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </Surface>
  )
}
