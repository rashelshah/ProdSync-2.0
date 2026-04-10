import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ReactECharts from 'echarts-for-react'
import { Surface } from '@/components/shared/Surface'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { ReportDepartmentRow } from '@/types'
import { formatCurrency } from '@/utils'

const BAR_COLORS = ['#f97316', '#8b5cf6', '#fb7185', '#14b8a6', '#0ea5e9', '#eab308', '#ec4899']

interface DepartmentBreakdownProps {
  departments: ReportDepartmentRow[]
}

export function DepartmentBreakdown({ departments }: DepartmentBreakdownProps) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#d4d4d8' : '#3f3f46' // zinc-300 vs zinc-700

  const echartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b} : {c} ({d}%)'
    },
    legend: {
      top: 'bottom'
    },
    toolbox: {
      show: true,
      feature: {
        mark: { show: true },
        dataView: { show: true, readOnly: false, iconStyle: { borderColor: textColor } },
        restore: { show: true, iconStyle: { borderColor: textColor } },
        saveAsImage: { show: true, iconStyle: { borderColor: textColor } }
      },
      iconStyle: {
        borderColor: textColor
      }
    },
    series: [
      {
        name: 'Budget Used',
        type: 'pie',
        radius: [30, 120],
        center: ['50%', '45%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 8
        },
        label: {
          color: textColor
        },
        data: departments.map(d => ({
          value: d.spent,
          name: d.label
        })).sort((a, b) => b.value - a.value)
      }
    ]
  };

  return (
    <Surface variant="table" padding="lg">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Department Mix</p>
          <h2 className="section-title">Spend Distribution</h2>
          <p className="section-description">How this project is burning budget across modules.</p>
        </div>
      </div>

      <div className="mt-6 h-[220px]">
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
                color: 'var(--app-text)',
                boxShadow: 'var(--chart-tooltip-shadow)',
              }}
              labelStyle={{ color: 'var(--app-text)' }}
              itemStyle={{ color: 'var(--app-text)' }}
              formatter={value => [formatCurrency(Number(value ?? 0)), 'Spend']}
            />
            <Bar dataKey="spent" radius={[12, 12, 0, 0]}>
              {departments.map((department, index) => (
                <Cell key={department.department} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="mb-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Actual Budget Used</h3>
        <div className="h-[360px]">
          <ReactECharts option={echartsOption} theme={theme === 'dark' ? 'dark' : 'light'} style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }} />
        </div>
      </div>
    </Surface>
  )
}
