import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { transportService } from '@/services/transport.service'
import { formatCurrency, formatDate, formatTime } from '@/utils'
import { useTransportData } from '../hooks/useTransportData'
import { useTransportLiveTracking } from '../hooks/useTransportLiveTracking'
import type { FuelLogInput, FuelLogUI, TripFilters, TripUI, UpdateVehicleInput, Vehicle, VehicleStatus } from '../types'

const initialCoordinates = {
  latitude: '13.0827',
  longitude: '80.2707',
  address: '',
}

const initialTripFilters: TripFilters = {
  vehicleId: '',
  driverId: '',
  dateFrom: '',
  dateTo: '',
  status: '',
}

const emptyVehicleForm = {
  name: '',
  vehicleType: '',
  registrationNumber: '',
  capacity: '',
  assignedDriverUserId: '',
  baseLocation: '',
  status: 'idle' as VehicleStatus,
  notes: '',
}

const emptyTripStartForm = {
  vehicleId: '',
  driverId: '',
  odometerKm: '',
  origin: '',
  destination: '',
  purpose: '',
  ...initialCoordinates,
}

const emptyTripEndForm = {
  odometerKm: '',
  destination: '',
  ...initialCoordinates,
}

const emptyFuelForm = {
  vehicleId: '',
  tripId: '',
  liters: '',
  cost: '',
  odometerKm: '',
  notes: '',
  receiptImage: null as File | null,
  odometerImage: null as File | null,
}

