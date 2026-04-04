import { useTransportData } from '../hooks/useTransportData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { formatCurrency } from '@/utils'
import type { TripUI, FuelLogUI } from '@/types'

export function TransportView() {
  const { isLoading, isError, kpis, trips, fuelLogs, vehicles, rawAlerts } = useTransportData()
  const hasData = trips.length > 0 || fuelLogs.length > 0 || vehicles.length > 0 || rawAlerts.length > 0

  if (isLoading) return <LoadingState message="Loading fleet data..." />
  if (isError) return <ErrorState message="Could not load transport data" />

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Logistics Control</span>
          <h1 className="page-title page-title-compact">Transport & Logistics</h1>
          <p className="page-subtitle">Fleet movement, trip logging, and fuel auditing are now ready for real transport records instead of seeded demo entries.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Active Vehicles" value={String(kpis.activeVehicles)} subLabel="Derived from live fleet records" />
        <KpiCard label="In Transit" value={String(kpis.inTransit)} subLabel="Trips with active status" />
        <KpiCard label="Idle Vehicles" value={String(kpis.idleVehicles)} subLabel="Vehicles not currently moving" />
        <KpiCard label="Trips Today" value={String(kpis.tripsToday)} subLabel="Recorded transport trips" />
        <KpiCard label="Total Distance" value={`${kpis.totalDistanceKm.toLocaleString()} km`} subLabel="Summed from trip logs" />
        <KpiCard label="Fuel Cost" value={formatCurrency(kpis.fuelCost)} subLabel="Derived from fuel logs" />
      </section>

      {!hasData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="local_shipping"
            title="No transport data yet"
            description="The seeded trips, fuel logs, alerts, and driver cards have been removed. Start wiring transport tables to test this module with real project data."
          />
        </Surface>
      ) : (
        <div className="space-y-8">
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Trip Logs</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Live trip status with driver and distance detail.</p>
            </div>
            <DataTable<TripUI>
              columns={[
                { key: 'vehicleName', label: 'Vehicle', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.vehicleName}</span> },
                { key: 'driverName', label: 'Driver' },
                { key: 'durationLabel', label: 'Time' },
                { key: 'distanceKm', label: 'Distance', align: 'right', render: row => `${row.distanceKm} km` },
                { key: 'status', label: 'Status', align: 'right', render: row => <StatusBadge variant={row.status} /> },
              ]}
              data={trips}
              getKey={row => row.id}
            />
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Fuel Audit Ledger</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Mileage and variance tracking for logged fuel entries.</p>
            </div>
            <DataTable<FuelLogUI>
              columns={[
                { key: 'date', label: 'Entry Date' },
                { key: 'vehicleName', label: 'Vehicle' },
                { key: 'litres', label: 'Litres', render: row => `${row.litres}L` },
                { key: 'expectedMileage', label: 'Expected', render: row => `${row.expectedMileage} km/L` },
                { key: 'actualMileage', label: 'Actual', render: row => `${row.actualMileage} km/L` },
                {
                  key: 'auditStatus',
                  label: 'Status',
                  align: 'right',
                  render: row => <StatusBadge variant={row.efficiencyRating === 'good' ? 'verified' : 'mismatch'} label={row.auditStatus} />,
                },
              ]}
              data={fuelLogs}
              getKey={row => row.id}
            />
          </Surface>
        </div>
      )}
    </div>
  )
}
