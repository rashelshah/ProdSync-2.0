import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Surface } from '@/components/shared/Surface'
import type { ReportDepartmentRow } from '@/types'
import { formatCurrency } from '@/utils'

const COLORS = ['#f97316', '#18181b', '#fb7185', '#14b8a6', '#0ea5e9', '#eab308', '#8b5cf6']

interface DepartmentBreakdownProps {
  departments: ReportDepartmentRow[]
}

export function DepartmentBreakdown({ departments }: DepartmentBreakdownProps) {
  return (
    <Surface variant="table" padding="lg">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Department Mix</p>
          <h2 className="section-title">Spend Distribution</h2>
          <p className="section-description">How this project is burning budget across modules.</p>
        </div>
      </div>

      <div className="mt-6 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={departments}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => formatCurrency(Number(value))} />
            <Tooltip
              contentStyle={{
                borderRadius: '18px',
                border: '1px solid var(--app-border)',
                background: 'var(--app-surface-strong)',
                boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12)',
              }}
              formatter={value => [formatCurrency(Number(value ?? 0)), 'Spend']}
            />
            <Bar dataKey="spent" radius={[12, 12, 0, 0]}>
              {departments.map((department, index) => (
                <Cell key={department.department} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}
