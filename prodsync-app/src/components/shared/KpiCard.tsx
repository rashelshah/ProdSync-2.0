import type { ReactNode } from 'react'
import { Surface } from '@/components/shared/Surface'
import { cn } from '@/utils'

interface KpiCardProps {
  label: string
  value: string | ReactNode
  subLabel?: string
  subType?: 'default' | 'success' | 'warning' | 'critical'
  accentColor?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  subLabel,
  subType = 'default',
  accentColor,
  className,
}: KpiCardProps) {
  const subColors = {
    default: 'text-zinc-500 dark:text-zinc-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-500 dark:text-red-400',
  }

  return (
    <Surface variant="raised" padding="md" className={cn('min-h-[148px]', className)}>
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</p>
          <span
            className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          />
        </div>

        <div>
          <p className="text-3xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2rem]">{value}</p>
          {subLabel && (
            <p className={cn('mt-3 text-[11px] font-semibold uppercase tracking-[0.16em]', subColors[subType])}>
              {subLabel}
            </p>
          )}
        </div>
      </div>
    </Surface>
  )
}
