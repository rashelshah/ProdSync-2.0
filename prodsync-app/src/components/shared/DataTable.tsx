import { cn } from '@/utils'
import type { ReactNode } from 'react'

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
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="text-[10px] text-white/40 font-bold uppercase tracking-widest border-b border-white/5">
            {columns.map(col => (
              <th
                key={String(col.key)}
                className={cn('pb-3 font-bold', col.align === 'right' ? 'text-right' : '')}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map(row => (
            <tr
              key={getKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-white/3'
              )}
            >
              {columns.map(col => {
                const raw = (row as any)[col.key]
                return (
                  <td
                    key={String(col.key)}
                    className={cn(
                      'py-3 text-white/70',
                      col.align === 'right' ? 'text-right' : '',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : String(raw ?? '—')}
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
