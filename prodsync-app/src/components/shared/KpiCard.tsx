import { cn } from '@/utils'
import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string | ReactNode
  subLabel?: string
  subType?: 'default' | 'success' | 'warning' | 'critical'
  accentColor?: string
  className?: string
}

export function KpiCard({ label, value, subLabel, subType = 'default', accentColor, className }: KpiCardProps) {
  const subColors = {
    default: 'text-white/30',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-red-400',
  }

  return (
    <div
      className={cn(
        'bg-[#1c1b1b] border border-white/5 p-4 rounded-sm relative overflow-hidden',
        accentColor && 'border-l-2',
        className
      )}
      style={accentColor ? { borderLeftColor: accentColor } : {}}
    >
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
      {subLabel && (
        <p className={cn('text-[10px] mt-2 font-medium', subColors[subType])}>
          {subLabel}
        </p>
      )}
    </div>
  )
}
