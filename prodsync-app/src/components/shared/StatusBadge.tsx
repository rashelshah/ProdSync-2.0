import { cn } from '@/utils'

type StatusVariant = 'active' | 'completed' | 'flagged' | 'pending' | 'approved' | 'rejected' | 'ot' | 'idle' | 'live' | 'verified' | 'mismatch' | 'requested' | 'paid' | 'warning' | 'over' | 'stable'

const variants: Record<StatusVariant, string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  live: 'bg-white/10 text-white animate-pulse',
  completed: 'bg-white/5 text-white/50',
  flagged: 'bg-red-900/40 text-red-400',
  pending: 'bg-amber-900/30 text-amber-400',
  approved: 'bg-white text-black',
  rejected: 'bg-red-900/40 text-red-400',
  ot: 'bg-red-600 text-white',
  idle: 'bg-amber-900/30 text-amber-400',
  verified: 'border border-white/20 text-white/50',
  mismatch: 'bg-red-900/40 text-red-400 font-black',
  requested: 'border border-white text-white',
  paid: 'bg-white/5 text-white/40',
  warning: 'bg-amber-900/30 text-amber-400',
  over: 'bg-black/60 text-white',
  stable: 'bg-white/5 text-white/60',
}

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string
  className?: string
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const display = label ?? variant.toUpperCase()
  return (
    <span className={cn(
      'px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm',
      variants[variant],
      className
    )}>
      {display}
    </span>
  )
}
