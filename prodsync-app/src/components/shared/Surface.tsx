import type { HTMLAttributes } from 'react'
import { cn } from '@/utils'

type SurfaceVariant = 'default' | 'muted' | 'raised' | 'table' | 'danger' | 'warning' | 'inverse'
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg'

const variantClasses: Record<SurfaceVariant, string> = {
  default: 'bg-transparent border-none shadow-none',
  muted: 'rounded-[28px] border border-zinc-200 bg-zinc-50 shadow-soft dark:border-zinc-800 dark:bg-zinc-900',
  raised: 'rounded-[30px] border border-zinc-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900',
  table: 'rounded-[30px] border border-zinc-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900',
  danger: 'rounded-[28px] border border-red-200 bg-red-50/80 shadow-soft dark:border-red-500/20 dark:bg-red-500/10',
  warning: 'rounded-[28px] border border-orange-200 bg-orange-50/80 shadow-soft dark:border-orange-500/20 dark:bg-orange-500/10',
  inverse: 'rounded-[30px] border border-zinc-900 bg-zinc-900 text-white shadow-soft dark:border-zinc-800 dark:bg-zinc-50 dark:text-zinc-900',
}

const paddingClasses: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7',
}

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
  padding?: SurfacePadding
}

export function Surface({
  className,
  children,
  variant = 'default',
  padding = 'md',
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'relative',
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
