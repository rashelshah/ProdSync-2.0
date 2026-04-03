import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { KpiCard } from '@/components/shared/KpiCard'

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
  { day: 'Mon', cost: 4200 }, { day: 'Tue', cost: 3800 },
  { day: 'Wed', cost: 6100 }, { day: 'Thu', cost: 9200 },
  { day: 'Fri', cost: 12840 }, { day: 'Sat', cost: 5400 }, { day: 'Sun', cost: 2100 },
]

const tooltipStyle = { background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, fontSize: 11 }
const tickStyle = { fill: 'rgba(255,255,255,0.3)', fontSize: 10 }

export function ReportsView() {
  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Reports & Insights</h1>
          <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Financial Burn · OT Liability · Budget Variance</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-[#2a2a2a] border border-white/10 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            This Week
          </button>
          <button className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export PDF
          </button>
        </div>
      </header>

      {/* Summary KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Budget" value="$3.7M" subLabel="Approved allocation" />
        <KpiCard label="Total Spent" value="$2.4M" subLabel="65% consumed" subType="warning" />
        <KpiCard label="Budget Remaining" value="$1.3M" subLabel="35% left" subType="success" />
        <KpiCard label="OT Liability (Week)" value="$48,200" subLabel="+22% vs last week" subType="warning" />
        <KpiCard label="Avg Daily Burn" value="$57,000" subLabel="Projected final: $3.9M" subType="critical" />
        <KpiCard label="Days Remaining" value="26" subLabel="End: Week 10" />
      </section>

      {/* Charts Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Production Burn — wide */}
        <div className="col-span-12 lg:col-span-8 bg-[#131313] border border-white/5 p-6 rounded-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Production Burn Rate</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Actual vs Planned — By Week</p>
            </div>
            <div className="flex gap-4 text-[10px] uppercase tracking-widest text-white/30">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white rounded-full" />Actual</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white/20 rounded-full" />Planned</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={burnData}>
              <defs>
                <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="95%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={v => `$${v}K`} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'rgba(255,255,255,0.6)' }} />
              <Area dataKey="planned" stroke="rgba(255,255,255,0.2)" fill="none" strokeDasharray="4 2" strokeWidth={1} />
              <Area dataKey="actual" stroke="rgba(255,255,255,0.9)" fill="url(#rptGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* OT Cost Trend — narrow */}
        <div className="col-span-12 lg:col-span-4 bg-[#131313] border border-white/5 p-6 rounded-sm">
          <div className="mb-6">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">OT Cost Trend</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Daily — This Week</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={otTrend}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, 'OT Cost']} />
              <Line dataKey="cost" stroke="rgba(255,68,68,0.8)" strokeWidth={2} dot={{ fill: '#ff4444', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dept Budget vs Actual */}
        <div className="col-span-12 bg-[#131313] border border-white/5 p-6 rounded-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Department Budget vs Actual</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Full production comparison</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={deptSpend} barGap={4}>
              <XAxis dataKey="dept" axisLine={false} tickLine={false} tick={tickStyle} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${(v / 1000).toFixed(0)}K`]} />
              <Bar dataKey="budget" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} name="Budget" />
              <Bar dataKey="actual" fill="rgba(255,255,255,0.85)" radius={[2, 2, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>

          {/* Table below chart */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-white/30 uppercase tracking-widest border-b border-white/5">
                  <th className="pb-3 font-bold">Department</th>
                  <th className="pb-3 font-bold text-right">Budget</th>
                  <th className="pb-3 font-bold text-right">Actual</th>
                  <th className="pb-3 font-bold text-right">Variance</th>
                  <th className="pb-3 font-bold text-right">% Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deptSpend.map(d => {
                  const variance = d.actual - d.budget
                  const pctUsed = Math.round((d.actual / d.budget) * 100)
                  return (
                    <tr key={d.dept} className="hover:bg-white/3 transition-colors">
                      <td className="py-3 font-medium text-white">{d.dept}</td>
                      <td className="py-3 text-right text-white/40">${(d.budget / 1000).toFixed(0)}K</td>
                      <td className="py-3 text-right text-white">${(d.actual / 1000).toFixed(0)}K</td>
                      <td className={`py-3 text-right font-bold ${variance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {variance > 0 ? '+' : ''}${Math.abs(variance / 1000).toFixed(0)}K
                      </td>
                      <td className={`py-3 text-right font-bold ${pctUsed > 100 ? 'text-red-400' : pctUsed > 85 ? 'text-amber-400' : 'text-white'}`}>
                        {pctUsed}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
