import { useTransportData } from '../hooks/useTransportData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useAlertStore } from '@/features/alerts/alert.store'
import { formatCurrency, cn } from '@/utils'
import type { TripUI, FuelLogUI } from '@/types'

const legendItems = [
  { colorClass: 'bg-emerald-500', label: 'Moving' },
  { colorClass: 'bg-orange-500', label: 'Idle' },
  { colorClass: 'bg-red-500', label: 'Exception' },
]

export function TransportView() {
  const { isLoading, isError, kpis, trips, fuelLogs } = useTransportData()
  const allAlerts = useAlertStore(s => s.alerts)
  const transportAlerts = allAlerts.filter(a => a.source === 'transport' && !a.acknowledged)

  if (isLoading) return <LoadingState message="Loading Fleet Data..." />
  if (isError) return <ErrorState message="Could not load transport data" />

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Logistics Control</span>
          <h1 className="page-title page-title-compact">Transport & Logistics</h1>
          <p className="page-subtitle">Fleet movement, trip logging, fuel visibility, and driver activity in an open operational layout.</p>
        </div>
        <div className="page-toolbar">
          <button className="btn-soft">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filters
          </button>
          <button className="btn-primary">Export Report</button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Active Vehicles" value={String(kpis.activeVehicles)} subLabel="92% operational" subType="success" accentColor="#f97316" />
        <KpiCard label="In Transit" value={String(kpis.inTransit)} subLabel="On-time movement" accentColor="#18181b" />
        <KpiCard label="Idle Vehicles" value={String(kpis.idleVehicles)} subLabel="Awaiting dispatch" subType="warning" />
        <KpiCard label="Trips Today" value={String(kpis.tripsToday)} subLabel="+12% vs yesterday" accentColor="#f97316" />
        <KpiCard label="Total Distance" value={`${kpis.totalDistanceKm.toLocaleString()} km`} subLabel={`Avg ${(kpis.totalDistanceKm / kpis.tripsToday).toFixed(1)} km/trip`} />
        <KpiCard label="Fuel Cost" value={formatCurrency(kpis.fuelCost)} subLabel={kpis.fuelBurnStatus === 'critical' ? 'High burn rate' : 'Within budget'} subType={kpis.fuelBurnStatus === 'critical' ? 'critical' : 'success'} accentColor={kpis.fuelBurnStatus === 'critical' ? '#ef4444' : '#f97316'} />
      </section>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 xl:col-span-8">
          <Surface variant="table" padding="none" className="overflow-hidden">
            <div className="relative h-[360px] bg-[linear-gradient(180deg,#fafafa,white)] dark:bg-[linear-gradient(180deg,#18181b,#111111)]">
              <div className="absolute left-5 top-5 z-10 rounded-full bg-zinc-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-white dark:text-zinc-900">
                Live tracking active
              </div>

              <div className="absolute inset-0 opacity-40 dark:opacity-20">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`row-${index}`} className="absolute left-0 right-0 border-t border-zinc-200 dark:border-zinc-800" style={{ top: `${(index + 1) * 12.5}%` }} />
                ))}
                {Array.from({ length: 12 }).map((_, index) => (
                  <div key={`col-${index}`} className="absolute bottom-0 top-0 border-l border-zinc-200 dark:border-zinc-800" style={{ left: `${(index + 1) * 8.33}%` }} />
                ))}
              </div>

              <div className="absolute" style={{ top: '35%', left: '28%' }}>
                <span className="material-symbols-outlined text-4xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-900 dark:text-white">V-02</div>
              </div>
              <div className="absolute" style={{ top: '52%', right: '33%' }}>
                <span className="material-symbols-outlined text-4xl text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_taxi</span>
                <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-900 dark:text-white">GT-01</div>
              </div>
              <div className="absolute" style={{ bottom: '28%', right: '26%' }}>
                <span className="material-symbols-outlined text-4xl text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>

              <div className="absolute bottom-5 left-5 flex flex-wrap gap-3 rounded-full bg-white/90 px-4 py-2 shadow-soft dark:bg-zinc-950/90">
                {legendItems.map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    <span className={cn('h-2 w-2 rounded-full', item.colorClass)} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-title">Trip Logs</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Live trip status with driver and distance detail</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Updated 2 min ago</span>
            </div>
            <DataTable<TripUI>
              columns={[
                { key: 'vehicleName', label: 'Vehicle', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.vehicleName}</span> },
                { key: 'driverName', label: 'Driver' },
                { key: 'durationLabel', label: 'Time' },
                { key: 'distanceKm', label: 'Dist.', align: 'right', render: row => `${row.distanceKm}km` },
                { key: 'status', label: 'Status', align: 'right', render: row => <StatusBadge variant={row.status} /> },
              ]}
              data={trips}
              getKey={row => row.id}
            />
          </Surface>
        </div>

        <div className="col-span-12 space-y-8 xl:col-span-4">
          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Actions</p>
                <h2 className="section-title">Quick Actions</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { icon: 'add_location', label: 'Add New Trip' },
                { icon: 'receipt_long', label: 'Upload Fuel Log' },
                { icon: 'person_add', label: 'Assign Driver' },
              ].map(action => (
                <button
                  key={action.label}
                  className="flex w-full items-center gap-3 rounded-[24px] bg-zinc-50 px-5 py-4 text-left text-sm font-medium text-zinc-900 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                >
                  <span className="material-symbols-outlined text-lg">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Priority</p>
                <h2 className="section-title">Exceptions & Alerts</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { severity: 'critical', icon: 'error', title: 'Fuel Anomaly', desc: 'Generator Truck 2: Consumption spike (+40%)' },
                { severity: 'critical', icon: 'distance', title: 'Geo-fence Violation', desc: 'Outstation allowance triggered - Vehicle #021' },
                { severity: 'warning', icon: 'timer', title: 'Idle Delay', desc: 'Vanity Van 2: Stationary for 45 mins' },
              ].map(item => (
                <div
                  key={item.title}
                  className={cn(
                    'rounded-[26px] px-5 py-4',
                    item.severity === 'critical'
                      ? 'bg-red-50 dark:bg-red-500/10'
                      : 'bg-orange-50 dark:bg-orange-500/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('material-symbols-outlined text-[20px]', item.severity === 'critical' ? 'text-red-500 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
                      {item.icon}
                    </span>
                    <div>
                      <div className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', item.severity === 'critical' ? 'text-red-500 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
                        {item.title}
                      </div>
                      <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
              {transportAlerts.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No live transport alerts.</p>}
            </div>
          </div>

          <Surface variant="muted" padding="md">
            <div className="mb-5">
              <p className="section-title">Efficiency Trends</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Key movement and fuel signals at a glance</p>
            </div>
            <div className="space-y-5">
              {[
                { label: 'Avg Mileage', value: '14.2 km/L', percent: 75, color: 'bg-zinc-900 dark:bg-white' },
                { label: 'Fuel Spend Trend', value: '+5.2%', percent: 50, color: 'bg-orange-500' },
              ].map(item => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
                    <span className="text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    <span className="text-zinc-900 dark:text-white">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className={cn('h-full rounded-full', item.color)} style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </section>

      <section className="space-y-8">
        <Surface variant="table" padding="lg">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="section-title">Fuel Audit Ledger</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Audited mileage and variance tracking for logged fuel entries</p>
            </div>
            <button className="btn-ghost px-0">View Full Ledger</button>
          </div>
          <DataTable<FuelLogUI>
            columns={[
              { key: 'date', label: 'Entry Date', render: row => <span className="text-zinc-500 dark:text-zinc-400">{row.date}</span> },
              { key: 'vehicleName', label: 'Vehicle ID', render: row => <span className="font-medium uppercase text-zinc-900 dark:text-white">{row.vehicleName}</span> },
              { key: 'litres', label: 'Litres', render: row => `${row.litres}L` },
              { key: 'expectedMileage', label: 'Exp. Mileage', render: row => <span className="text-zinc-500 dark:text-zinc-400">{row.expectedMileage} km/L</span> },
              { key: 'actualMileage', label: 'Actual', render: row => <span className={row.efficiencyRating === 'good' ? 'text-zinc-900 dark:text-white' : 'font-semibold text-red-500 dark:text-red-400'}>{row.actualMileage} km/L</span> },
              {
                key: 'auditStatus',
                label: 'Status',
                align: 'right',
                render: row => (row.efficiencyRating === 'good' ? <StatusBadge variant="verified" label="Verified" /> : <StatusBadge variant="mismatch" label="Mismatch" />),
              },
            ]}
            data={fuelLogs}
            getKey={row => row.id}
          />
        </Surface>

        <div>
          <div className="section-heading">
            <div>
              <p className="section-kicker">Drivers</p>
              <h2 className="section-title">Driver Activity & Overtime</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { name: 'Robert M.', shift: '11.5 hrs', status: 'OT Triggered', statusClass: 'bg-orange-500 text-black' },
              { name: 'Linda V.', shift: '6.2 hrs', status: 'In Range', statusClass: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' },
              { name: 'Karthik R.', shift: '8.0 hrs', status: 'Idle Warning', statusClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
              { name: 'David W.', shift: 'Last active: 2h', status: 'Off Duty', statusClass: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
            ].map(driver => (
              <div key={driver.name} className="rounded-[28px] bg-zinc-50 p-5 dark:bg-zinc-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-bold text-zinc-900 dark:bg-zinc-950 dark:text-white">
                    {driver.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{driver.name}</span>
                      <span className={cn('rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]', driver.statusClass)}>
                        {driver.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{driver.shift}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
