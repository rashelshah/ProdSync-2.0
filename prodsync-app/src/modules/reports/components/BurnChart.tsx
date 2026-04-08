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
                boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12)',
              }}
              formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name === 'actual' ? 'Actual' : 'Planned']}
            />
            <Line type="monotone" dataKey="planned" stroke="rgba(24,24,27,0.35)" strokeWidth={2} dot={false} strokeDasharray="6 6" />
            <Line type="monotone" dataKey="actual" stroke="var(--chart-accent)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}
