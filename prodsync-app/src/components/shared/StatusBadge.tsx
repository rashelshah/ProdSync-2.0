import { cn } from '@/utils'

type StatusVariant =
  | 'active'
  | 'completed'
  | 'flagged'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'ot'
  | 'idle'
  | 'live'
  | 'verified'
  | 'mismatch'
  | 'requested'
  | 'paid'
  | 'warning'
  | 'over'
  | 'stable'

const variants: Record<StatusVariant, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  live: 'bg-orange-500 text-black',
  completed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  flagged: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  pending: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
  approved: 'bg-orange-500 text-black',
  rejected: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  ot: 'bg-orange-500 text-black',
  idle: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  verified: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  mismatch: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  requested: 'bg-white text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:text-white dark:border-zinc-800',
  paid: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  warning: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
  over: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  stable: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string
  className?: string
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]',
        variants[variant],
        className,
      )}
    >
      {label ?? variant.toUpperCase()}
    </span>
  )
}
