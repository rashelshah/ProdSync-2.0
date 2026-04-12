import { formatCurrency, formatTime } from '@/utils'
import type { AlertItem, ActivityEvent, ProjectRecord } from '@/types'

export interface MissionControlMobileProps {
  kpis: any
  deptSnapshots: any[]
  pendingApprovals: any[]
  alerts: AlertItem[]
  events: ActivityEvent[]
  activeProject: ProjectRecord | null
}

export function MissionControlMobile({ kpis, pendingApprovals, alerts, events, activeProject }: MissionControlMobileProps) {
  const activeProductionHero = (
    <div className="rounded-[24px] bg-white dark:bg-[#1a1c1e] border border-zinc-200 dark:border-white/5 p-5 relative overflow-hidden shadow-sm">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <p className="text-[8px] font-bold tracking-[0.2em] text-zinc-500 uppercase mb-1">Active Production</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Project: {activeProject?.name ?? 'No project'}</p>
        </div>
        <span className="px-2 py-1 rounded bg-orange-100 dark:bg-[#3a2215] border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-500 text-[8px] font-bold tracking-widest uppercase">Live Status</span>
      </div>
      <div className="flex flex-col gap-2 mt-6 relative z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-zinc-500">location_on</span>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{activeProject?.location ?? 'Unknown Region'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-zinc-500">layers</span>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{activeProject?.status ?? 'Pre-Production'}</span>
        </div>
      </div>
    </div>
  )

  const quickStatsRow = (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="rounded-[24px] bg-white dark:bg-[#1a1c1e] border border-orange-200 dark:border-orange-500/30 p-5 shadow-sm">
        <span className="material-symbols-outlined text-orange-500 mb-2 text-[28px] leading-none">warning</span>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight font-headline">{alerts.length} Alerts</p>
        <p className="text-[8px] font-bold tracking-[0.15em] text-zinc-500 uppercase mt-1">Critical Priority</p>
      </div>
      <div className="rounded-[24px] bg-white dark:bg-[#1a1c1e] border border-zinc-200 dark:border-white/5 p-5 shadow-sm">
        <span className="material-symbols-outlined text-orange-400 mb-2 text-[28px] leading-none">bolt</span>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight font-headline">{events.length} Activity</p>
        <p className="text-[8px] font-bold tracking-[0.15em] text-zinc-500 uppercase mt-1">Events Today</p>
      </div>
    </div>
  )

  const getDynamicStyle = (val: string | number) => {
    const len = String(val).length
    return { fontSize: len >= 13 ? '0.9rem' : len >= 11 ? '1.05rem' : len >= 9 ? '1.25rem' : len >= 7 ? '1.45rem' : '1.8rem' }
  }

  const budgetActualStr = formatCurrency(kpis?.budgetActualUSD ?? 0)
  const todaySpendStr = formatCurrency(kpis?.todaySpendUSD ?? 0)
  const cashFlowStr = formatCurrency(kpis?.cashFlowUSD ?? 0)
  const otCostStr = formatCurrency(kpis?.otCostTodayUSD ?? 0)
  const activeOpsStr = `${kpis?.activeCrew ?? 0} Crew • ${pendingApprovals.length} Approvals`

  const keyMetricsGrid = (
    <div className="mt-8 px-1">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[13px] font-bold tracking-tight text-zinc-900 dark:text-white">Key Metrics</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Budget vs Actual</span>
          <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 whitespace-nowrap w-full tracking-tighter" style={getDynamicStyle(budgetActualStr)}>{budgetActualStr}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Today's Spend</span>
          <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 whitespace-nowrap w-full tracking-tighter" style={getDynamicStyle(todaySpendStr)}>{todaySpendStr}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Cash Flow</span>
          <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 whitespace-nowrap w-full tracking-tighter" style={getDynamicStyle(cashFlowStr)}>{cashFlowStr}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">OT Cost Today</span>
          <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 whitespace-nowrap w-full tracking-tighter" style={getDynamicStyle(otCostStr)}>{otCostStr}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between col-span-2">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Active Operations</span>
          <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 whitespace-nowrap overflow-hidden text-ellipsis w-full tracking-tighter" style={getDynamicStyle(activeOpsStr)}>
            {activeOpsStr}
          </div>
        </div>
      </div>
    </div>
  )

  const prioritySignals = (
    <div className="mt-8 px-1">
      <h3 className="text-[13px] font-bold tracking-tight text-zinc-900 dark:text-white mb-4">Latest Priority Signals</h3>
      <div className="flex flex-col gap-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">No active alerts.</p>
        ) : (
          alerts.slice(0, 4).map(alert => (
            <div key={alert.id} className="relative flex min-h-[72px] items-start gap-4 overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${alert.severity === 'critical' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                <span className="material-symbols-outlined text-[20px]">
                  {alert.severity === 'critical' ? 'error' : 'warning'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {alert.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                  </span>
                  <span className="text-[10px] text-zinc-500 line-clamp-1">— {alert.message}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )

  const recentFeed = (
    <div className="mt-8 px-1">
      <h3 className="text-[13px] font-bold tracking-tight text-zinc-900 dark:text-white mb-4">Recent Project Feed</h3>
      <div className="flex flex-col gap-3">
        {events.length === 0 ? (
           <p className="text-sm text-zinc-500 py-4">No feed items recorded yet.</p>
        ) : events.slice(0, 5).map(event => (
          <div key={event.id} className="rounded-[20px] bg-white dark:bg-[#1a1c1e] border border-zinc-200 dark:border-white/5 p-3 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-[42px] h-[42px] rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 flex items-center justify-center flex-shrink-0">
                 <span className="material-symbols-outlined text-[18px] text-zinc-500 dark:text-zinc-400">feed</span>
              </div>
              <div className="min-w-0 pr-2">
                 <p className="text-[12px] font-bold text-zinc-900 dark:text-white leading-tight truncate">{event.title}</p>
                 <p className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase mt-1.5 truncate">{event.module} • {formatTime(String(event.timestamp))}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-600 text-lg mr-2 flex-shrink-0">chevron_right</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col md:hidden pb-10 pt-4 px-4 min-h-screen">
      
      {/* Universal Page Header */}
      <header className="mb-6">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <span className="page-kicker text-orange-500">Executive Control</span>
          <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Mission Control</h1>
          <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
            Real-time production oversight
          </p>
        </div>
      </header>

      {activeProductionHero}
      {quickStatsRow}
      {keyMetricsGrid}
      {prioritySignals}
      {recentFeed}
    </div>
  )
}
