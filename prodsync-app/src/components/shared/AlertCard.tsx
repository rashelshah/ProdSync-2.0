import { cn } from '@/utils'
import type { AlertItem } from '@/types'
import { timeAgo } from '@/utils'
import { useAlertStore } from '@/features/alerts/alert.store'

interface AlertCardProps {
  alert: AlertItem
  compact?: boolean
}

const severityConfig = {
  critical: {
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-950/30',
    label: 'Critical',
    icon: 'error',
  },
  warning: {
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    bg: 'bg-amber-950/30',
    label: 'Warning',
    icon: 'warning',
  },
  info: {
    border: 'border-l-sky-500',
    dot: 'bg-sky-400',
    text: 'text-sky-400',
    bg: 'bg-sky-950/20',
    label: 'Info',
    icon: 'info',
  },
}

export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const cfg = severityConfig[alert.severity]
  const acknowledge = useAlertStore(s => s.acknowledgeAlert)

  if (compact) {
    return (
      <div className={cn('flex items-start gap-3 pb-4 border-b border-white/5', alert.acknowledged && 'opacity-40')}>
        <span className={cn('material-symbols-outlined text-lg', cfg.text)} style={{ fontVariationSettings: "'FILL' 1" }}>
          {cfg.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white">{alert.title}</p>
          <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">
            {timeAgo(alert.timestamp)} • {alert.source}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'border-l-2 p-4 rounded-sm flex items-start gap-3',
      cfg.border, cfg.bg,
      alert.acknowledged && 'opacity-40'
    )}>
      <span className={cn('material-symbols-outlined text-lg', cfg.text)}>
        {cfg.icon}
      </span>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide', cfg.text)}>{cfg.label}</span>
            <p className="text-[12px] text-white font-medium mt-0.5">{alert.title}</p>
          </div>
          <span className="text-[10px] text-white/30 shrink-0">{timeAgo(alert.timestamp)}</span>
        </div>
        <p className="text-[11px] text-white/60 mt-1">{alert.message}</p>
        {!alert.acknowledged && (
          <button
            onClick={() => acknowledge(alert.id)}
            className="text-[10px] text-white/30 hover:text-white mt-2 uppercase tracking-widest font-bold"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
