import type { HTMLAttributes } from 'react'
import { cn } from '@/utils'

type SurfaceVariant = 'default' | 'muted' | 'raised' | 'table' | 'danger' | 'warning' | 'inverse'
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg'

const variantClasses: Record<SurfaceVariant, string> = {
  default: 'bg-transparent border-none shadow-none',
  muted: 'rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] shadow-soft',
  raised: 'rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-soft',
  table: 'rounded-[30px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-soft',
  danger: 'rounded-[28px] border border-red-200 bg-red-50/80 shadow-soft dark:border-red-500/20 dark:bg-red-500/10',
  warning: 'rounded-[28px] border border-orange-200 bg-orange-50/80 shadow-soft dark:border-orange-500/20 dark:bg-orange-500/10',
  inverse: 'rounded-[30px] border border-[color:var(--app-text)] bg-[color:var(--app-text)] text-[color:var(--app-bg)] shadow-soft',
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
