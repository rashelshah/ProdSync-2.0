import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { apiOrigin } from '@/lib/api'
import { resolveErrorMessage, showError, showInfo, showLoading, showSuccess } from '@/lib/toast'
import { transportService } from '@/services/transport.service'
import { formatCurrency, formatDate, formatTime } from '@/utils'
import { useTransportData } from '../hooks/useTransportData'
import { useTransportLiveTracking } from '../hooks/useTransportLiveTracking'
import { TransportTrackingMap } from './TransportTrackingMap'
import {
  getCurrentDeviceLocation,
  reverseGeocode,
  searchDestinationSuggestions,
  type LocationSuggestion,
} from '../location-intelligence'
import type {
  FuelLogInput,
  FuelLogUI,
  LocationPoint,
  TripFilters,
  TripUI,
  UpdateVehicleInput,
  Vehicle,
  VehicleStatus,
} from '../types'

const initialCoordinates = {
  latitude: '',
  longitude: '',
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
  remarks: '',
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

const purposeOptions = [
  'Crew Pickup',
  'Cast Movement',
  'Equipment Transfer',
  'Airport Transfer',
  'Location Run',
  'Supply Run',
]

type LocationFetchState = {
  status: 'idle' | 'fetching' | 'ready' | 'error'
  message: string
}

const idleLocationFetchState: LocationFetchState = {
  status: 'idle',
  message: '',
}

function hasCoordinatePair(latitude: string, longitude: string) {
  return latitude.trim().length > 0 && longitude.trim().length > 0
}

function tripOriginLabel(trip: TripUI) {
  return trip.origin?.trim() || trip.startLocation?.address?.trim() || 'Location unavailable'
}

function tripDestinationLabel(trip: TripUI) {
  if (trip.status === 'active') {
    return 'Yet to reach'
  }

  return trip.destination?.trim() || trip.endLocation?.address?.trim() || 'Location unavailable'
}

export function TransportView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext } = useResolvedProjectContext()

  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'fleet' | 'history' | 'ledger'>('home')
  const [tripFilters, setTripFilters] = useState<TripFilters>(initialTripFilters)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const {
    isLoading,
    isError,
    isFuelLoading,
    isAlertsLoading,
    isDriversLoading,
    kpis,
    trips,
    fuelLogs,
    vehicles,
    alerts,
    drivers,
    canViewAlerts,
    canManageTransport,
    fuelFailed,
    alertsFailed,
    driversFailed,
  } = useTransportData(tripFilters)

  const hasData = trips.length > 0 || fuelLogs.length > 0 || vehicles.length > 0 || alerts.length > 0
  const isDriver = user?.role === 'Driver' || user?.projectRoleTitle === 'Driver'
  const canOperateTrips = isDriver || canManageTransport
  const canLogFuel = isDriver || canManageTransport

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [vehicleDetailId, setVehicleDetailId] = useState<string | null>(null)
  const [vehicleAssignId, setVehicleAssignId] = useState<string | null>(null)
  const [tripStartModalOpen, setTripStartModalOpen] = useState(false)
  const [tripEndTripId, setTripEndTripId] = useState<string | null>(null)
  const [fuelModalOpen, setFuelModalOpen] = useState(false)
  const [fuelPreview, setFuelPreview] = useState<{ title: string; src: string } | null>(null)

  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm)
  const [assignDriverUserId, setAssignDriverUserId] = useState('')
  const [tripStartForm, setTripStartForm] = useState(emptyTripStartForm)
  const [tripEndForm, setTripEndForm] = useState(emptyTripEndForm)
  const [fuelForm, setFuelForm] = useState(emptyFuelForm)
  const [tripStartDestinationPoint, setTripStartDestinationPoint] = useState<LocationPoint | null>(null)
  const [destinationSuggestions, setDestinationSuggestions] = useState<LocationSuggestion[]>([])
  const [destinationSearchError, setDestinationSearchError] = useState<string | null>(null)
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false)
  const [startLocationState, setStartLocationState] = useState<LocationFetchState>(idleLocationFetchState)
  const [endLocationState, setEndLocationState] = useState<LocationFetchState>(idleLocationFetchState)

  const startLocationFetchedRef = useRef(false)
  const endLocationFetchedRef = useRef(false)

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

  const activeTripByVehicleId = useMemo(() => {
    const mapping = new Map<string, TripUI>()

    for (const trip of activeTrips) {
      mapping.set(trip.vehicleId, trip)
    }

    return mapping
  }, [activeTrips])

  const visibleVehicles = useMemo(
    () => (isDriver ? vehicles.filter(vehicle => vehicle.assignedDriverUserId === user?.id) : vehicles),
    [isDriver, user?.id, vehicles],
  )

  const filteredVehicles = useMemo(() => {
    if (isDriver) {
      return visibleVehicles
    }

    const query = (vehicleSearch || '').trim().toLowerCase()
    if (!query) {
      return visibleVehicles
    }

    return visibleVehicles.filter(vehicle =>
      [vehicle.name, vehicle.registrationNumber, vehicle.assignedDriverName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query)),
    )
  }, [isDriver, vehicleSearch, visibleVehicles])

  const {
    liveLocations,
    liveMeta,
    trackingLoading,
    streamState,
    liveLocationsFailed,
  } = useTransportLiveTracking({
    activeProjectId,
    activeTrips,
    canManageTransport,
    isDriver,
  })

  const selectedTripForEnd = activeTrips.find(trip => trip.id === tripEndTripId) ?? null
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleDetailId) ?? null
  const selectedVehicleForAssignment = vehicles.find(vehicle => vehicle.id === vehicleAssignId) ?? null
  const driverOptions = drivers.map(driver => ({ value: driver.userId, label: driver.fullName }))

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

  useEffect(() => {
    if (!selectedVehicleForAssignment) {
      setAssignDriverUserId('')
      return
    }

    setAssignDriverUserId(selectedVehicleForAssignment.assignedDriverUserId ?? '')
  }, [selectedVehicleForAssignment])

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
      queryClient.invalidateQueries({ queryKey: ['tracking-live', activeProjectId] }),
    ])
  }

  async function runTransportAction<T>(
    action: () => Promise<T>,
    options: {
      toastId: string
      loadingMessage: string
      successMessage: string
      errorMessage: string
    },
  ) {
    showLoading(options.loadingMessage, { id: options.toastId })

    try {
      const result = await action()
      showSuccess(options.successMessage, { id: options.toastId })
      return result
    } catch (error) {
      showError(resolveErrorMessage(error, options.errorMessage), { id: options.toastId })
      throw error
    }
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

  const assignDriverMutation = useMutation({
    mutationFn: ({ vehicleId, driverUserId }: { vehicleId: string; driverUserId: string }) => {
      if (!activeProjectId) {
        throw new Error('Project context is required.')
      }

      return transportService.updateVehicle(vehicleId, {
        projectId: activeProjectId,
        assignedDriverUserId: driverUserId || null,
      })
    },
    onSuccess: async () => {
      setVehicleAssignId(null)
      await refreshProjectQueries()
    },
  })

  const startTripMutation = useMutation({
    mutationFn: transportService.startTrip,
    onSuccess: async () => {
      closeTripStartModal()
      await refreshProjectQueries()
    },
  })

  const endTripMutation = useMutation({
    mutationFn: transportService.endTrip,
    onSuccess: async () => {
      closeTripEndModal()
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

  const fetchStartLocation = useEffectEvent(async (force = false) => {
    if (!activeProjectId) {
      return
    }

    if (!force && startLocationFetchedRef.current) {
      return
    }

    setStartLocationState({
      status: 'fetching',
      message: 'Fetching location...',
    })

    try {
      const location = await getCurrentDeviceLocation()
      startLocationFetchedRef.current = true

      setTripStartForm(current => ({
        ...current,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      }))

      const address = await reverseGeocode(activeProjectId, location)

      setTripStartForm(current => ({
        ...current,
        origin: address,
        address,
      }))

      showSuccess('Location detected', { id: 'transport-start-location' })

      setStartLocationState({
        status: 'ready',
        message: address,
      })
    } catch (error) {
      showInfo('Location unavailable, enter manually', { id: 'transport-start-location' })
      setStartLocationState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to fetch current location.',
      })
    }
  })

  const fetchEndLocation = useEffectEvent(async (force = false) => {
    if (!activeProjectId) {
      return
    }

    if (!force && endLocationFetchedRef.current) {
      return
    }

    setEndLocationState({
      status: 'fetching',
      message: 'Fetching location...',
    })

    try {
      const location = await getCurrentDeviceLocation()
      endLocationFetchedRef.current = true

      setTripEndForm(current => ({
        ...current,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      }))

      const address = await reverseGeocode(activeProjectId, location)

      setTripEndForm(current => ({
        ...current,
        destination: address,
        address,
      }))

      showSuccess('Location detected', { id: 'transport-end-location' })

      setEndLocationState({
        status: 'ready',
        message: address,
      })
    } catch (error) {
      showInfo('Location unavailable, enter manually', { id: 'transport-end-location' })
      setEndLocationState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to fetch current location.',
      })
    }
  })

  useEffect(() => {
    if (tripStartModalOpen) {
      void fetchStartLocation()
    }
  }, [tripStartModalOpen])

  useEffect(() => {
    if (tripEndTripId) {
      void fetchEndLocation()
    }
  }, [tripEndTripId])

  useEffect(() => {
    if (!tripStartModalOpen || !activeProjectId) {
      setDestinationSuggestions([])
      setDestinationSearchError(null)
      setDestinationSearchLoading(false)
      return
    }

    const query = (tripStartForm.destination || '').trim()
    if (query.length < 2) {
      setDestinationSuggestions([])
      setDestinationSearchError(null)
      setDestinationSearchLoading(false)
      return
    }

    if (tripStartDestinationPoint?.address && query === tripStartDestinationPoint.address) {
      setDestinationSuggestions([])
      setDestinationSearchError(null)
      setDestinationSearchLoading(false)
      return
    }

    let cancelled = false
    setDestinationSearchLoading(true)
    setDestinationSearchError(null)

    const timeoutId = window.setTimeout(() => {
      void searchDestinationSuggestions(activeProjectId, query)
        .then(results => {
          if (cancelled) {
            return
          }

          setDestinationSuggestions(results)
        })
        .catch(error => {
          if (cancelled) {
            return
          }

          showInfo('Destination suggestions are unavailable right now.', { id: 'transport-destination-search' })
          setDestinationSearchError(error instanceof Error ? error.message : 'Could not fetch destination suggestions.')
          setDestinationSuggestions([])
        })
        .finally(() => {
          if (!cancelled) {
            setDestinationSearchLoading(false)
          }
        })
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeProjectId, tripStartDestinationPoint, tripStartForm.destination, tripStartModalOpen])

  useEffect(() => {
    if (!liveLocationsFailed) {
      return
    }

    showInfo('Tracking fallback active. Live updates will retry automatically.', { id: 'transport-tracking-fallback' })
  }, [liveLocationsFailed])

  useEffect(() => {
    if (streamState.status !== 'error') {
      return
    }

    showInfo(streamState.message || 'Tracking fallback is active for this trip.', { id: 'transport-stream-state' })
  }, [streamState.message, streamState.status])

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

  if (isLoading) {
    return <LoadingState message="Loading fleet data..." />
  }

  if (isError) {
    return <ErrorState message="Could not load transport data" />
  }

  function closeTripStartModal() {
    setTripStartModalOpen(false)
    setTripStartForm(emptyTripStartForm)
    setTripStartDestinationPoint(null)
    setDestinationSuggestions([])
    setDestinationSearchError(null)
    setDestinationSearchLoading(false)
    setStartLocationState(idleLocationFetchState)
    startLocationFetchedRef.current = false
  }

  function closeTripEndModal() {
    setTripEndTripId(null)
    setTripEndForm(emptyTripEndForm)
    setEndLocationState(idleLocationFetchState)
    endLocationFetchedRef.current = false
  }

  function openStartTripModal(vehicle?: Vehicle) {
    setTripStartForm({
      ...emptyTripStartForm,
      vehicleId: vehicle?.id ?? '',
      driverId: vehicle?.assignedDriverUserId ?? '',
    })
    setTripStartDestinationPoint(null)
    setDestinationSuggestions([])
    setDestinationSearchError(null)
    setTripStartModalOpen(true)
  }

  function openFuelModal(vehicle?: Vehicle, trip?: TripUI | null) {
    setFuelForm({
      ...emptyFuelForm,
      vehicleId: vehicle?.id ?? '',
      tripId: trip?.id ?? '',
    })
    setFuelModalOpen(true)
  }

  function submitVehicle() {
    if (!activeProjectId) {
      showError('Select a project before adding a vehicle.', { id: 'transport-create-vehicle' })
      return
    }

    if (!vehicleForm.name.trim() || !vehicleForm.vehicleType.trim()) {
      showError('Vehicle name and type are required.', { id: 'transport-create-vehicle' })
      return
    }

    void runTransportAction(
      () => createVehicleMutation.mutateAsync({
        projectId: activeProjectId,
        name: vehicleForm.name.trim(),
        vehicleType: vehicleForm.vehicleType.trim(),
        registrationNumber: vehicleForm.registrationNumber.trim() || undefined,
        capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
        assignedDriverUserId: vehicleForm.assignedDriverUserId || undefined,
        baseLocation: vehicleForm.baseLocation.trim() || undefined,
        status: vehicleForm.status,
        notes: vehicleForm.notes.trim() || undefined,
      }),
      {
        toastId: 'transport-create-vehicle',
        loadingMessage: 'Saving vehicle...',
        successMessage: 'Vehicle added successfully.',
        errorMessage: 'Vehicle could not be added.',
      },
    )
  }

  function submitVehicleUpdate() {
    if (!activeProjectId || !selectedVehicle) {
      showError('Select a vehicle before saving changes.', { id: 'transport-update-vehicle' })
      return
    }

    if (!vehicleForm.name.trim() || !vehicleForm.vehicleType.trim()) {
      showError('Vehicle name and type are required.', { id: 'transport-update-vehicle' })
      return
    }

    void runTransportAction(
      () => updateVehicleMutation.mutateAsync({
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
      }),
      {
        toastId: 'transport-update-vehicle',
        loadingMessage: 'Saving vehicle changes...',
        successMessage: 'Vehicle updated successfully.',
        errorMessage: 'Vehicle changes could not be saved.',
      },
    )
  }

  function submitDriverAssignment() {
    if (!selectedVehicleForAssignment) {
      showError('Select a vehicle before assigning a driver.', { id: 'transport-assign-driver' })
      return
    }

    void runTransportAction(
      () => assignDriverMutation.mutateAsync({
        vehicleId: selectedVehicleForAssignment.id,
        driverUserId: assignDriverUserId,
      }),
      {
        toastId: 'transport-assign-driver',
        loadingMessage: 'Assigning driver...',
        successMessage: 'Driver assigned successfully.',
        errorMessage: 'Driver assignment failed.',
      },
    )
  }

  function submitTripStart() {
    if (!activeProjectId) {
      showError('Select a project before starting a trip.', { id: 'transport-start-trip' })
      return
    }

    if (!tripStartForm.vehicleId) {
      showError('Select a vehicle to start the trip.', { id: 'transport-start-trip' })
      return
    }

    const hasGpsLocation = hasCoordinatePair(tripStartForm.latitude, tripStartForm.longitude)
    const manualAddress = tripStartForm.address.trim() || tripStartForm.origin.trim()
    if (!hasGpsLocation && !manualAddress) {
      showInfo('Location unavailable, enter manually', { id: 'transport-start-location' })
      setStartLocationState({
        status: 'error',
        message: 'Unable to fetch location. Please enter manually.',
      })
      return
    }

    void runTransportAction(
      () => startTripMutation.mutateAsync({
        projectId: activeProjectId,
        vehicleId: tripStartForm.vehicleId,
        driverId: canManageTransport && tripStartForm.driverId ? tripStartForm.driverId : undefined,
        odometerKm: tripStartForm.odometerKm ? Number(tripStartForm.odometerKm) : undefined,
        purpose: tripStartForm.purpose || undefined,
        origin: tripStartForm.origin.trim() || undefined,
        destination: tripStartForm.destination.trim() || undefined,
        startLocation: {
          ...(hasGpsLocation
            ? {
              latitude: Number(tripStartForm.latitude),
              longitude: Number(tripStartForm.longitude),
            }
            : {}),
          address: manualAddress || undefined,
        },
        destinationLocation: tripStartDestinationPoint ?? undefined,
      }),
      {
        toastId: 'transport-start-trip',
        loadingMessage: 'Starting trip...',
        successMessage: 'Trip started.',
        errorMessage: 'Trip could not be started.',
      },
    )
  }

  function submitTripEnd() {
    if (!activeProjectId || !tripEndTripId) {
      showError('Select an active trip before ending it.', { id: 'transport-end-trip' })
      return
    }

    if (!tripEndForm.odometerKm) {
      showError('End odometer is required to end the trip.', { id: 'transport-end-trip' })
      setEndLocationState({
        status: 'error',
        message: 'End odometer is required to end the trip.',
      })
      return
    }

    const hasGpsLocation = hasCoordinatePair(tripEndForm.latitude, tripEndForm.longitude)
    const manualAddress = tripEndForm.address.trim() || tripEndForm.destination.trim()
    if (!hasGpsLocation && !manualAddress) {
      showInfo('Location unavailable, enter manually', { id: 'transport-end-location' })
      setEndLocationState({
        status: 'error',
        message: 'Unable to fetch location. Please enter manually.',
      })
      return
    }

    void runTransportAction(
      () => endTripMutation.mutateAsync({
        projectId: activeProjectId,
        tripId: tripEndTripId,
        odometerKm: Number(tripEndForm.odometerKm),
        destination: tripEndForm.destination.trim() || undefined,
        remarks: tripEndForm.remarks.trim() || undefined,
        endLocation: {
          ...(hasGpsLocation
            ? {
              latitude: Number(tripEndForm.latitude),
              longitude: Number(tripEndForm.longitude),
            }
            : {}),
          address: manualAddress || undefined,
        },
      }),
      {
        toastId: 'transport-end-trip',
        loadingMessage: 'Ending trip...',
        successMessage: 'Trip completed.',
        errorMessage: 'Trip could not be ended.',
      },
    )
  }

  function submitFuelLog() {
    if (!activeProjectId) {
      showError('Select a project before logging fuel.', { id: 'transport-log-fuel' })
      return
    }

    if (!fuelForm.vehicleId) {
      showError('Select a vehicle before logging fuel.', { id: 'transport-log-fuel' })
      return
    }

    if (!fuelForm.liters || Number(fuelForm.liters) <= 0) {
      showError('Enter the fuel quantity before submitting.', { id: 'transport-log-fuel' })
      return
    }

    if (!fuelForm.receiptImage || !fuelForm.odometerImage) {
      showError('Receipt and odometer images are required.', { id: 'transport-log-fuel' })
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

    void runTransportAction(
      () => logFuelMutation.mutateAsync(payload),
      {
        toastId: 'transport-log-fuel',
        loadingMessage: 'Uploading fuel log...',
        successMessage: 'Fuel log submitted.',
        errorMessage: 'Fuel log could not be submitted.',
      },
    )
  }

  function reviewFuelLog(id: string, auditStatus: 'verified' | 'mismatch') {
    void runTransportAction(
      () => reviewFuelMutation.mutateAsync({ id, auditStatus }),
      {
        toastId: `transport-fuel-review-${auditStatus}`,
        loadingMessage: auditStatus === 'verified' ? 'Approving fuel log...' : 'Flagging OCR mismatch...',
        successMessage: auditStatus === 'verified' ? 'Approved successfully' : 'OCR mismatch flagged.',
        errorMessage: auditStatus === 'verified' ? 'Fuel approval failed.' : 'Fuel mismatch could not be flagged.',
      },
    )
  }

  return (
    <div className="page-shell">
      <div className="max-md:hidden space-y-6">
        <header className="page-header">
        <div>
          <span className="page-kicker">Logistics Control</span>
          <h1 className="page-title page-title-compact">Transport & Logistics</h1>
          <p className="page-subtitle">
            Live transport operations for <span className="font-semibold text-zinc-900 dark:text-white">{activeProject.name}</span>.
            Trips, fleet status, fuel audits, and transport alerts are sourced from the backend in real time.
          </p>
        </div>

        <div className="flex justify-end">
          {canManageTransport && (
            <button
              onClick={() => {
                setVehicleForm(emptyVehicleForm)
                setVehicleModalOpen(true)
              }}
              className="btn-primary"
            >
              Add Vehicle
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
        <KpiCard label="Fuel Cost" value={formatCurrency(kpis.fuelCost)} subLabel={fuelFailed ? 'Fuel data unavailable' : 'Logged spend'} />
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
              <div className="space-y-2">
                <p className="section-title">{isDriver ? 'My Vehicle' : 'Fleet Management'}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {isDriver
                    ? 'Your assigned vehicle stays front and center, with trip actions kept simple and stable.'
                    : 'Compact fleet visibility with quick driver assignment, trip control, and fuel logging.'}
                </p>
                {isDriver && (
                  <p className={`text-sm ${streamState.status === 'error' ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {streamState.message}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {!isDriver && (
                  <label className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Search</span>
                    <input
                      value={vehicleSearch}
                      onChange={event => setVehicleSearch(event.target.value)}
                      placeholder="Vehicle, number, or driver"
                      className="h-9 min-w-[220px] bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
                    />
                  </label>
                )}

                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {filteredVehicles.length} vehicle{filteredVehicles.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {driversFailed && canManageTransport && (
              <InlineBanner tone="warning" message="Driver assignments are temporarily unavailable. Existing fleet data is still loaded." />
            )}

            {filteredVehicles.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isDriver ? 'No vehicle is assigned to you yet.' : 'No vehicles match the current search.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map(vehicle => {
                  const activeTrip = activeTripByVehicleId.get(vehicle.id) ?? null
                  const cardStatus = activeTrip ? 'In Transit' : 'Idle'

                  return (
                    <div
                      key={vehicle.id}
                      className="rounded-[2rem] border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          <VehicleCardMetric label="Vehicle Name" value={vehicle.name} strong />
                          <VehicleCardMetric label="Vehicle Number" value={vehicle.registrationNumber ?? 'Not added'} />
                          <VehicleCardMetric label="Driver" value={vehicle.assignedDriverName ?? 'Unassigned'} />
                          <div className="min-w-[120px]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</p>
                            <div className="mt-2">
                              <StatusBadge variant={cardStatus === 'In Transit' ? 'active' : 'pending'} label={cardStatus} />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {canManageTransport && !isDriver && (
                            <button onClick={() => setVehicleAssignId(vehicle.id)} className="btn-soft px-4 py-2 text-[11px]">
                              Assign Driver
                            </button>
                          )}
                          {canOperateTrips && (
                            activeTrip ? (
                              <button onClick={() => setTripEndTripId(activeTrip.id)} className="btn-primary px-4 py-2 text-[11px]">
                                End Trip
                              </button>
                            ) : (
                              <button onClick={() => openStartTripModal(vehicle)} className="btn-primary px-4 py-2 text-[11px]">
                                Start Trip
                              </button>
                            )
                          )}
                          {canLogFuel && (
                            <button onClick={() => openFuelModal(vehicle, activeTrip)} className="btn-soft px-4 py-2 text-[11px]">
                              Log Fuel
                            </button>
                          )}
                          <button onClick={() => setVehicleDetailId(vehicle.id)} className="btn-soft px-4 py-2 text-[11px]">
                            View Details
                          </button>
                        </div>
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
                    Hybrid checkpoint tracking with smooth marker animation, OSM-safe routing fallback, and automatic Mapbox cutoff protection.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-disabled={!liveMeta?.mapEnabled}
                    onClick={() => showInfo('Mapbox integration under development.', { id: 'transport-map-mode' })}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                      liveMeta?.mapEnabled
                        ? 'border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
                    }`}
                  >
                    Map Mode: OSM / Mapbox
                  </button>
                  <StatusBadge variant={liveLocations.length > 0 ? 'live' : 'pending'} label={liveLocations.length > 0 ? 'Live' : 'Standby'} />
                </div>
              </div>

              {liveLocationsFailed && (
                <InlineBanner tone="warning" message="Live tracking is temporarily unavailable. The rest of transport operations remain active." />
              )}

              <TransportTrackingMap
                liveLocations={liveLocations}
                liveMeta={liveMeta}
                loading={trackingLoading}
              />

              <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Active Fleet</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Vehicles animate between checkpoints, and trips pause intermediate updates automatically once they enter the final 5-8 km band without depending on Mapbox.
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
              {canManageTransport && (
                <button onClick={() => setTripFilters(initialTripFilters)} className="btn-soft px-4 py-2 text-xs">
                  Clear Filters
                </button>
              )}
            </div>

            {canManageTransport && (
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
            )}

            {trips.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No trips match the current filters.</p>
            ) : (
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
                  { key: 'origin', label: 'Origin', render: row => tripOriginLabel(row) },
                  { key: 'destination', label: 'Destination', render: row => tripDestinationLabel(row) },
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
                ]}
                data={trips}
                getKey={row => row.id}
              />
            )}
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Fuel Audit Ledger</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Receipt-backed fuel logs with fraud scoring, mileage validation, and captain review.
              </p>
            </div>

            {fuelFailed ? (
              <InlineBanner tone="danger" message="Fuel data unavailable" />
            ) : isFuelLoading ? (
              <LoadingState message="Loading fuel ledger..." />
            ) : fuelLogs.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No fuel logs recorded yet.</p>
            ) : (
              <FuelLedger
                fuelLogs={fuelLogs}
                canManageTransport={canManageTransport}
                onReviewFuel={reviewFuelLog}
                reviewFuelPending={reviewFuelMutation.isPending}
                onPreview={setFuelPreview}
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

              {alertsFailed ? (
                <InlineBanner tone="warning" message="Transport alerts are temporarily unavailable." />
              ) : isAlertsLoading ? (
                <LoadingState message="Loading transport alerts..." />
              ) : alerts.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No active transport alerts for this project.</p>
              ) : (
                <AlertRows alerts={alerts} vehicles={vehicles} trips={trips} />
              )}
            </Surface>
          )}
        </div>
      )}
      </div>

      <div className="md:hidden mt-2 px-1 pb-[140px]">
        <header className="px-3">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
            <span className="page-kicker text-orange-500">Logistics Control</span>
            <div className="flex items-center justify-between gap-2 mt-1">
               <h1 className="page-title page-title-compact text-zinc-900 dark:text-white">Transport & Logistics</h1>
               {isDriver && <StatusBadge variant="active" label="Driver Mode" />}
            </div>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
               Live trips, fleet, and transport alerts.
            </p>
          </div>
        </header>

        {activeMobileTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3">
             <section className="grid grid-cols-2 gap-3 px-1 pb-2">
                <div className="bg-surface-container border border-outline-variant/10 p-4 rounded-xl shadow-md min-w-0">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">In Transit</span>
                  <div className="text-4xl font-headline font-extrabold text-white mt-1 break-all w-full">{kpis.inTransit}</div>
                </div>
                <div className="bg-surface-container border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl shadow-md min-w-0">
                  <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">Idle</span>
                  <div className="text-4xl font-headline font-extrabold text-amber-500 mt-1 break-all w-full">{kpis.idleVehicles}</div>
                </div>
                <div className="col-span-2 bg-surface-container border border-red-500/20 bg-red-500/5 p-4 rounded-xl relative overflow-hidden shadow-md min-w-0">
                   <div className="absolute top-0 right-0 p-2 opacity-20">
                     <span className="material-symbols-outlined text-red-500 text-3xl">warning</span>
                   </div>
                   <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Alerts</span>
                   <div className="text-4xl font-headline font-extrabold text-red-500 mt-1 break-all w-full">{alerts.length.toString().padStart(2, '0')}</div>
                </div>
             </section>

             {alerts.filter(a => a.severity === 'critical').length > 0 && (
               <section className="space-y-3">
                 {alerts.filter(a => a.severity === 'critical').map((alert, index) => (
                   <div key={`${alert.triggeredAt}-${index}`} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-4 items-start">
                     <span className="material-symbols-outlined text-red-500 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                     <div className="space-y-1">
                       <p className="text-white font-bold text-sm leading-tight">{transportAlertTitle(alert)}</p>
                       <p className="text-zinc-400 text-xs">{formatTime(alert.triggeredAt)}</p>
                     </div>
                   </div>
                 ))}
               </section>
             )}

             <section>
               <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Live Map</h2>
               <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl border border-outline-variant/10 h-64 relative">
                 <div className="absolute inset-0 z-0">
                    <TransportTrackingMap
                       liveLocations={liveLocations}
                       liveMeta={liveMeta}
                       loading={trackingLoading}
                    />
                 </div>
               </div>
             </section>

           </div>
        )}

        {activeMobileTab === 'fleet' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 px-3 pt-4">
             <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Fleet Assignment</h2>
             <div className="flex flex-col gap-3 pb-32">
               {visibleVehicles.length === 0 ? (
                 <p className="text-sm text-zinc-500 dark:text-zinc-400">No vehicles assigned.</p>
               ) : (
                 visibleVehicles.map(vehicle => (
                   <div key={vehicle.id} onClick={() => setVehicleDetailId(vehicle.id)} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between active:bg-zinc-800 transition-colors">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 flex-shrink-0 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center">
                         <span className="material-symbols-outlined text-zinc-400">directions_car</span>
                       </div>
                       <div className="min-w-0">
                         <p className="font-bold text-white truncate max-w-[200px]">{vehicle.name}</p>
                         <p className="text-[10px] text-zinc-500 uppercase font-medium">{vehicle.registrationNumber}</p>
                       </div>
                     </div>
                     <StatusBadge variant={vehicle.status === 'active' ? 'active' : vehicle.status === 'exception' ? 'flagged' : 'pending'} label={vehicleStatusLabel(vehicle.status)} />
                   </div>
                 ))
               )}
             </div>
          </div>
        )}

        {activeMobileTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 px-3 pt-4">
             <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Trip History</h2>
             {trips.length === 0 ? (
               <p className="text-sm text-zinc-500 dark:text-zinc-400">No trips recorded yet.</p>
             ) : (
               <div className="space-y-4 pb-32">
                 {trips.slice(0, 20).map(trip => (
                   <div key={trip.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-sm">{trip.vehicleName}</p>
                          <p className="text-xs text-zinc-400">{trip.driverName ?? 'Unassigned'}</p>
                        </div>
                        <StatusBadge variant={trip.status === 'active' ? 'active' : trip.status === 'flagged' ? 'flagged' : trip.status === 'completed' ? 'verified' : 'pending'} label={trip.status} />
                     </div>
                     <div className="flex flex-col gap-1 text-xs text-zinc-300">
                        <div className="flex gap-2 items-center"><span className="material-symbols-outlined text-[14px] text-zinc-500">my_location</span> <span className="truncate">{tripOriginLabel(trip)}</span></div>
                        <div className="flex gap-2 items-center ml-[5px] border-l border-dashed border-zinc-700 pl-[13px] py-1"><span className="material-symbols-outlined text-[14px] text-zinc-500">location_on</span> <span className="truncate">{tripDestinationLabel(trip)}</span></div>
                     </div>
                     <div className="flex justify-between items-center text-xs text-zinc-400 mt-2 border-t border-zinc-800/50 pt-3">
                        <span>{formatDate(trip.startTime)} {formatTime(trip.startTime)}</span>
                        <span className="font-medium text-white">{trip.distanceKm.toFixed(1)} km</span>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {activeMobileTab === 'ledger' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 px-3 pt-4">
             <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Fuel Audit Ledger</h2>
             {fuelLogs.length === 0 ? (
               <p className="text-sm text-zinc-500 dark:text-zinc-400">No fuel records yet.</p>
             ) : (
               <div className="space-y-4 pb-32">
                 {fuelLogs.map(log => (
                   <div key={log.id} onClick={() => log.receiptFilePath ? setFuelPreview({ title: 'Receipt Preview', src: resolveUploadUrl(log.receiptFilePath)! }) : undefined} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-sm">{log.vehicleName}</p>
                          <p className="text-xs text-zinc-400">{log.loggedByName ?? log.loggedBy}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-sm">{formatCurrency(log.cost ?? 0)}</p>
                          <p className="text-xs text-orange-400">{log.liters.toFixed(1)} L</p>
                        </div>
                     </div>
                     <div className="flex gap-2 mt-1">
                        <StatusBadge variant={log.efficiencyRating === 'good' ? 'verified' : 'mismatch'} label={log.auditStatus} />
                        {log.fraudStatus !== 'NORMAL' && (
                          <StatusBadge variant={log.fraudStatus === 'FRAUD' ? 'flagged' : 'warning'} label={log.fraudStatus} />
                        )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {/* Floating Action Container */}
        {['home', 'fleet'].includes(activeMobileTab) && (
        <div className="fixed bottom-24 left-0 w-full z-40 px-5 pointer-events-none">
          <div className="flex flex-col gap-3 pointer-events-auto">
            {canManageTransport && (
              <button 
                onClick={() => {
                  setVehicleAssignId(visibleVehicles.find(v => v.status === 'idle')?.id || visibleVehicles[0]?.id)
                }} 
                className="w-full h-12 bg-white text-zinc-900 border border-zinc-200 font-bold text-[11px] rounded-[14px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wider shadow-lg"
              >
                <span className="material-symbols-outlined text-zinc-900 text-[18px]">person_add</span>
                Assign Driver
              </button>
            )}
            <div className="flex gap-3">
              {canLogFuel && (
                <button onClick={() => setFuelModalOpen(true)} className="flex-1 h-12 bg-zinc-900 border border-zinc-800 text-white font-bold text-[10px] rounded-[14px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-tighter shadow-lg">
                  <span className="material-symbols-outlined text-orange-500 text-[18px]">local_gas_station</span>
                  Log Fuel
                </button>
              )}
              {canOperateTrips && (
                <button 
                  onClick={() => {
                    const availableVehicle = visibleVehicles.find(v => v.status === 'idle') || visibleVehicles[0]
                    openStartTripModal(availableVehicle)
                  }} 
                  className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-orange-600 text-black font-black font-headline rounded-[14px] shadow-2xl flex items-center justify-center gap-2 active:scale-95 duration-200"
                >
                  <span className="material-symbols-outlined font-bold text-[20px]">play_arrow</span>
                  START TRIP
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex h-[80px] max-w-md items-center justify-around rounded-[30px] border border-zinc-200/80 bg-white/88 px-2 pb-safe shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/8 dark:bg-zinc-950/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
          {[
            { id: 'home', icon: 'dashboard', label: 'Home' },
            { id: 'fleet', icon: 'local_shipping', label: 'Fleet' },
            { id: 'history', icon: 'history', label: 'History' },
            { id: 'ledger', icon: 'receipt_long', label: 'Ledger' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as any)}
              className={`flex w-16 flex-col items-center justify-center gap-1 rounded-[20px] py-2 transition-all duration-200 ${activeMobileTab === tab.id ? 'bg-orange-500/12 text-orange-500 dark:bg-orange-500/16' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
            >
               <span className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${activeMobileTab === tab.id ? 'scale-110' : ''}`} style={activeMobileTab === tab.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
               <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {vehicleModalOpen && (
        <ModalShell title="Add Vehicle" onClose={() => setVehicleModalOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Vehicle Name" value={vehicleForm.name} onChange={value => setVehicleForm(current => ({ ...current, name: value }))} placeholder="Unit Van 01" />
            <TextField label="Category" value={vehicleForm.vehicleType} onChange={value => setVehicleForm(current => ({ ...current, vehicleType: value }))} placeholder="Pax Car / Vanity Van / Gen Truck" />
            <TextField label="Vehicle Number" value={vehicleForm.registrationNumber} onChange={value => setVehicleForm(current => ({ ...current, registrationNumber: value }))} placeholder="TN 09 AB 1234" />
            <TextField label="Capacity" type="number" value={vehicleForm.capacity} onChange={value => setVehicleForm(current => ({ ...current, capacity: value }))} placeholder="4" />
            <SelectField
              label="Assign Driver"
              value={vehicleForm.assignedDriverUserId}
              onChange={value => setVehicleForm(current => ({ ...current, assignedDriverUserId: value }))}
              options={driverOptions}
              placeholder={isDriversLoading ? 'Loading drivers...' : 'Choose a driver'}
              disabled={isDriversLoading || driverOptions.length === 0}
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
            <TextField
              label="Vehicle Name"
              value={vehicleForm.name}
              onChange={value => setVehicleForm(current => ({ ...current, name: value }))}
              disabled={!canManageTransport}
            />
            <TextField
              label="Category"
              value={vehicleForm.vehicleType}
              onChange={value => setVehicleForm(current => ({ ...current, vehicleType: value }))}
              disabled={!canManageTransport}
            />
            <TextField
              label="Vehicle Number"
              value={vehicleForm.registrationNumber}
              onChange={value => setVehicleForm(current => ({ ...current, registrationNumber: value }))}
              disabled={!canManageTransport}
            />
            <TextField
              label="Capacity"
              type="number"
              value={vehicleForm.capacity}
              onChange={value => setVehicleForm(current => ({ ...current, capacity: value }))}
              disabled={!canManageTransport}
            />
            <TextField
              label="Assigned Driver"
              value={selectedVehicle.assignedDriverName ?? 'Unassigned'}
              onChange={() => {}}
              disabled
            />
            <TextField
              label="Status"
              value={vehicleStatusLabel(deriveVehicleOperationalStatus(selectedVehicle, activeTrips))}
              onChange={() => {}}
              disabled
            />
            <TextField
              label="Base Location"
              value={vehicleForm.baseLocation}
              onChange={value => setVehicleForm(current => ({ ...current, baseLocation: value }))}
              disabled={!canManageTransport}
            />
            <TextField
              label="Notes"
              value={vehicleForm.notes}
              onChange={value => setVehicleForm(current => ({ ...current, notes: value }))}
              disabled={!canManageTransport}
            />
          </div>

          <div className="mt-6 grid gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950">
            <Metric label="Operational Status" value={vehicleStatusLabel(deriveVehicleOperationalStatus(selectedVehicle, activeTrips))} />
            <Metric label="Current Driver" value={selectedVehicle.assignedDriverName ?? 'Unassigned'} />
            <Metric label="Active Trip" value={activeTripByVehicleId.get(selectedVehicle.id)?.driverName ?? 'None'} />
            <Metric label="Base" value={selectedVehicle.baseLocation ?? 'Not set'} />
          </div>

          <ModalActions
            onClose={() => setVehicleDetailId(null)}
            onSubmit={canManageTransport ? submitVehicleUpdate : () => setVehicleDetailId(null)}
            submitLabel={canManageTransport ? (updateVehicleMutation.isPending ? 'Saving...' : 'Save Changes') : 'Close'}
            isSubmitting={updateVehicleMutation.isPending}
          />
        </ModalShell>
      )}

      {selectedVehicleForAssignment && (
        <ModalShell title={`Assign Driver - ${selectedVehicleForAssignment.name}`} onClose={() => setVehicleAssignId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Only users with the Driver role are available here.
            </p>
            {isDriversLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading available drivers...</p>
            ) : driverOptions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No active drivers are available for assignment right now.</p>
            ) : null}
            <SelectField
              label="Driver"
              value={assignDriverUserId}
              onChange={setAssignDriverUserId}
              placeholder="Choose a driver"
              options={driverOptions}
              disabled={isDriversLoading || driverOptions.length === 0}
            />
          </div>
          <ModalActions
            onClose={() => setVehicleAssignId(null)}
            onSubmit={submitDriverAssignment}
            submitLabel={assignDriverMutation.isPending ? 'Saving Assignment...' : 'Save Assignment'}
            isSubmitting={assignDriverMutation.isPending}
            submitDisabled={isDriversLoading || driverOptions.length === 0}
          />
        </ModalShell>
      )}

      {tripStartModalOpen && (
        <ModalShell title="Start Trip" onClose={closeTripStartModal}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Vehicle"
              value={tripStartForm.vehicleId}
              onChange={value => setTripStartForm(current => ({ ...current, vehicleId: value }))}
              options={visibleVehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.name} (${vehicle.registrationNumber ?? vehicle.vehicleType})` }))}
            />
            {canManageTransport ? (
              <SelectField
                label="Driver"
                value={tripStartForm.driverId}
                onChange={value => setTripStartForm(current => ({ ...current, driverId: value }))}
                options={driverOptions}
                placeholder={isDriversLoading ? 'Loading drivers...' : 'Select'}
                disabled={isDriversLoading || driverOptions.length === 0}
              />
            ) : (
              <TextField
                label="Driver"
                value={user?.name ?? 'Assigned Driver'}
                onChange={() => {}}
                disabled
              />
            )}
            <TextField
              label="Start Odometer (km)"
              type="number"
              value={tripStartForm.odometerKm}
              onChange={value => setTripStartForm(current => ({ ...current, odometerKm: value }))}
              placeholder="12450"
            />
            <SelectField
              label="Purpose"
              value={tripStartForm.purpose}
              onChange={value => setTripStartForm(current => ({ ...current, purpose: value }))}
              options={purposeOptions.map(option => ({ value: option, label: option }))}
            />
            <div className="md:col-span-2">
              <LocationField
                label="Origin"
                value={tripStartForm.origin}
                state={startLocationState}
                onRefresh={() => void fetchStartLocation(true)}
                onManualChange={value => setTripStartForm(current => ({ ...current, origin: value, address: value }))}
                manualPlaceholder="Enter origin address manually"
              />
            </div>
            <div className="md:col-span-2">
              <AutocompleteField
                label="Destination"
                value={tripStartForm.destination}
                onChange={value => {
                  setTripStartDestinationPoint(null)
                  setTripStartForm(current => ({ ...current, destination: value }))
                }}
                onSelect={suggestion => {
                  setTripStartDestinationPoint(suggestion.location)
                  setTripStartForm(current => ({
                    ...current,
                    destination: suggestion.address,
                  }))
                  setDestinationSuggestions([])
                }}
                suggestions={destinationSuggestions}
                isLoading={destinationSearchLoading}
                error={destinationSearchError}
                placeholder="Search destination"
              />
            </div>
          </div>
          <ModalActions
            onClose={closeTripStartModal}
            onSubmit={submitTripStart}
            submitLabel={startTripMutation.isPending ? 'Starting Trip...' : 'Start Trip'}
            isSubmitting={startTripMutation.isPending}
          />
        </ModalShell>
      )}

      {selectedTripForEnd && (
        <ModalShell title={`End Trip - ${selectedTripForEnd.vehicleName}`} onClose={closeTripEndModal}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <LocationField
                label="Destination"
                value={tripEndForm.destination}
                state={endLocationState}
                onRefresh={() => void fetchEndLocation(true)}
                onManualChange={value => setTripEndForm(current => ({ ...current, destination: value, address: value }))}
                manualPlaceholder="Enter destination manually"
              />
            </div>
            <TextField
              label="End Odometer (km)"
              type="number"
              value={tripEndForm.odometerKm}
              onChange={value => setTripEndForm(current => ({ ...current, odometerKm: value }))}
              placeholder="12528"
            />
            <TextField
              label="Remarks (Optional)"
              value={tripEndForm.remarks}
              onChange={value => setTripEndForm(current => ({ ...current, remarks: value }))}
              placeholder="Wrap complete, returning to base"
            />
          </div>
          <ModalActions
            onClose={closeTripEndModal}
            onSubmit={submitTripEnd}
            submitLabel={endTripMutation.isPending ? 'Ending Trip...' : 'End Trip'}
            isSubmitting={endTripMutation.isPending}
          />
        </ModalShell>
      )}

      {fuelModalOpen && (
        <ModalShell title="Log Fuel" onClose={() => setFuelModalOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Vehicle"
              value={fuelForm.vehicleId}
              onChange={value => setFuelForm(current => ({ ...current, vehicleId: value }))}
              options={visibleVehicles.map(vehicle => ({ value: vehicle.id, label: vehicle.name }))}
            />
            <SelectField
              label="Related Trip"
              value={fuelForm.tripId}
              onChange={value => setFuelForm(current => ({ ...current, tripId: value }))}
              options={[{ value: '', label: 'No linked trip' }, ...activeTrips.map(trip => ({ value: trip.id, label: `${trip.vehicleName} - ${trip.driverName ?? 'Driver'}` }))]}
            />
            <TextField label="Litres" type="number" value={fuelForm.liters} onChange={value => setFuelForm(current => ({ ...current, liters: value }))} placeholder="18.5" />
            <TextField label="Cost" type="number" value={fuelForm.cost} onChange={value => setFuelForm(current => ({ ...current, cost: value }))} placeholder="2200" />
            <TextField label="Odometer (km)" type="number" value={fuelForm.odometerKm} onChange={value => setFuelForm(current => ({ ...current, odometerKm: value }))} placeholder="12528" />
            <TextField label="Notes" value={fuelForm.notes} onChange={value => setFuelForm(current => ({ ...current, notes: value }))} placeholder="Shell station near ECR" />
            <FileField label="Receipt Image" onChange={file => setFuelForm(current => ({ ...current, receiptImage: file }))} />
            <FileField label="Odometer Image" onChange={file => setFuelForm(current => ({ ...current, odometerImage: file }))} />
          </div>
          <ModalActions
            onClose={() => setFuelModalOpen(false)}
            onSubmit={submitFuelLog}
            submitLabel={logFuelMutation.isPending ? 'Uploading Fuel Log...' : 'Submit Fuel Log'}
            isSubmitting={logFuelMutation.isPending}
          />
        </ModalShell>
      )}

      {fuelPreview && (
        <ModalShell title={fuelPreview.title} onClose={() => setFuelPreview(null)} size="xl">
          <div className="mb-4">
            <p className="section-kicker">Image Preview</p>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <img src={fuelPreview.src} alt={fuelPreview.title} className="max-h-[70vh] w-full object-contain" />
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function FuelLedger({
  fuelLogs,
  canManageTransport,
  onReviewFuel,
  reviewFuelPending,
  onPreview,
}: {
  fuelLogs: FuelLogUI[]
  canManageTransport: boolean
  onReviewFuel: (id: string, auditStatus: 'verified' | 'mismatch') => void
  reviewFuelPending: boolean
  onPreview: (preview: { title: string; src: string }) => void
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/20 dark:border-zinc-800 dark:bg-zinc-950/20">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] table-fixed border-collapse">
          <thead>
            <tr className="border-b border-zinc-200/80 dark:border-zinc-800">
              <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Date</th>
              <th className="px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Vehicle</th>
              <th className="px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Driver</th>
              <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Litres</th>
              <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Cost</th>
              <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Expected</th>
              <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Actual</th>
              <th className="px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Status</th>
              <th className="px-4 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Receipt Image</th>
              <th className="px-6 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Odometer Image</th>
            </tr>
          </thead>
          <tbody>
            {fuelLogs.map(row => {
              const receiptUrl = resolveUploadUrl(row.receiptFilePath)
              const odometerUrl = resolveUploadUrl(row.odometerImagePath)

              return (
                <tr key={row.id} className="border-b border-zinc-200/70 last:border-b-0 dark:border-zinc-800">
                  <td className="px-6 py-5 text-sm font-medium text-zinc-900 dark:text-white">{formatDate(row.logDate)}</td>
                  <td className="px-4 py-5 text-sm font-medium text-zinc-900 dark:text-white">{row.vehicleName}</td>
                  <td className="px-4 py-5 text-sm text-zinc-600 dark:text-zinc-300">{row.loggedByName ?? row.loggedBy}</td>
                  <td className="px-4 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">{row.liters.toFixed(1)}L</td>
                  <td className="px-4 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.cost ?? 0)}</td>
                  <td className="px-4 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">{row.expectedMileage.toFixed(1)} km/L</td>
                  <td className="px-4 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">{row.actualMileage.toFixed(1)} km/L</td>
                  <td className="px-4 py-5">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge variant={row.efficiencyRating === 'good' ? 'verified' : 'mismatch'} label={row.auditStatus} />
                      {row.fraudStatus !== 'NORMAL' && (
                        <StatusBadge variant={row.fraudStatus === 'FRAUD' ? 'flagged' : 'warning'} label={row.fraudStatus} />
                      )}
                      {row.metadata?.ocrStatus === 'processing' && <StatusBadge variant="pending" label="OCR Pending" />}
                    </div>
                    {(canManageTransport || row.reviewedAt || row.approvalNote) && (
                      <div className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {canManageTransport && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => onReviewFuel(row.id, 'verified')}
                              className="btn-soft rounded-full px-3 py-2 text-[10px]"
                              disabled={reviewFuelPending}
                            >
                              {reviewFuelPending ? 'Working...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => onReviewFuel(row.id, 'mismatch')}
                              className="btn-soft rounded-full px-3 py-2 text-[10px]"
                              disabled={reviewFuelPending}
                            >
                              {reviewFuelPending ? 'Working...' : 'Flag'}
                            </button>
                          </div>
                        )}
                        {row.reviewedAt && (
                          <p>
                            Reviewed {formatDate(row.reviewedAt)} {formatTime(row.reviewedAt)}
                          </p>
                        )}
                        {row.approvalNote && <p>{row.approvalNote}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-5 text-center">
                    {receiptUrl ? (
                      <button
                        onClick={() => onPreview({ title: `${row.vehicleName} Receipt`, src: receiptUrl })}
                        className="btn-soft rounded-full px-3 py-2 text-[10px]"
                      >
                        Preview
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">Unavailable</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    {odometerUrl ? (
                      <button
                        onClick={() => onPreview({ title: `${row.vehicleName} Odometer`, src: odometerUrl })}
                        className="btn-soft rounded-full px-3 py-2 text-[10px]"
                      >
                        Preview
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">Unavailable</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-zinc-200/80 lg:hidden dark:divide-zinc-800">
        {fuelLogs.map(row => {
          const receiptUrl = resolveUploadUrl(row.receiptFilePath)
          const odometerUrl = resolveUploadUrl(row.odometerImagePath)

          return (
            <div key={row.id} className="px-6 py-5">
              <div className="grid gap-5 lg:grid-cols-[1.05fr,1fr,0.75fr,0.6fr,0.72fr,0.78fr,0.78fr,1.18fr,0.82fr,0.9fr] lg:items-center">
                <LedgerCell label="Date">
                  <p className="font-medium text-zinc-900 dark:text-white">{formatDate(row.logDate)}</p>
                </LedgerCell>
                <LedgerCell label="Vehicle">
                  <p className="font-medium text-zinc-900 dark:text-white">{row.vehicleName}</p>
                </LedgerCell>
                <LedgerCell label="Driver">
                  <p>{row.loggedByName ?? row.loggedBy}</p>
                </LedgerCell>
                <LedgerCell label="Litres" align="right">
                  <p>{row.liters.toFixed(1)}L</p>
                </LedgerCell>
                <LedgerCell label="Cost" align="right">
                  <p>{formatCurrency(row.cost ?? 0)}</p>
                </LedgerCell>
                <LedgerCell label="Expected km/L" align="right">
                  <p>{row.expectedMileage.toFixed(1)} km/L</p>
                </LedgerCell>
                <LedgerCell label="Actual km/L" align="right">
                  <p>{row.actualMileage.toFixed(1)} km/L</p>
                </LedgerCell>
                <LedgerCell label="Status">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant={row.efficiencyRating === 'good' ? 'verified' : 'mismatch'} label={row.auditStatus} />
                    {row.fraudStatus !== 'NORMAL' && (
                      <StatusBadge variant={row.fraudStatus === 'FRAUD' ? 'flagged' : 'warning'} label={row.fraudStatus} />
                    )}
                    {row.metadata?.ocrStatus === 'processing' && (
                      <StatusBadge variant="pending" label="OCR Pending" />
                    )}
                  </div>
                  {(canManageTransport || row.reviewedAt || row.approvalNote) && (
                    <div className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {canManageTransport && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => onReviewFuel(row.id, 'verified')}
                            className="btn-soft rounded-full px-3 py-2 text-[10px]"
                            disabled={reviewFuelPending}
                          >
                            {reviewFuelPending ? 'Working...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => onReviewFuel(row.id, 'mismatch')}
                            className="btn-soft rounded-full px-3 py-2 text-[10px]"
                            disabled={reviewFuelPending}
                          >
                            {reviewFuelPending ? 'Working...' : 'Flag'}
                          </button>
                        </div>
                      )}
                      {row.reviewedAt && (
                        <p>
                          Reviewed {formatDate(row.reviewedAt)} {formatTime(row.reviewedAt)}
                        </p>
                      )}
                      {row.approvalNote && <p>{row.approvalNote}</p>}
                    </div>
                  )}
                </LedgerCell>
                <LedgerCell label="Receipt Image" align="right">
                  {receiptUrl ? (
                    <button
                      onClick={() => onPreview({ title: `${row.vehicleName} Receipt`, src: receiptUrl })}
                      className="btn-soft rounded-full px-3 py-2 text-[10px]"
                    >
                      Preview
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-400">Unavailable</span>
                  )}
                </LedgerCell>
                <LedgerCell label="Odometer Image" align="right">
                  {odometerUrl ? (
                    <button
                      onClick={() => onPreview({ title: `${row.vehicleName} Odometer`, src: odometerUrl })}
                      className="btn-soft rounded-full px-3 py-2 text-[10px]"
                    >
                      Preview
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-400">Unavailable</span>
                  )}
                </LedgerCell>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AlertRows({
  alerts,
  vehicles,
  trips,
}: {
  alerts: Array<{
    id: string
    alertType: string
    message: string
    severity: 'critical' | 'warning' | 'info'
    vehicleId?: string | null
    tripId?: string | null
    triggeredAt: string
  }>
  vehicles: Vehicle[]
  trips: TripUI[]
}) {
  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`rounded-[22px] border px-4 py-3 ${alertSeveritySurfaceTone(alert.severity)}`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {alert.alertType.toUpperCase()}
                </span>
                <span className={alertSeverityBadgeTone(alert.severity)}>{alert.severity}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{transportAlertTitle(alert)}</p>
              <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-zinc-700 dark:text-zinc-200">{alert.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Vehicle</span>
                  <p className="mt-1 font-medium text-zinc-900 dark:text-white">{resolveAlertVehicle(alert, vehicles, trips)}</p>
                </div>
                <div className="md:hidden">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Time</span>
                  <p className="mt-1 font-medium text-zinc-900 dark:text-white">{formatDate(alert.triggeredAt)}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatTime(alert.triggeredAt)}</p>
                </div>
              </div>
            </div>

            <div className="hidden shrink-0 text-right md:block">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatDate(alert.triggeredAt)}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatTime(alert.triggeredAt)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function transportAlertTitle(alert: {
  alertType: string
  severity: 'critical' | 'warning' | 'info'
}) {
  if (alert.severity === 'critical' || alert.alertType === 'fuel_mismatch' || alert.alertType === 'low_mileage') {
    return 'Potential fuel fraud detected'
  }

  if (alert.alertType === 'odometer_mismatch') {
    return 'Odometer mismatch detected'
  }

  if (alert.alertType === 'outstation_trip') {
    return 'Outstation movement detected'
  }

  if (alert.alertType === 'abnormal_trip') {
    return 'Suspicious trip pattern detected'
  }

  return prettifyAlertType(alert.alertType)
}

function alertSeveritySurfaceTone(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') {
    return 'border-red-500/25 bg-red-500/10'
  }

  if (severity === 'warning') {
    return 'border-amber-500/25 bg-amber-500/10'
  }

  return 'border-sky-500/25 bg-sky-500/10'
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

function mapTripStatus(status: TripUI['status']): 'active' | 'completed' | 'flagged' | 'pending' {
  if (status === 'planned') {
    return 'pending'
  }

  if (status === 'cancelled') {
    return 'completed'
  }

  return status
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

function resolveAlertVehicle(
  alert: { vehicleId?: string | null; tripId?: string | null },
  vehicles: Vehicle[],
  trips: TripUI[],
) {
  const vehicle = vehicles.find(item => item.id === alert.vehicleId)
  if (vehicle) {
    return vehicle.name
  }

  const trip = trips.find(item => item.id === alert.tripId)
  if (trip) {
    return trip.vehicleName
  }

  return 'Linked record'
}

function resolveUploadUrl(path: string | null) {
  if (!path) {
    return null
  }

  return `${apiOrigin()}/uploads/${path.replace(/^\/+/, '')}`
}

function ModalShell({
  title,
  children,
  onClose,
  size = 'lg',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'lg' | 'xl'
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm pt-safe">
      <div className={`clay-panel w-full ${size === 'xl' ? 'max-w-5xl' : 'max-w-4xl'} p-6 sm:p-7 flex flex-col max-h-[85vh]`}>
        <div className="flex items-center justify-between gap-4 shrink-0">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="clay-icon-button">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto custom-scrollbar pr-2">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  onClose,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  submitDisabled = false,
}: {
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  isSubmitting?: boolean
  submitDisabled?: boolean
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button onClick={onClose} className="clay-ghost-button" disabled={isSubmitting}>Cancel</button>
      <button onClick={onSubmit} className="clay-primary-button" disabled={submitDisabled || isSubmitting}>
        {isSubmitting ? <span className="ui-spinner" /> : null}
        {submitLabel}
      </button>
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

function VehicleCardMetric({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-[150px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-2 ${strong ? 'text-base font-semibold text-zinc-900 dark:text-white' : 'text-sm text-zinc-700 dark:text-zinc-200'}`}>{value}</p>
    </div>
  )
}

function InlineBanner({
  tone,
  message,
}: {
  tone: 'warning' | 'danger'
  message: string
}) {
  const className = tone === 'danger'
    ? 'mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:bg-red-500/20 dark:text-red-400'
    : 'mb-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'

  return <div className={className}>{message}</div>
}

function LedgerCell({
  label,
  children,
  align = 'left',
}: {
  label: string
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <div className={align === 'right' ? 'text-left xl:text-right' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 xl:hidden">{label}</p>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{children}</div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  disabled?: boolean
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="project-modal-control"
        placeholder={placeholder}
        disabled={disabled}
      />
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
      <input type="date" value={value} onChange={event => onChange(event.target.value)} className="project-modal-control" />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select',
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="project-modal-select" disabled={disabled}>
        <option value="">{placeholder}</option>
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
      <input type="file" accept="image/*" onChange={event => onChange(event.target.files?.[0] ?? null)} className="project-modal-control" />
    </label>
  )
}

function LocationField({
  label,
  value,
  state,
  onRefresh,
  onManualChange,
  manualPlaceholder,
}: {
  label: string
  value: string
  state: LocationFetchState
  onRefresh: () => void
  onManualChange?: (value: string) => void
  manualPlaceholder?: string
}) {
  const showManualEntry = state.status === 'error' && Boolean(onManualChange)

  return (
    <div className="auth-field">
      <div className="flex items-center justify-between gap-4">
        <span className="auth-field-label">{label}</span>
        <button onClick={onRefresh} type="button" className="btn-soft px-3 py-2 text-[10px]">
          {state.status === 'error' ? 'Retry GPS' : 'Refresh GPS'}
        </button>
      </div>
      <div className="rounded-[1.4rem] border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className={`text-sm ${state.status === 'error' ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {state.status === 'error'
            ? 'Unable to fetch location. Please enter manually.'
            : state.status === 'fetching'
              ? 'Fetching location...'
              : state.message || 'GPS location will appear here.'}
        </p>
        {showManualEntry ? (
          <>
            {state.message && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{state.message}</p>
            )}
            <input
              value={value}
              onChange={event => onManualChange?.(event.target.value)}
              className="project-modal-control mt-3"
              placeholder={manualPlaceholder ?? 'Enter location manually'}
            />
          </>
        ) : (
          <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">
            {value || 'Waiting for GPS fix'}
          </p>
        )}
      </div>
    </div>
  )
}

function AutocompleteField({
  label,
  value,
  onChange,
  onSelect,
  suggestions,
  isLoading,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: LocationSuggestion) => void
  suggestions: LocationSuggestion[]
  isLoading: boolean
  error: string | null
  placeholder?: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <div className="relative">
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className="project-modal-control"
          placeholder={placeholder}
        />
        {(isLoading || error || suggestions.length > 0) && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-[1.4rem] border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {isLoading && (
              <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Searching destinations...</div>
            )}
            {!isLoading && error && (
              <div className="px-4 py-3 text-sm text-red-500 dark:text-red-400">{error}</div>
            )}
            {!isLoading && !error && suggestions.map(suggestion => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => onSelect(suggestion)}
                className="block w-full border-b border-zinc-200 px-4 py-3 text-left text-sm text-zinc-700 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <p className="font-medium text-zinc-900 dark:text-white">{suggestion.label}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{suggestion.address}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  )
}
