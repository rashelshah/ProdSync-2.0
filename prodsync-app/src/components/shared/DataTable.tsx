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
  stickyHeader?: boolean
}

export function DataTable<T>({ columns, data, getKey, onRowClick, className, stickyHeader = false }: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[760px] table-fixed text-left text-sm">
        <thead className={cn(stickyHeader && 'sticky top-0 z-10 bg-white dark:bg-zinc-900')}>
          <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {columns.map(column => (
              <th
                key={String(column.key)}
                className={cn(
                  'bg-inherit px-4 pb-4 pt-1 font-semibold',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : '',
                  column.className,
                )}
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
                      'px-4 py-4 align-top text-zinc-600 dark:text-zinc-300',
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