export function TransportView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext } = useResolvedProjectContext()

  const [tripFilters, setTripFilters] = useState<TripFilters>(initialTripFilters)
  const {
    isLoading,
    isError,
    kpis,
    trips,
    fuelLogs,
    vehicles,
    alerts,
    drivers,
    canViewAlerts,
    canManageTransport,
    fuelFailed,
  } = useTransportData(tripFilters)

  const hasData = trips.length > 0 || fuelLogs.length > 0 || vehicles.length > 0 || alerts.length > 0
  const isDriver = user?.role === 'Driver' || user?.projectRoleTitle === 'Driver'

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [vehicleDetailId, setVehicleDetailId] = useState<string | null>(null)
  const [tripStartModalOpen, setTripStartModalOpen] = useState(false)
  const [tripEndTripId, setTripEndTripId] = useState<string | null>(null)
  const [fuelModalOpen, setFuelModalOpen] = useState(false)

  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm)
  const [tripStartForm, setTripStartForm] = useState(emptyTripStartForm)
  const [tripEndForm, setTripEndForm] = useState(emptyTripEndForm)
  const [fuelForm, setFuelForm] = useState(emptyFuelForm)

  const fuelByTripId = useMemo(() => {
    const summary = new Map<string, { liters: number; cost: number }>()

    for (const log of fuelLogs) {
      if (!log.tripId) {
        continue
      }

      const current = summary.get(log.tripId) ?? { liters: 0, cost: 0 }
      current.liters += log.liters
      current.cost += log.cost ?? 0
      summary.set(log.tripId, current)
    }

    return summary
  }, [fuelLogs])

  const activeTrips = useMemo(
    () => trips.filter(trip => trip.status === 'active'),
    [trips],
  )
  const visibleVehicles = useMemo(
    () => (isDriver ? vehicles.filter(vehicle => vehicle.assignedDriverUserId === user?.id) : vehicles),
    [isDriver, user?.id, vehicles],
  )
  const {
    liveLocations,
    mapImageUrl,
    mapLoading,
    streamState,
  } = useTransportLiveTracking({
    activeProjectId,
    activeTrips,
    canManageTransport,
    isDriver,
  })

  const selectedTripForEnd = activeTrips.find(trip => trip.id === tripEndTripId) ?? null
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleDetailId) ?? null

  useEffect(() => {
    if (!selectedVehicle) {
      return
    }

    setVehicleForm({
      name: selectedVehicle.name,
      vehicleType: selectedVehicle.vehicleType,
      registrationNumber: selectedVehicle.registrationNumber ?? '',
      capacity: selectedVehicle.capacity != null ? String(selectedVehicle.capacity) : '',
      assignedDriverUserId: selectedVehicle.assignedDriverUserId ?? '',
      baseLocation: selectedVehicle.baseLocation ?? '',
      status: selectedVehicle.status,
      notes: selectedVehicle.notes ?? '',
    })
  }, [selectedVehicle])

  const refreshProjectQueries = async () => {
    if (!activeProjectId) {
      return
    }

    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['trips', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['fuel-logs', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['vehicles', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['transport-alerts', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['transport-drivers', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['gps-logs', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['activity', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['alerts', activeProjectId] }),
    ])
  }

  const createVehicleMutation = useMutation({
    mutationFn: transportService.createVehicle,
    onSuccess: async () => {
      setVehicleModalOpen(false)
      setVehicleForm(emptyVehicleForm)
      await refreshProjectQueries()
    },
  })

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVehicleInput }) => transportService.updateVehicle(id, input),
    onSuccess: async () => {
      await refreshProjectQueries()
      setVehicleDetailId(null)
      setVehicleForm(emptyVehicleForm)
    },
  })

  const startTripMutation = useMutation({
    mutationFn: transportService.startTrip,
    onSuccess: async () => {
      setTripStartModalOpen(false)
      setTripStartForm(emptyTripStartForm)
      await refreshProjectQueries()
    },
  })

  const endTripMutation = useMutation({
    mutationFn: transportService.endTrip,
    onSuccess: async () => {
      setTripEndTripId(null)
      setTripEndForm(emptyTripEndForm)
      await refreshProjectQueries()
    },
  })

  const logFuelMutation = useMutation({
    mutationFn: transportService.logFuel,
    onSuccess: async () => {
      setFuelModalOpen(false)
      setFuelForm(emptyFuelForm)
      await refreshProjectQueries()
    },
  })

  const reviewFuelMutation = useMutation({
    mutationFn: ({ id, auditStatus }: { id: string; auditStatus: 'verified' | 'mismatch' }) =>
      transportService.reviewFuel(id, {
        projectId: activeProjectId ?? '',
        auditStatus,
      }),
    onSuccess: refreshProjectQueries,
  })

  if (isLoadingProjectContext) {
    return <LoadingState message="Resolving project access..." />
  }

  if (!activeProjectId || !activeProject) {
    return (
      <div className="page-shell">
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="workspaces"
            title="Select a project first"
            description="Transport records are project-scoped. Choose an active project from Projects Hub before starting trips or logging fuel."
          />
        </Surface>
      </div>
    )
  }

  if (isLoading) return <LoadingState message="Loading fleet data..." />
  if (isError) return <ErrorState message="Could not load transport data" />

  function submitVehicle() {
    if (!activeProjectId) {
      return
    }

    createVehicleMutation.mutate({
      projectId: activeProjectId,
      name: vehicleForm.name.trim(),
      vehicleType: vehicleForm.vehicleType.trim(),
      registrationNumber: vehicleForm.registrationNumber.trim() || undefined,
      capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
      assignedDriverUserId: vehicleForm.assignedDriverUserId || undefined,
      baseLocation: vehicleForm.baseLocation.trim() || undefined,
      status: vehicleForm.status,
      notes: vehicleForm.notes.trim() || undefined,
    })
  }

  function submitVehicleUpdate() {
    if (!activeProjectId || !selectedVehicle) {
      return
    }

    updateVehicleMutation.mutate({
      id: selectedVehicle.id,
      input: {
        projectId: activeProjectId,
        name: vehicleForm.name.trim(),
        vehicleType: vehicleForm.vehicleType.trim(),
        registrationNumber: vehicleForm.registrationNumber.trim() || undefined,
        capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
        assignedDriverUserId: vehicleForm.assignedDriverUserId || null,
        baseLocation: vehicleForm.baseLocation.trim() || undefined,
        status: vehicleForm.status,
        notes: vehicleForm.notes.trim() || undefined,
      },
    })
  }

  function submitTripStart() {
    if (!activeProjectId) {
      return
    }

    startTripMutation.mutate({
      projectId: activeProjectId,
      vehicleId: tripStartForm.vehicleId,
      driverId: canManageTransport && tripStartForm.driverId ? tripStartForm.driverId : undefined,
      odometerKm: tripStartForm.odometerKm ? Number(tripStartForm.odometerKm) : undefined,
      purpose: tripStartForm.purpose.trim() || undefined,
      origin: tripStartForm.origin.trim() || undefined,
      destination: tripStartForm.destination.trim() || undefined,
      startLocation: {
        latitude: Number(tripStartForm.latitude),
        longitude: Number(tripStartForm.longitude),
        address: tripStartForm.address.trim() || undefined,
      },
    })
  }

  function submitTripEnd() {
    if (!activeProjectId || !tripEndTripId) {
      return
    }

    endTripMutation.mutate({
      projectId: activeProjectId,
      tripId: tripEndTripId,
      odometerKm: Number(tripEndForm.odometerKm),
      destination: tripEndForm.destination.trim() || undefined,
      endLocation: {
        latitude: Number(tripEndForm.latitude),
        longitude: Number(tripEndForm.longitude),
        address: tripEndForm.address.trim() || undefined,
      },
    })
  }

  function submitFuelLog() {
    if (!activeProjectId || !fuelForm.receiptImage || !fuelForm.odometerImage) {
      return
    }

    const payload: FuelLogInput = {
      projectId: activeProjectId,
      vehicleId: fuelForm.vehicleId,
      liters: Number(fuelForm.liters),
      receiptImage: fuelForm.receiptImage,
      odometerImage: fuelForm.odometerImage,
    }

    if (fuelForm.tripId) payload.tripId = fuelForm.tripId
    if (fuelForm.cost) payload.cost = Number(fuelForm.cost)
    if (fuelForm.odometerKm) payload.odometerKm = Number(fuelForm.odometerKm)
    if (fuelForm.notes.trim()) payload.notes = fuelForm.notes.trim()

    logFuelMutation.mutate(payload)
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Logistics Control</span>
          <h1 className="page-title page-title-compact">Transport & Logistics</h1>
          <p className="page-subtitle">
            Live transport operations for <span className="font-semibold text-zinc-900 dark:text-white">{activeProject.name}</span>.
            Trips, fleet status, fuel audits, and transport alerts are sourced from the backend in real time.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageTransport && (
            <button onClick={() => {
              setVehicleForm(emptyVehicleForm)
              setVehicleModalOpen(true)
            }} className="btn-soft">
              Add Vehicle
            </button>
          )}
          {(isDriver || canManageTransport) && (
            <button onClick={() => setTripStartModalOpen(true)} className="btn-primary">
              Start Trip
            </button>
          )}
          {(isDriver || canManageTransport) && (
            <button onClick={() => setFuelModalOpen(true)} className="btn-soft">
              Log Fuel
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Active Vehicles" value={String(kpis.activeVehicles)} subLabel="Live fleet availability" />
        <KpiCard label="In Transit" value={String(kpis.inTransit)} subLabel="Currently active trips" />
        <KpiCard label="Idle Vehicles" value={String(kpis.idleVehicles)} subLabel="Not moving right now" />
        <KpiCard label="Trips Today" value={String(kpis.tripsToday)} subLabel="Project-only transport runs" />
        <KpiCard label="Total Distance" value={`${kpis.totalDistanceKm.toLocaleString()} km`} subLabel="Completed and active trips" />
        <KpiCard label="Fuel Cost" value={formatCurrency(kpis.fuelCost)} subLabel="Logged spend" />
      </section>

      {!hasData ? (
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="local_shipping"
            title="No transport data yet"
            description="Create a vehicle, start the first trip, or log fuel to populate this project's transport dashboard."
          />
        </Surface>
      ) : (
        <div className="space-y-8">
          <Surface variant="table" padding="lg">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-title">{isDriver ? 'My Assignment' : 'Fleet Management'}</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {isDriver
                    ? 'Your assigned vehicle stays front and center, with live trip streaming handled in the background.'
                    : 'Vehicle readiness, assigned drivers, and live transport status for the captain and producer.'}
                </p>
                {isDriver && (
                  <p className={`mt-3 text-sm ${streamState.status === 'error' ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {streamState.message}
                  </p>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {visibleVehicles.length} vehicle{visibleVehicles.length === 1 ? '' : 's'} tracked
              </p>
            </div>

            {visibleVehicles.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No vehicles added for this project yet.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleVehicles.map(vehicle => {
                  const status = deriveVehicleOperationalStatus(vehicle, activeTrips)

                  return (
                    <div
                      key={vehicle.id}
                      className="rounded-[28px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-zinc-900 dark:text-white">{vehicle.name}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{vehicle.vehicleType}</p>
                        </div>
                        <StatusBadge variant={mapVehicleStatus(status)} label={vehicleStatusLabel(status)} />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                        <Metric label="Vehicle Number" value={vehicle.registrationNumber ?? 'Not added'} />
                        <Metric label="Assigned Driver" value={vehicle.assignedDriverName ?? 'Unassigned'} />
                        <Metric label="Base" value={vehicle.baseLocation ?? 'Not set'} />
                        <Metric label="Category" value={vehicle.vehicleType} />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => setVehicleDetailId(vehicle.id)}
                          className="btn-soft px-4 py-2 text-xs"
                        >
                          View Details
                        </button>
                        {canManageTransport && (
                          <button
                            onClick={() => setVehicleDetailId(vehicle.id)}
                            className="btn-primary px-4 py-2 text-xs"
                          >
                            Assign Driver
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Surface>

          {canManageTransport && (
            <Surface variant="table" padding="lg">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="section-title">Live Tracking</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Real-time fleet tracking with socket updates, backend-rendered maps, and graceful fallback when premium routing is restricted.
                  </p>
                </div>
                <StatusBadge variant={liveLocations.length > 0 ? 'live' : 'pending'} label={liveLocations.length > 0 ? 'Live' : 'Standby'} />
              </div>

              <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                {mapImageUrl ? (
                  <img
                    src={mapImageUrl}
                    alt="Live fleet tracking map"
                    className="h-[320px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {mapLoading ? 'Refreshing the latest fleet map...' : 'Live map is waiting for the next active vehicle update.'}
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Active Fleet</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Select a vehicle from the live stream below and inspect its current checkpoint state.
                    </p>
                  </div>
                  <StatusBadge variant={liveLocations.length > 0 ? 'live' : 'pending'} label={`${liveLocations.length} live`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {liveLocations.length === 0 ? (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      No active vehicles are streaming right now. The map wakes up as soon as the next trip checkpoint arrives.
                    </span>
                  ) : (
                    liveLocations.map(location => (
                      <span
                        key={location.vehicleId}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        {location.vehicleName} | {location.driverName ?? 'Driver'} | {location.registrationNumber ?? 'No number'}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </Surface>
          )}

          <Surface variant="table" padding="lg">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-title">Trip History</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Active and completed journeys with live status, fuel linkage, idle time, and outstation detection.
                </p>
              </div>
              <button
                onClick={() => setTripFilters(initialTripFilters)}
                className="btn-soft px-4 py-2 text-xs"
              >
                Clear Filters
              </button>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SelectField
                label="Vehicle"
                value={tripFilters.vehicleId ?? ''}
                onChange={value => setTripFilters(current => ({ ...current, vehicleId: value }))}
                options={vehicles.map(vehicle => ({ value: vehicle.id, label: vehicle.name }))}
              />
              <SelectField
                label="Driver"
                value={tripFilters.driverId ?? ''}
                onChange={value => setTripFilters(current => ({ ...current, driverId: value }))}
                options={drivers.map(driver => ({ value: driver.userId, label: driver.fullName }))}
              />
              <DateField
                label="From"
                value={tripFilters.dateFrom ?? ''}
                onChange={value => setTripFilters(current => ({ ...current, dateFrom: value }))}
              />
              <DateField
                label="To"
                value={tripFilters.dateTo ?? ''}
                onChange={value => setTripFilters(current => ({ ...current, dateTo: value }))}
              />
              <SelectField
                label="Status"
                value={tripFilters.status ?? ''}
                onChange={value => setTripFilters(current => ({ ...current, status: value as TripFilters['status'] }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'flagged', label: 'Flagged' },
                  { value: 'planned', label: 'Planned' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>

            <DataTable<TripUI>
              columns={[
                { key: 'vehicleName', label: 'Vehicle', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.vehicleName}</span> },
                { key: 'driverName', label: 'Driver', render: row => row.driverName ?? 'Unassigned' },
                {
                  key: 'durationLabel',
                  label: 'Timeline',
                  render: row => (
                    <div className="space-y-1">
                      <p>{formatDate(row.startTime)} {formatTime(row.startTime)}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {row.endTime ? `${formatDate(row.endTime)} ${formatTime(row.endTime)}` : 'Live trip'}
                      </p>
                    </div>
                  ),
                },
                { key: 'distanceKm', label: 'Distance', align: 'right', render: row => `${row.distanceKm.toFixed(1)} km` },
                { key: 'duration', label: 'Duration', align: 'right', render: row => row.durationLabel },
                { key: 'idle', label: 'Idle', align: 'right', render: row => row.idleLabel },
                {
                  key: 'fuel',
                  label: 'Fuel',
                  render: row => {
                    const summary = fuelByTripId.get(row.id)
                    if (!summary) {
                      return 'No fuel log'
                    }

                    return `${summary.liters.toFixed(1)}L / ${formatCurrency(summary.cost)}`
                  },
                },
                {
                  key: 'flags',
                  label: 'Flags',
                  render: row => (
                    <div className="space-x-2">
                      <StatusBadge variant={mapTripStatus(row.status)} />
                      {row.outstationFlag && <StatusBadge variant="warning" label="Outstation" />}
                      {row.abnormalityScore >= 60 && <StatusBadge variant="flagged" label="Suspicious" />}
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Action',
                  align: 'right',
                  render: row => row.status === 'active' && (isDriver || canManageTransport) ? (
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        setTripEndTripId(row.id)
                      }}
                      className="btn-soft px-3 py-2 text-[10px]"
                    >
                      End Trip
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  ),
                },
              ]}
              data={trips}
              getKey={row => row.id}
            />
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Fuel Audit Ledger</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Receipt-backed fuel logs with fraud scoring, mileage validation, and captain review.
              </p>
            </div>
            {fuelFailed ? (
              <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500 dark:bg-red-500/20 dark:text-red-400">
                Fuel data unavailable. The service is currently experiencing issues.
              </div>
            ) : (
              <DataTable<FuelLogUI>
                columns={[
                  { key: 'logDate', label: 'Entry Date', render: row => formatDate(row.logDate) },
                  { key: 'vehicleName', label: 'Vehicle' },
                  { key: 'loggedByName', label: 'Driver', render: row => row.loggedByName ?? row.loggedBy },
                  { key: 'liters', label: 'Litres', render: row => `${row.liters.toFixed(1)}L` },
                  { key: 'cost', label: 'Cost', render: row => formatCurrency(row.cost ?? 0) },
                  { key: 'expectedMileage', label: 'Expected', render: row => `${row.expectedMileage.toFixed(1)} km/L` },
                  { key: 'actualMileage', label: 'Actual', render: row => `${row.actualMileage.toFixed(1)} km/L` },
                  {
                    key: 'auditStatus',
                    label: 'Status',
                    render: row => (
                      <div className="space-x-2">
                        <StatusBadge variant={row.efficiencyRating === 'good' ? 'verified' : 'mismatch'} label={row.auditStatus} />
                        {row.fraudStatus !== 'NORMAL' && <StatusBadge variant={row.fraudStatus === 'FRAUD' ? 'flagged' : 'warning'} label={row.fraudStatus} />}
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Action',
                    align: 'right',
                    render: row => canManageTransport ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            reviewFuelMutation.mutate({ id: row.id, auditStatus: 'verified' })
                          }}
                          className="btn-soft px-3 py-2 text-[10px]"
                          disabled={reviewFuelMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            reviewFuelMutation.mutate({ id: row.id, auditStatus: 'mismatch' })
                          }}
                          className="btn-soft px-3 py-2 text-[10px]"
                          disabled={reviewFuelMutation.isPending}
                        >
                          Flag
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    ),
                  },
                ]}
                data={fuelLogs}
                getKey={row => row.id}
              />
            )}
          </Surface>

          {canViewAlerts && (
            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Transport Alerts</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Fuel fraud, suspicious trips, and outstation triggers emitted by the backend.
                </p>
              </div>
              {alerts.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No active transport alerts for this project.</p>
              ) : (
                <div className="overflow-hidden rounded-[24px] border border-zinc-200 dark:border-zinc-800">
                  <div className="hidden grid-cols-[1.1fr,2.2fr,0.9fr,1fr,1.1fr] gap-4 bg-zinc-50 px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400 lg:grid">
                    <span>Alert Type</span>
                    <span>Details</span>
                    <span>Severity</span>
                    <span>Triggered At</span>
                    <span>Related Record</span>
                  </div>

                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {alerts.map(alert => (
                      <div key={alert.id} className={alertRowTone(alert.severity)}>
                        <div className="grid gap-4 lg:grid-cols-[1.1fr,2.2fr,0.9fr,1fr,1.1fr] lg:items-start">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:hidden">Alert Type</p>
                            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{prettifyAlertType(alert.alertType)}</p>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:hidden">Details</p>
                            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{alert.title}</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{alert.message}</p>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:hidden">Severity</p>
                            <div className="mt-1">
                              <span className={alertSeverityBadgeTone(alert.severity)}>
                                {alert.severity === 'warning' ? 'Medium' : alert.severity}
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:hidden">Triggered At</p>
                            <p className="mt-1 text-sm text-zinc-900 dark:text-white">{formatDate(alert.triggeredAt)}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatTime(alert.triggeredAt)}</p>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:hidden">Related Record</p>
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{resolveAlertReference(alert, vehicles, trips)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Surface>
          )}
        </div>
      )}

      {vehicleModalOpen && (
        <ModalShell title="Add Vehicle" onClose={() => setVehicleModalOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Vehicle Name" value={vehicleForm.name} onChange={value => setVehicleForm(current => ({ ...current, name: value }))} placeholder="Unit Van 01" />
            <TextField label="Category" value={vehicleForm.vehicleType} onChange={value => setVehicleForm(current => ({ ...current, vehicleType: value }))} placeholder="Pax Car / Vanity Van / Gen Truck" />
            <TextField label="Vehicle Number" value={vehicleForm.registrationNumber} onChange={value => setVehicleForm(current => ({ ...current, registrationNumber: value }))} placeholder="TN 09 AB 1234" />
            <TextField label="Capacity" value={vehicleForm.capacity} onChange={value => setVehicleForm(current => ({ ...current, capacity: value }))} placeholder="4" />
            <SelectField
              label="Assign Driver"
              value={vehicleForm.assignedDriverUserId}
              onChange={value => setVehicleForm(current => ({ ...current, assignedDriverUserId: value }))}
              options={drivers.map(driver => ({ value: driver.userId, label: driver.fullName }))}
            />
            <SelectField
              label="Status"
              value={vehicleForm.status}
              onChange={value => setVehicleForm(current => ({ ...current, status: value as VehicleStatus }))}
              options={[
                { value: 'idle', label: 'Idle' },
                { value: 'active', label: 'Active' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'exception', label: 'Exception' },
              ]}
            />
            <TextField label="Base Location" value={vehicleForm.baseLocation} onChange={value => setVehicleForm(current => ({ ...current, baseLocation: value }))} placeholder="Chennai base camp" />
            <TextField label="Notes" value={vehicleForm.notes} onChange={value => setVehicleForm(current => ({ ...current, notes: value }))} placeholder="Used for cast pickup" />
          </div>
          <ModalActions onClose={() => setVehicleModalOpen(false)} onSubmit={submitVehicle} submitLabel={createVehicleMutation.isPending ? 'Saving...' : 'Save Vehicle'} />
        </ModalShell>
      )}

      {selectedVehicle && (
        <ModalShell title={`Vehicle Details - ${selectedVehicle.name}`} onClose={() => setVehicleDetailId(null)}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Vehicle Name" value={vehicleForm.name} onChange={value => setVehicleForm(current => ({ ...current, name: value }))} />
            <TextField label="Category" value={vehicleForm.vehicleType} onChange={value => setVehicleForm(current => ({ ...current, vehicleType: value }))} />
            <TextField label="Vehicle Number" value={vehicleForm.registrationNumber} onChange={value => setVehicleForm(current => ({ ...current, registrationNumber: value }))} />
            <TextField label="Capacity" value={vehicleForm.capacity} onChange={value => setVehicleForm(current => ({ ...current, capacity: value }))} />
            <SelectField
              label="Assign Driver"
              value={vehicleForm.assignedDriverUserId}
              onChange={value => setVehicleForm(current => ({ ...current, assignedDriverUserId: value }))}
              options={drivers.map(driver => ({ value: driver.userId, label: driver.fullName }))}
            />
            <SelectField
              label="Status"
              value={vehicleForm.status}
              onChange={value => setVehicleForm(current => ({ ...current, status: value as VehicleStatus }))}
              options={[
                { value: 'idle', label: 'Idle' },
                { value: 'active', label: 'Active' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'exception', label: 'Exception' },
              ]}
            />
            <TextField label="Base Location" value={vehicleForm.baseLocation} onChange={value => setVehicleForm(current => ({ ...current, baseLocation: value }))} />
            <TextField label="Notes" value={vehicleForm.notes} onChange={value => setVehicleForm(current => ({ ...current, notes: value }))} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <Metric label="Operational Status" value={vehicleStatusLabel(deriveVehicleOperationalStatus(selectedVehicle, activeTrips))} />
            <Metric label="Current Driver" value={selectedVehicle.assignedDriverName ?? 'Unassigned'} />
            <Metric label="Active Trip" value={activeTrips.find(trip => trip.vehicleId === selectedVehicle.id)?.driverName ?? 'None'} />
            <Metric label="Base" value={selectedVehicle.baseLocation ?? 'Not set'} />
          </div>

          <ModalActions onClose={() => setVehicleDetailId(null)} onSubmit={submitVehicleUpdate} submitLabel={updateVehicleMutation.isPending ? 'Saving...' : 'Save Changes'} />
        </ModalShell>
      )}

      {tripStartModalOpen && (
        <ModalShell title="Start Trip" onClose={() => setTripStartModalOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Vehicle"
              value={tripStartForm.vehicleId}
              onChange={value => setTripStartForm(current => ({ ...current, vehicleId: value }))}
              options={vehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.name} (${vehicle.vehicleType})` }))}
            />
            {canManageTransport && (
              <SelectField
                label="Driver"
                value={tripStartForm.driverId}
                onChange={value => setTripStartForm(current => ({ ...current, driverId: value }))}
                options={drivers.map(driver => ({ value: driver.userId, label: driver.fullName }))}
              />
            )}
            <TextField label="Origin" value={tripStartForm.origin} onChange={value => setTripStartForm(current => ({ ...current, origin: value }))} placeholder="Production base" />
            <TextField label="Destination" value={tripStartForm.destination} onChange={value => setTripStartForm(current => ({ ...current, destination: value }))} placeholder="Location / airport / studio" />
            <TextField label="Start Latitude" value={tripStartForm.latitude} onChange={value => setTripStartForm(current => ({ ...current, latitude: value }))} />
            <TextField label="Start Longitude" value={tripStartForm.longitude} onChange={value => setTripStartForm(current => ({ ...current, longitude: value }))} />
            <TextField label="Address" value={tripStartForm.address} onChange={value => setTripStartForm(current => ({ ...current, address: value }))} placeholder="Set parking bay" />
            <TextField label="Start Odometer (km)" value={tripStartForm.odometerKm} onChange={value => setTripStartForm(current => ({ ...current, odometerKm: value }))} placeholder="12450" />
            <div className="md:col-span-2">
              <TextField label="Purpose" value={tripStartForm.purpose} onChange={value => setTripStartForm(current => ({ ...current, purpose: value }))} placeholder="Crew pickup / location run" />
            </div>
          </div>
          <ModalActions onClose={() => setTripStartModalOpen(false)} onSubmit={submitTripStart} submitLabel={startTripMutation.isPending ? 'Starting...' : 'Start Trip'} />
        </ModalShell>
      )}

      {selectedTripForEnd && (
        <ModalShell title={`End Trip - ${selectedTripForEnd.vehicleName}`} onClose={() => setTripEndTripId(null)}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Destination" value={tripEndForm.destination} onChange={value => setTripEndForm(current => ({ ...current, destination: value }))} placeholder="Wrap location" />
            <div />
            <TextField label="End Latitude" value={tripEndForm.latitude} onChange={value => setTripEndForm(current => ({ ...current, latitude: value }))} />
            <TextField label="End Longitude" value={tripEndForm.longitude} onChange={value => setTripEndForm(current => ({ ...current, longitude: value }))} />
            <TextField label="Address" value={tripEndForm.address} onChange={value => setTripEndForm(current => ({ ...current, address: value }))} placeholder="Wrap location" />
            <TextField label="End Odometer (km)" value={tripEndForm.odometerKm} onChange={value => setTripEndForm(current => ({ ...current, odometerKm: value }))} placeholder="12528" />
          </div>
          <ModalActions onClose={() => setTripEndTripId(null)} onSubmit={submitTripEnd} submitLabel={endTripMutation.isPending ? 'Ending...' : 'End Trip'} />
        </ModalShell>
      )}

      {fuelModalOpen && (
        <ModalShell title="Log Fuel" onClose={() => setFuelModalOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Vehicle"
              value={fuelForm.vehicleId}
              onChange={value => setFuelForm(current => ({ ...current, vehicleId: value }))}
              options={vehicles.map(vehicle => ({ value: vehicle.id, label: vehicle.name }))}
            />
            <SelectField
              label="Related Trip"
              value={fuelForm.tripId}
              onChange={value => setFuelForm(current => ({ ...current, tripId: value }))}
              options={[{ value: '', label: 'No linked trip' }, ...activeTrips.map(trip => ({ value: trip.id, label: `${trip.vehicleName} - ${trip.driverName ?? 'Driver'}` }))]}
            />
            <TextField label="Litres" value={fuelForm.liters} onChange={value => setFuelForm(current => ({ ...current, liters: value }))} placeholder="18.5" />
            <TextField label="Cost" value={fuelForm.cost} onChange={value => setFuelForm(current => ({ ...current, cost: value }))} placeholder="2200" />
            <TextField label="Odometer (km)" value={fuelForm.odometerKm} onChange={value => setFuelForm(current => ({ ...current, odometerKm: value }))} placeholder="12528" />
            <TextField label="Notes" value={fuelForm.notes} onChange={value => setFuelForm(current => ({ ...current, notes: value }))} placeholder="Shell station near ECR" />
            <FileField label="Receipt Image" onChange={file => setFuelForm(current => ({ ...current, receiptImage: file }))} />
            <FileField label="Odometer Image" onChange={file => setFuelForm(current => ({ ...current, odometerImage: file }))} />
          </div>
          <ModalActions onClose={() => setFuelModalOpen(false)} onSubmit={submitFuelLog} submitLabel={logFuelMutation.isPending ? 'Uploading...' : 'Submit Fuel Log'} />
        </ModalShell>
      )}
    </div>
  )
}

