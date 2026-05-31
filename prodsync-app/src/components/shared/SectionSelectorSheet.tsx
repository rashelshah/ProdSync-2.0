import type { ReactNode } from 'react'
import { Surface } from '@/components/shared/Surface'
import { cn } from '@/utils'

export interface SectionSelectorOption {
  id: string
  label: string
  icon?: string
  description?: string
}

interface SectionSelectorSheetProps {
  open: boolean
  title: string
  description?: string
  selectedId: string
  options: SectionSelectorOption[]
  onSelect: (id: string) => void
  onClose: () => void
  footer?: ReactNode
}

export function SectionSelectorSheet({
  open,
  title,
  description,
  selectedId,
  options,
  onSelect,
  onClose,
  footer,
}: SectionSelectorSheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-4 sm:px-4 md:hidden">
      <button
        type="button"
        aria-label="Close section selector"
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
        onClick={onClose}
      />
      <Surface
        variant="raised"
        padding="none"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[30px] border-zinc-200 dark:border-zinc-800"
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">ProdSync</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">{title}</h2>
              {description && <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          <div className="space-y-2">
            {options.map(option => {
              const active = option.id === selectedId
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelect(option.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-3xl border px-4 py-4 text-left transition',
                    active
                      ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10',
                  )}
                >
                  <span className={cn('material-symbols-outlined mt-0.5 text-[20px]', active ? 'text-orange-600 dark:text-orange-300' : 'text-zinc-500 dark:text-zinc-400')}>
                    {option.icon ?? 'chevron_right'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    {option.description && <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{option.description}</span>}
                  </span>
                  {active && <span className="material-symbols-outlined mt-0.5 text-[18px] text-orange-500">check</span>}
                </button>
              )
            })}
          </div>
        </div>

        {footer && (
          <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            {footer}
          </div>
        )}
      </Surface>
    </div>
  )
}
