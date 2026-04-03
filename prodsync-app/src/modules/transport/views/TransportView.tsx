import { useTransportData } from '../hooks/useTransportData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useAlertStore } from '@/features/alerts/alert.store'
import { formatCurrency, cn } from '@/utils'
import type { TripUI, FuelLogUI } from '@/types'

export function TransportView() {
  const { isLoading, isError, kpis, trips, fuelLogs, rawAlerts } = useTransportData()
  const allAlerts = useAlertStore(s => s.alerts)
  const transportAlerts = allAlerts.filter(a => a.source === 'transport' && !a.acknowledged)

  if (isLoading) return <LoadingState message="Loading Fleet Data..." />
  if (isError) return <ErrorState message="Could not load transport data" />

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Transport & Logistics</h1>
          <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Fleet · Trips · Fuel · Allowance Monitoring</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-[#2a2a2a] border border-white/10 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">filter_list</span> Filters
          </button>
          <button className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors">
            Export Report
          </button>
        </div>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Active Vehicles" value={String(kpis.activeVehicles)} subLabel="92% Operational" subType="success" accentColor="white" />
        <KpiCard label="In Transit" value={String(kpis.inTransit)} subLabel="On-time" />
        <KpiCard label="Idle Vehicles" value={String(kpis.idleVehicles)} subLabel="Awaiting Dispatch" subType="warning" />
        <KpiCard label="Trips Today" value={String(kpis.tripsToday)} subLabel="+12% vs Yesterday" />
        <KpiCard label="Total Distance" value={`${kpis.totalDistanceKm.toLocaleString()} km`} subLabel={`Avg ${(kpis.totalDistanceKm / kpis.tripsToday).toFixed(1)} km/trip`} />
        <KpiCard label="Fuel Cost" value={formatCurrency(kpis.fuelCost)} subLabel={kpis.fuelBurnStatus === 'critical' ? 'High Burn Rate!' : 'Within Budget'} subType={kpis.fuelBurnStatus === 'critical' ? 'critical' : 'success'} />
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Map + Tables */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Fleet Map Placeholder */}
          <div className="bg-[#131313] border border-white/5 rounded-sm overflow-hidden relative" style={{ height: 320 }}>
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-black/70 backdrop-blur px-3 py-1.5 border border-white/10 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Live Tracking Active</span>
              </div>
            </div>
            <div className="w-full h-full bg-[#0e0e0e] flex items-center justify-center relative">
              {/* Grid lines for map feel */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="absolute border-t border-white/20" style={{ top: `${(i + 1) * 12.5}%`, left: 0, right: 0 }} />
                ))}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="absolute border-l border-white/20" style={{ left: `${(i + 1) * 8.33}%`, top: 0, bottom: 0 }} />
                ))}
              </div>
              {/* Vehicle markers */}
              <div className="absolute" style={{ top: '35%', left: '28%' }}>
                <span className="material-symbols-outlined text-3xl text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                <div className="text-[9px] text-white font-bold uppercase text-center mt-1">V-02</div>
              </div>
              <div className="absolute" style={{ top: '52%', right: '33%' }}>
                <span className="material-symbols-outlined text-3xl text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>local_taxi</span>
                <div className="text-[9px] text-white font-bold uppercase text-center mt-1">GT-01</div>
              </div>
              <div className="absolute" style={{ bottom: '28%', right: '26%' }}>
                <span className="material-symbols-outlined text-3xl text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              {/* Legend */}
              <div className="absolute bottom-4 left-4 flex gap-4">
                {[['emerald-400', 'Moving'], ['amber-400', 'Idle'], ['red-400', 'Exception']].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-white/40">
                    <span className={cn(`w-2 h-2 rounded-full bg-${color}`)} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trip Logs Table */}
          <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-black tracking-widest uppercase text-white">Trip Logs</h2>
              <span className="text-[10px] text-white/30">Last updated 2 mins ago</span>
            </div>
            <DataTable<TripUI>
              columns={[
                { key: 'vehicleName', label: 'Vehicle', render: r => <span className="font-medium text-white">{r.vehicleName}</span> },
                { key: 'driverName', label: 'Driver' },
                { key: 'durationLabel', label: 'Time' },
                { key: 'distanceKm', label: 'Dist.', align: 'right', render: r => `${r.distanceKm}km` },
                { key: 'status', label: 'Status', align: 'right', render: r => (
                  <StatusBadge variant={r.status} />
                )},
              ]}
              data={trips}
              getKey={r => r.id}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Quick Actions */}
          <div className="bg-white p-5 rounded-sm text-black">
            <h2 className="text-xs font-black tracking-widest uppercase mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { icon: 'add_location', label: 'Add New Trip' },
                { icon: 'receipt_long', label: 'Upload Fuel Log' },
                { icon: 'person_add', label: 'Assign Driver' },
              ].map(action => (
                <button key={action.label} className="flex items-center gap-3 w-full py-3 px-4 bg-black/5 hover:bg-black/10 border border-black/10 transition-colors text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-lg">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exceptions */}
          <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
            <h2 className="text-xs font-black tracking-widest uppercase text-white mb-4">Exceptions & Alerts</h2>
            <div className="space-y-3">
              {[
                { severity: 'critical', icon: 'error', title: 'Fuel Anomaly', desc: 'Generator Truck 2: Consumption spike (+40%)' },
                { severity: 'critical', icon: 'distance', title: 'Geo-fence Violation', desc: 'Outstation allowance triggered - Vehicle #021' },
                { severity: 'warning', icon: 'timer', title: 'Idle Delay', desc: 'Vanity Van 2: Stationary > 45 mins' },
              ].map((a, i) => (
                <div key={i} className={cn('border p-3 rounded-sm flex items-start gap-3', a.severity === 'critical' ? 'bg-red-950/30 border-red-900/50' : 'bg-amber-950/30 border-amber-900/50')}>
                  <span className={cn('material-symbols-outlined text-lg', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')}>{a.icon}</span>
                  <div>
                    <div className={cn('text-[11px] font-bold uppercase tracking-wide', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')}>{a.title}</div>
                    <div className="text-[12px] text-white">{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Efficiency Trends */}
          <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
            <h2 className="text-xs font-black tracking-widest uppercase text-white mb-4">Efficiency Trends</h2>
            <div className="space-y-4">
              {[
                { label: 'Avg Mileage', value: '14.2 km/L', percent: 75, color: 'bg-white' },
                { label: 'Fuel Spend Trend', value: '+5.2%', percent: 50, color: 'bg-red-500' },
              ].map(t => (
                <div key={t.label}>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                    <span className="text-white/40">{t.label}</span>
                    <span className={t.color === 'bg-red-500' ? 'text-red-400' : 'text-white'}>{t.value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 overflow-hidden rounded-full">
                    <div className={cn('h-full rounded-full', t.color)} style={{ width: `${t.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fuel Audit Table */}
      <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-black tracking-widest uppercase text-white">Fuel Audit Ledger</h2>
          <button className="text-[10px] font-bold text-white/50 uppercase border-b border-white/20 hover:text-white transition-colors">View Full Ledger</button>
        </div>
        <DataTable<FuelLogUI>
          columns={[
            { key: 'date', label: 'Entry Date', render: r => <span className="text-white/40">{r.date}</span> },
            { key: 'vehicleName', label: 'Vehicle ID', render: r => <span className="font-bold text-white uppercase">{r.vehicleName}</span> },
            { key: 'litres', label: 'Litres', render: r => `${r.litres}L` },
            { key: 'expectedMileage', label: 'Exp. Mileage', render: r => <span className="text-white/40">{r.expectedMileage} km/L</span> },
            { key: 'actualMileage', label: 'Actual', render: r => (
              <span className={r.efficiencyRating === 'good' ? 'text-white' : 'text-red-400 font-bold'}>{r.actualMileage} km/L</span>
            )},
            { key: 'auditStatus', label: 'Status', align: 'right', render: r => (
              r.efficiencyRating === 'good'
                ? <StatusBadge variant="verified" label="Verified" />
                : <StatusBadge variant="mismatch" label="Mismatch" />
            )},
          ]}
          data={fuelLogs}
          getKey={r => r.id}
        />
      </div>

      {/* Driver Activity */}
      <div className="bg-[#131313] border border-white/5 p-5 rounded-sm">
        <h2 className="text-sm font-black tracking-widest uppercase text-white mb-5">Driver Activity & Overtime</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { name: 'Robert M.', shift: '11.5 hrs', status: 'OT TRIGGERED', statusClass: 'bg-red-600 text-white' },
            { name: 'Linda V.', shift: '6.2 hrs', status: 'IN RANGE', statusClass: 'text-emerald-400 font-bold' },
            { name: 'Karthik R.', shift: '8.0 hrs', status: 'IDLE WARNING', statusClass: 'bg-amber-600 text-white' },
            { name: 'David W.', shift: 'Last Active: 2h', status: 'OFF DUTY', statusClass: 'text-white/30 font-bold' },
          ].map((d, i) => (
            <div key={i} className={cn('flex items-center gap-4', i < 3 && 'border-r border-white/5 pr-5')}>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-white shrink-0">
                {d.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-white uppercase">{d.name}</span>
                  <span className={cn('text-[8px] px-1.5 py-0.5 rounded-sm', d.statusClass)}>{d.status}</span>
                </div>
                <div className="text-[9px] text-white/30 uppercase">{d.shift}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
