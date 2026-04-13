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

function buildDataViewContent(departments: ReportDepartmentRow[], theme: 'light' | 'dark') {
  const isDark = theme === 'dark'
  const sortedDepartments = [...departments].sort((a, b) => b.spent - a.spent)
  const totalSpend = sortedDepartments.reduce((sum, department) => sum + department.spent, 0)
  const cardBackground = isDark ? '#121215' : '#ffffff'
  const panelBackground = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e4e4e7'
  const textPrimary = isDark ? '#fafafa' : '#18181b'
  const textMuted = isDark ? '#a1a1aa' : '#71717a'

  const rows = sortedDepartments.map((department, index) => `
    <tr>
      <td style="padding: 14px 0; border-top: 1px solid ${borderColor};">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="width:10px; height:10px; border-radius:9999px; background:${BAR_COLORS[index % BAR_COLORS.length]}; flex:none;"></span>
          <div>
            <div style="font-size:14px; font-weight:600; color:${textPrimary};">${department.label}</div>
            <div style="margin-top:4px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${textMuted};">${department.share}% of spend</div>
          </div>
        </div>
      </td>
      <td style="padding: 14px 0; border-top: 1px solid ${borderColor}; text-align:right; font-size:14px; font-weight:600; color:${textPrimary};">
        ${formatCurrency(department.spent)}
      </td>
    </tr>
  `).join('')

  return `
    <section style="padding: 8px; color:${textPrimary}; font-family:inherit; background:${cardBackground};">
      <div style="padding: 20px 22px; border:1px solid ${borderColor}; border-radius:24px; background:${panelBackground}; box-shadow:${isDark ? '0 18px 38px rgba(0,0,0,0.35)' : '0 14px 32px rgba(15,23,42,0.08)'};">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px;">
          <div>
            <div style="font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:${textMuted};">Department Mix</div>
            <div style="margin-top:8px; font-size:24px; font-weight:700; letter-spacing:-0.04em; color:${textPrimary};">Actual Budget Used</div>
            <div style="margin-top:8px; font-size:13px; line-height:1.6; color:${textMuted};">Live spend snapshot for each department shown in the chart.</div>
          </div>
          <div style="min-width:140px; padding:14px 16px; border-radius:18px; background:${isDark ? 'rgba(249,115,22,0.12)' : '#ffedd5'}; text-align:right;">
            <div style="font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:${textMuted};">Total Spend</div>
            <div style="margin-top:8px; font-size:20px; font-weight:700; color:${textPrimary};">${formatCurrency(totalSpend)}</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding: 0 0 10px 0; text-align:left; font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:${textMuted};">Department</th>
              <th style="padding: 0 0 10px 0; text-align:right; font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:${textMuted};">Amount Used</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `
}

export function DepartmentBreakdown({ departments }: DepartmentBreakdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
        dataView: {
          show: true,
          readOnly: true,
          backgroundColor: isDark ? '#09090b' : '#f5f5f5',
          textareaColor: isDark ? '#121215' : '#ffffff',
          textareaBorderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e4e4e7',
          textColor,
          buttonColor: isDark ? '#f97316' : '#18181b',
          buttonTextColor: isDark ? '#18181b' : '#ffffff',
          optionToContent: () => buildDataViewContent(departments, theme),
          iconStyle: { borderColor: textColor }
        },
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