function deriveVehicleOperationalStatus(vehicle: Vehicle, activeTrips: TripUI[]): VehicleStatus | 'in_transit' {
  if (activeTrips.some(trip => trip.vehicleId === vehicle.id)) {
    return 'in_transit'
  }

  return vehicle.status
}

function vehicleStatusLabel(status: VehicleStatus | 'in_transit') {
  if (status === 'in_transit') {
    return 'In Transit'
  }

  if (status === 'idle') {
    return 'Idle'
  }

  if (status === 'maintenance') {
    return 'Maintenance'
  }

  if (status === 'exception') {
    return 'Exception'
  }

  return 'Active'
}

function mapVehicleStatus(status: VehicleStatus | 'in_transit'): 'active' | 'pending' | 'warning' | 'flagged' {
  if (status === 'in_transit' || status === 'active') {
    return 'active'
  }

  if (status === 'idle') {
    return 'pending'
  }

  if (status === 'maintenance') {
    return 'warning'
  }

  return 'flagged'
}

function mapTripStatus(status: TripUI['status']): 'active' | 'completed' | 'flagged' | 'pending' {
  if (status === 'planned') {
    return 'pending'
  }

  if (status === 'cancelled') {
    return 'completed'
  }

  return status
}

function alertRowTone(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') {
    return 'border-l-4 border-l-red-500 bg-red-500/[0.05] px-5 py-4'
  }

  if (severity === 'warning') {
    return 'border-l-4 border-l-amber-500 bg-amber-500/[0.06] px-5 py-4'
  }

  return 'border-l-4 border-l-sky-500 bg-zinc-50 px-5 py-4 dark:bg-zinc-950'
}

