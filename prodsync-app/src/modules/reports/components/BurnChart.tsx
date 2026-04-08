import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Surface } from '@/components/shared/Surface'
import type { ReportBurnChartPoint } from '@/types'
import { formatCurrency } from '@/utils'

interface BurnChartProps {
  data: ReportBurnChartPoint[]
}

export function BurnChart({ data }: BurnChartProps) {
  return (
    <Surface variant="table" padding="lg" className="overflow-hidden">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Burn Curve</p>
          <h2 className="section-title">Planned vs Actual</h2>
          <p className="section-description">Daily burn from aggregated finance snapshots only.</p>
        </div>
      </div>

      <div className="mt-6 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--app-muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => formatCurrency(Number(value))} />
            <Tooltip
              contentStyle={{
                borderRadius: '18px',
                border: '1px solid var(--app-border)',
                background: 'var(--app-surface-strong)',
                color: 'var(--app-text)',
                boxShadow: 'var(--chart-tooltip-shadow)',
              }}
              labelStyle={{ color: 'var(--app-text)' }}
              itemStyle={{ color: 'var(--app-text)' }}
              formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name === 'actual' ? 'Actual' : 'Planned']}
            />
            <Line type="monotone" dataKey="planned" stroke="var(--chart-muted-line)" strokeWidth={2} dot={false} strokeDasharray="6 6" />
            <Line type="monotone" dataKey="actual" stroke="var(--chart-accent)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: 'var(--chart-accent)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}
