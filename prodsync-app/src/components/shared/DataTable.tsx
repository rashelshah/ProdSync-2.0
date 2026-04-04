import type { ReactNode } from 'react'
import { cn } from '@/utils'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  getKey: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T>({ columns, data, getKey, onRowClick, className }: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {columns.map(column => (
              <th
                key={String(column.key)}
                className={cn('pb-4 font-semibold', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : '')}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.map(row => (
            <tr
              key={getKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950')}
            >
              {columns.map(column => {
                const raw = (row as Record<string, unknown>)[String(column.key)]

                return (
                  <td
                    key={String(column.key)}
                    className={cn(
                      'py-4 text-zinc-600 dark:text-zinc-300',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : '',
                      column.className,
                    )}
                  >
                    {column.render ? column.render(row) : String(raw ?? '-')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
