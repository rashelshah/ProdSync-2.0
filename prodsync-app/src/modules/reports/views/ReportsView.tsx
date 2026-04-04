import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'

const burnData = [
  { week: 'Wk 1', actual: 280, planned: 320 },
  { week: 'Wk 2', actual: 310, planned: 310 },
  { week: 'Wk 3', actual: 420, planned: 400 },
  { week: 'Wk 4', actual: 380, planned: 380 },
  { week: 'Wk 5', actual: 520, planned: 480 },
  { week: 'Wk 6', actual: 460, planned: 450 },
  { week: 'Wk 7', actual: 610, planned: 580 },
]

const deptSpend = [
  { dept: 'Transport', budget: 420000, actual: 357000 },
  { dept: 'Camera', actual: 312000, budget: 340000 },
  { dept: 'Crew', actual: 980000, budget: 920000 },
  { dept: 'Art', actual: 264000, budget: 300000 },
  { dept: 'Wardrobe', actual: 88000, budget: 100000 },
]

const otTrend = [
  { day: 'Mon', cost: 4200 },
  { day: 'Tue', cost: 3800 },
  { day: 'Wed', cost: 6100 },
  { day: 'Thu', cost: 9200 },
  { day: 'Fri', cost: 12840 },
  { day: 'Sat', cost: 5400 },
  { day: 'Sun', cost: 2100 },
]

const tooltipStyle = {
  background: 'var(--app-surface-strong)',
  border: '1px solid var(--app-border)',
  borderRadius: 18,
  fontSize: 11,
  boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
}

const tickStyle = { fill: 'var(--app-muted)', fontSize: 11 }

export function ReportsView() {
  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Insights</span>
          <h1 className="page-title page-title-compact">Reports & Insights</h1>
          <p className="page-subtitle">A cleaner reporting layer with open spacing and orange-led data emphasis.</p>
        </div>
        <div className="page-toolbar">
          <button className="btn-soft">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            This Week
          </button>
          <button className="btn-primary">
            <span className="material-symbols-outlined text-sm">download</span>
            Export PDF
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Budget" value="$3.7M" subLabel="Approved allocation" />
        <KpiCard label="Total Spent" value="$2.4M" subLabel="65% consumed" subType="warning" accentColor="#f97316" />
        <KpiCard label="Budget Remaining" value="$1.3M" subLabel="35% left" subType="success" />
        <KpiCard label="OT Liability (Week)" value="$48,200" subLabel="+22% vs last week" subType="warning" accentColor="#f97316" />
        <KpiCard label="Avg Daily Burn" value="$57,000" subLabel="Projected final: $3.9M" subType="critical" accentColor="#ef4444" />
        <KpiCard label="Days Remaining" value="26" subLabel="End: Week 10" accentColor="#18181b" />
      </section>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-8">
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Production Burn Rate</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Actual versus planned by week</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burnData}>
                  <defs>
                    <linearGradient id="reportsBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-accent)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--chart-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={value => `$${value}K`} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--app-text)' }} />
                  <Area dataKey="planned" stroke="var(--chart-muted)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Area dataKey="actual" stroke="var(--chart-accent)" fill="url(#reportsBurn)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Surface variant="warning" padding="lg" className="h-full">
            <div className="mb-6">
              <p className="section-title">OT Cost Trend</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Daily movement across the current week</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={otTrend}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={value => [`$${Number(value ?? 0).toLocaleString()}`, 'OT Cost']} />
                  <Line dataKey="cost" stroke="var(--chart-accent)" strokeWidth={2.5} dot={{ fill: 'var(--chart-accent)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        <div className="col-span-12">
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Department Budget vs Actual</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Full production comparison with variance context</p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptSpend} barGap={6}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={value => [`$${(Number(value ?? 0) / 1000).toFixed(0)}K`]} />
                  <Bar dataKey="budget" fill="var(--chart-muted)" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="actual" fill="var(--chart-accent)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-4 font-semibold">Department</th>
                    <th className="pb-4 text-right font-semibold">Budget</th>
                    <th className="pb-4 text-right font-semibold">Actual</th>
                    <th className="pb-4 text-right font-semibold">Variance</th>
                    <th className="pb-4 text-right font-semibold">% Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {deptSpend.map(dept => {
                    const variance = dept.actual - dept.budget
                    const pctUsed = Math.round((dept.actual / dept.budget) * 100)

                    return (
                      <tr key={dept.dept}>
                        <td className="py-4 font-medium text-zinc-900 dark:text-white">{dept.dept}</td>
                        <td className="py-4 text-right text-zinc-500 dark:text-zinc-400">${(dept.budget / 1000).toFixed(0)}K</td>
                        <td className="py-4 text-right text-zinc-900 dark:text-white">${(dept.actual / 1000).toFixed(0)}K</td>
                        <td className={`py-4 text-right font-semibold ${variance > 0 ? 'text-red-500 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                          {variance > 0 ? '+' : ''}${Math.abs(variance / 1000).toFixed(0)}K
                        </td>
                        <td className={`py-4 text-right font-semibold ${pctUsed > 100 ? 'text-red-500 dark:text-red-400' : pctUsed > 85 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-900 dark:text-white'}`}>
                          {pctUsed}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>
      </section>
    </div>
  )
}