function alertSeverityBadgeTone(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') {
    return 'inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-500 dark:text-red-300'
  }

  if (severity === 'warning') {
    return 'inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300'
  }

  return 'inline-flex rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300'
}

function prettifyAlertType(alertType: string) {
  switch (alertType) {
    case 'high_fuel_usage':
      return 'High Fuel Usage'
    case 'fuel_mismatch':
    case 'low_mileage':
      return 'Fuel Mismatch'
    case 'odometer_mismatch':
      return 'Odometer Mismatch'
    case 'abnormal_trip':
      return 'Abnormal Trip'
    case 'outstation_trip':
      return 'Outstation Trip'
    default:
      return alertType.replace(/_/g, ' ')
  }
}

function resolveAlertReference(
  alert: { vehicleId?: string | null; tripId?: string | null },
  vehicles: Vehicle[],
  trips: TripUI[],
) {
  const vehicle = vehicles.find(item => item.id === alert.vehicleId)
  const trip = trips.find(item => item.id === alert.tripId)

  if (vehicle && trip) return `${vehicle.name} | ${trip.driverName ?? 'Driver'}`
  if (vehicle) return vehicle.name
  if (trip) return `${trip.vehicleName} | ${trip.driverName ?? 'Driver'}`
  return 'Linked record'
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="clay-panel w-full max-w-4xl p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="clay-icon-button">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  onClose,
  onSubmit,
  submitLabel,
}: {
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button onClick={onClose} className="clay-ghost-button">Cancel</button>
      <button onClick={onSubmit} className="clay-primary-button">{submitLabel}</button>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 font-medium text-zinc-900 dark:text-white">{value}</p>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="project-modal-select" placeholder={placeholder} />
    </label>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <input type="date" value={value} onChange={event => onChange(event.target.value)} className="project-modal-select" />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="project-modal-select">
        <option value="">Select</option>
        {options.map(option => (
          <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function FileField({ label, onChange }: { label: string; onChange: (file: File | null) => void }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <input type="file" accept="image/*" onChange={event => onChange(event.target.files?.[0] ?? null)} className="project-modal-select" />
    </label>
  )
}
