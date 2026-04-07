import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCrewData } from '../hooks/useCrewData'
import { KpiCard } from '@/components/shared/KpiCard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState, ErrorState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { crewService } from '@/services/crew.service'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { formatCurrency, formatDate, formatTime } from '@/utils'
import type { CrewAttendanceHistoryItem, CrewDashboardData, CrewLocationPoint, CrewMember, CrewProjectLocation, WagePayout } from '@/types'

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'

const editButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600 shadow-[0_0_0_1px_rgba(249,115,22,0.08)] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-500/40 dark:bg-zinc-950 dark:text-orange-300 dark:hover:bg-orange-500/10'

const inputClass =
  'w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white'

const suggestionPanelClass =
  'absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[20px] border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950'

type PaymentMethod = 'UPI' | 'CASH' | 'BANK'
type LocationSearchResult = { name: string; lat: number; lng: number }

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${remainingSeconds}`
}

function calculateLiveOtMinutes(checkInTime: string | null, reference = new Date()) {
  if (!checkInTime) {
    return 0
  }

  const checkIn = new Date(checkInTime)
  if (Number.isNaN(checkIn.getTime()) || reference.getTime() <= checkIn.getTime()) {
    return 0
  }

  const localDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(checkIn)

  const otStart = new Date(`${localDay}T18:00:00+05:30`)
  const effectiveStart = checkIn.getTime() > otStart.getTime() ? checkIn : otStart

  if (reference.getTime() <= effectiveStart.getTime()) {
    return 0
  }

  return Math.floor((reference.getTime() - effectiveStart.getTime()) / 60000)
}

function formatCoordinates(location: CrewLocationPoint | null | undefined) {
  if (!location) {
    return '--'
  }

  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
}

function payoutStatusVariant(status: WagePayout['status']) {
  if (status === 'paid') return 'paid' as const
  if (status === 'approved') return 'approved' as const
  if (status === 'rejected') return 'rejected' as const
  return 'requested' as const
}

function shiftStatusVariant(state: CrewMember['status']) {
  if (state === 'ot') return 'ot' as const
  if (state === 'offduty') return 'idle' as const
  return 'active' as const
}

function buildMapLink(location: CrewLocationPoint | null | undefined) {
  if (!location) {
    return null
  }

  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`
}

function normalizeRoleToken(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function sanitizeLocationName(value: string) {
  return value.trim().slice(0, 255)
}

function getLocationDraft(
  projectLocation: CrewProjectLocation | null | undefined,
  deviceLocation: CrewLocationPoint | null,
  deviceLocationName: string,
) {
  if (projectLocation) {
    return {
      locationName: projectLocation.name,
      latitude: String(projectLocation.latitude),
      longitude: String(projectLocation.longitude),
      radiusMeters: projectLocation.radiusMeters,
      locationSearch: projectLocation.name,
    }
  }

  return {
    locationName: deviceLocationName || 'Project Base',
    latitude: deviceLocation ? String(deviceLocation.lat) : '',
    longitude: deviceLocation ? String(deviceLocation.lng) : '',
    radiusMeters: 200,
    locationSearch: deviceLocationName,
  }
}

function requestBrowserLocation() {
  return new Promise<CrewLocationPoint>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
          timestamp: new Date(position.timestamp).toISOString(),
        })
      },
      error => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('GPS permission was denied. Please allow location access and retry.'))
            return
          case error.TIMEOUT:
            reject(new Error('GPS is taking too long. Move to an open area and retry.'))
            return
          default:
            reject(new Error(error.message || 'Unable to read your current location.'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    )
  })
}

export function CrewView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, isLoading, isError, summary, permissions, projectLocation, hasProjectLocationLoaded, myShift, myRecords, crew, battaQueue, payouts, refetch } = useCrewData()
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [shiftGpsError, setShiftGpsError] = useState<string | null>(null)
  const [locationGpsError, setLocationGpsError] = useState<string | null>(null)
  const [battaAmount, setBattaAmount] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [radiusMeters, setRadiusMeters] = useState(200)
  const [locationName, setLocationName] = useState('Project Base')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLocationDraftDirty, setIsLocationDraftDirty] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null)
  const [deviceLocation, setDeviceLocation] = useState<CrewLocationPoint | null>(null)
  const [deviceLocationName, setDeviceLocationName] = useState<string>('')
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({})
  const [nowTick, setNowTick] = useState(() => Date.now())
  const locationFetchedRef = useRef(false)

  const userRoleToken = normalizeRoleToken(user?.role)
  const userRoleLabelToken = normalizeRoleToken(user?.roleLabel)
  const userProjectRoleToken = normalizeRoleToken(user?.projectRoleTitle)
  const canEditGeofence = Boolean(
    permissions.canManageLocation &&
    (
      !user ||
      userRoleToken === 'ADMIN' ||
      userRoleToken === 'PRODUCTION_MANAGER' ||
      userRoleLabelToken === 'ADMIN' ||
      userRoleLabelToken === 'PRODUCTION_MANAGER' ||
      userProjectRoleToken === 'PRODUCTION_MANAGER' ||
      userProjectRoleToken === 'TRANSPORT_CAPTAIN'
    )
  )
  const isSavingLocation = activeAction === 'crew-location-update'

  useEffect(() => {
    locationFetchedRef.current = false
  }, [activeProjectId])

  const checkInMutation = useMutation({
    mutationFn: (payload: CrewLocationPoint) => crewService.checkIn(activeProjectId!, payload),
  })
  const checkOutMutation = useMutation({
    mutationFn: (payload: CrewLocationPoint) => crewService.checkOut(activeProjectId!, payload),
  })
  const requestBattaMutation = useMutation({
    mutationFn: (amount: number) => crewService.requestBatta(activeProjectId!, amount),
  })
  const approveBattaMutation = useMutation({
    mutationFn: (payoutId: string) => crewService.approveBatta(activeProjectId!, payoutId),
  })
  const markBattaPaidMutation = useMutation({
    mutationFn: ({ payoutId, paymentMethod }: { payoutId: string; paymentMethod: PaymentMethod }) =>
      crewService.markBattaPaid(activeProjectId!, payoutId, paymentMethod),
  })
  const updateLocationMutation = useMutation({
    mutationFn: (payload: { projectId: string; name: string; lat: number; lng: number; radius: number }) =>
      crewService.updateProjectLocation(payload),
  })

  useEffect(() => {
    if (isEditing) {
      return
    }

    const nextDraft = getLocationDraft(projectLocation, deviceLocation, deviceLocationName)
    setRadiusMeters(nextDraft.radiusMeters)
    setLocationName(nextDraft.locationName)
    setLatitude(nextDraft.latitude)
    setLongitude(nextDraft.longitude)
    setLocationSearch(nextDraft.locationSearch)
    setIsLocationDraftDirty(false)
    setSelectedLocation(null)
    setSearchResults([])
    setSearchError(null)
  }, [deviceLocation, deviceLocationName, isEditing, projectLocation])

  useEffect(() => {
    if (myShift.state !== 'checked_in') {
      return
    }

    const timer = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [myShift.state])

  useEffect(() => {
    if (!activeProjectId || !hasProjectLocationLoaded || projectLocation || locationFetchedRef.current) {
      return
    }

    locationFetchedRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const location = await requestBrowserLocation()
        if (cancelled) {
          return
        }

        setDeviceLocation(location)

        const reverse = await crewService.reverseGeocode(activeProjectId, location)
        if (cancelled) {
          return
        }

        const resolvedName = sanitizeLocationName(reverse.name?.trim() || 'Location unavailable') || 'Location unavailable'
        setDeviceLocationName(resolvedName)
      } catch (error) {
        if (cancelled) {
          return
        }

        setLocationGpsError(resolveErrorMessage(error, 'Auto location is unavailable. You can still search or enter a location manually.'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeProjectId, hasProjectLocationLoaded, projectLocation])

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    if (!isEditing) {
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      return
    }

    const trimmedQuery = locationSearch.trim()
    if (trimmedQuery.length < 2) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true)
      setSearchError(null)

      void crewService.searchLocations(activeProjectId, trimmedQuery)
        .then(results => {
          if (cancelled) {
            return
          }

          if (!selectedLocation) {
            setSearchResults(results)
          }

          if (!selectedLocation && results.length === 0) {
            setSearchError('No matching OSM locations found. You can still adjust manually.')
          }
        })
        .catch(error => {
          if (cancelled) {
            return
          }

          setSearchResults([])
          setSearchError(resolveErrorMessage(error, 'Location search failed.'))
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false)
          }
        })
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeProjectId, isEditing, locationSearch, selectedLocation])

  const liveWorkingSeconds = myShift.state === 'checked_in' && myShift.checkInTime
    ? Math.max(0, Math.floor((nowTick - new Date(myShift.checkInTime).getTime()) / 1000))
    : myShift.workingSeconds
  const liveOtMinutes = myShift.state === 'checked_in'
    ? calculateLiveOtMinutes(myShift.checkInTime, new Date(nowTick))
    : myShift.otMinutes

  const linkedAttendanceIds = useMemo(() => {
    const ids = new Set<string>()
    if (myShift.attendanceId) {
      ids.add(myShift.attendanceId)
    }
    myRecords.forEach(record => ids.add(record.id))
    return ids
  }, [myRecords, myShift.attendanceId])

  const myPayouts = payouts.filter(payout => payout.attendanceId && linkedAttendanceIds.has(payout.attendanceId))
  const currentAttendancePayout = payouts.find(payout => payout.attendanceId === myShift.attendanceId)
  const battaStatusByAttendanceId = new Map(
    payouts
      .filter(payout => payout.attendanceId)
      .map(payout => [payout.attendanceId as string, payout.status]),
  )

  const hasData = crew.length > 0 || battaQueue.length > 0 || myRecords.length > 0

  async function invalidateCrewQueries() {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['crew-dashboard', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['crew-location', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['crew', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['ot-groups', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['wage-payouts', activeProjectId] }),
    ])
  }

  async function runAction(key: string, loadingMessage: string, successMessage: string, action: () => Promise<unknown>) {
    setActiveAction(key)
    showLoading(loadingMessage, { id: key })

    try {
      await action()
      await invalidateCrewQueries()
      showSuccess(successMessage, { id: key })
    } catch (error) {
      await invalidateCrewQueries()
      showError(resolveErrorMessage(error, 'Crew action failed.'), { id: key })
    } finally {
      setActiveAction(null)
    }
  }

  async function handleShiftStart() {
    if (!activeProjectId) {
      return
    }

    setShiftGpsError(null)
    await runAction('crew-check-in', 'Capturing GPS and starting shift...', 'Check-in success', async () => {
      try {
        const location = await requestBrowserLocation()
        await checkInMutation.mutateAsync(location)
      } catch (error) {
        const message = resolveErrorMessage(error, 'Unable to capture GPS location.')
        setShiftGpsError(message)
        throw new Error(message)
      }
    })
  }

  async function handleShiftEnd() {
    if (!activeProjectId) {
      return
    }

    setShiftGpsError(null)
    await runAction('crew-check-out', 'Capturing GPS and ending shift...', 'Check-out success', async () => {
      try {
        const location = await requestBrowserLocation()
        await checkOutMutation.mutateAsync(location)
      } catch (error) {
        const message = resolveErrorMessage(error, 'Unable to capture GPS location.')
        setShiftGpsError(message)
        throw new Error(message)
      }
    })
  }

  async function handleBattaRequest() {
    const amount = Number(battaAmount)
    await runAction('crew-batta-request', 'Submitting batta request...', 'Batta requested', async () => {
      await requestBattaMutation.mutateAsync(amount)
      setBattaAmount('')
    })
  }

  async function handleApproveBatta(payoutId: string) {
    await runAction(`approve-${payoutId}`, 'Approving batta request...', 'Approval done', async () => {
      await approveBattaMutation.mutateAsync(payoutId)
    })
  }

  async function handleMarkPaid(payoutId: string) {
    const paymentMethod = paymentMethods[payoutId] ?? 'CASH'
    await runAction(`pay-${payoutId}`, 'Marking batta as paid...', 'Payment recorded', async () => {
      await markBattaPaidMutation.mutateAsync({ payoutId, paymentMethod })
    })
  }

  async function handleProjectLocationSave() {
    if (!activeProjectId) {
      return
    }

    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)
    const parsedRadius = Number(radiusMeters)
    const safeName = sanitizeLocationName(locationName) || sanitizeLocationName(selectedLocation?.name ?? '') || deviceLocationName || 'Project Base'

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) || !Number.isFinite(parsedRadius)) {
      showError('Invalid location data', { id: 'crew-location-update' })
      return
    }

    setActiveAction('crew-location-update')
    showLoading('Updating project location...', { id: 'crew-location-update' })

    try {
      const response = await updateLocationMutation.mutateAsync({
        projectId: activeProjectId,
        name: safeName,
        lat: Number(parsedLatitude),
        lng: Number(parsedLongitude),
        radius: Number(parsedRadius),
      })

      const savedLocation = response.projectLocation
      if (savedLocation) {
        queryClient.setQueryData(['crew-location', activeProjectId], savedLocation)
        queryClient.setQueryData<CrewDashboardData | undefined>(['crew-dashboard', activeProjectId], current =>
          current ? { ...current, projectLocation: savedLocation } : current,
        )
      }

      await invalidateCrewQueries()
      setIsEditing(false)
      setIsLocationDraftDirty(false)
      setSelectedLocation(null)
      setSearchResults([])
      setSearchError(null)
      showSuccess('Project location updated', { id: 'crew-location-update' })
    } catch (error) {
      await invalidateCrewQueries()
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : null
      showError(status === 400 ? 'Invalid location data' : resolveErrorMessage(error, 'Unable to save project location.'), { id: 'crew-location-update' })
    } finally {
      setActiveAction(null)
    }
  }

  function handleLocationSelect(result: LocationSearchResult) {
    setIsLocationDraftDirty(true)
    setSelectedLocation(result)
    setLocationName(result.name)
    setLocationSearch(result.name)
    setLatitude(String(result.lat))
    setLongitude(String(result.lng))
    setSearchResults([])
    setSearchError(null)
  }

  function handleLocationCancel() {
    const nextDraft = getLocationDraft(projectLocation, deviceLocation, deviceLocationName)
    setRadiusMeters(nextDraft.radiusMeters)
    setLocationName(nextDraft.locationName)
    setLatitude(nextDraft.latitude)
    setLongitude(nextDraft.longitude)
    setLocationSearch(nextDraft.locationSearch)
    setSelectedLocation(null)
    setSearchResults([])
    setSearchError(null)
    setLocationGpsError(null)
    setIsLocationDraftDirty(false)
    setIsEditing(false)
  }

  if (isLoading) return <LoadingState message="Loading crew control..." />
  if (isError) return <ErrorState message="Failed to load crew data" retry={() => void refetch()} />

  return (
    <div className="page-shell space-y-6">
      <header className="page-header">
        <div>
          <span className="page-kicker">Digital Punch Card + Cash Engine</span>
          <h1 className="page-title page-title-compact">Crew Control Center</h1>
          <p className="page-subtitle">GPS-verified attendance, OT calculation after 6 PM, batta approvals, and OSM-only location visibility.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge variant="verified" label="OSM + Browser GPS" />
          {permissions.summaryOnly && <StatusBadge variant="stable" label="Summary Only" />}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Crew" value={String(summary.totalCrew)} subLabel="Checked in today" />
        <KpiCard label="Active OT Crew" value={String(summary.activeOTCrew)} subLabel="Live after 6 PM" />
        <KpiCard label="Total OT Cost" value={formatCurrency(summary.totalOTCost, 'INR')} subLabel="Rate-aware estimate" />
        <KpiCard label="Batta Requested" value={formatCurrency(summary.battaRequested, 'INR')} subLabel="Pending approvals" />
        <KpiCard label="Batta Paid" value={formatCurrency(summary.battaPaid, 'INR')} subLabel="Settled cash engine" />
      </section>

      {permissions.summaryOnly ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Project Geofence</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Read-only location summary for EP and LP visibility.</p>
            </div>
            <div className="space-y-4">
              <ShiftInfo label="Location" value={projectLocation?.name ?? 'Not configured'} />
              <ShiftInfo label="Coordinates" value={projectLocation ? `${projectLocation.latitude.toFixed(5)}, ${projectLocation.longitude.toFixed(5)}` : '--'} link={projectLocation?.mapLink} />
              <ShiftInfo label="Radius" value={projectLocation ? `${projectLocation.radiusMeters} m` : '--'} />
              <ShiftInfo label="Last Updated" value={projectLocation?.createdAt ? `${formatDate(projectLocation.createdAt)} - ${formatTime(projectLocation.createdAt)}` : '--'} />
            </div>
          </Surface>
          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">Recent Payout Activity</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Read-only batta settlement trail for financial monitoring.</p>
            </div>
            {payouts.length === 0 ? (
              <EmptyState icon="currency_rupee" title="No payout activity yet" description="Crew payouts will appear here once the first attendance-backed batta request is processed." />
            ) : (
              <div className="space-y-3">
                {payouts.slice(0, 6).map(payout => (
                  <div key={payout.id} className="flex items-center justify-between gap-4 rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{payout.crewName}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatDate(payout.timestamp)} - {payout.method}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{formatCurrency(payout.amount, 'INR')}</span>
                      <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      ) : (
        <>
      {!projectLocation && (
        <Surface variant="warning" padding="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-title">Project Location Missing</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Attendance cannot be verified until a Production Manager, Admin, or Transport Captain sets the active geofence.
              </p>
            </div>
            {canEditGeofence && (
              <button onClick={() => setIsEditing(true)} disabled={activeAction !== null} className="btn-primary">
                Configure Geofence
              </button>
            )}
          </div>
        </Surface>
      )}

      {shiftGpsError && (
        <Surface variant="warning" padding="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-title">GPS Retry Needed</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{shiftGpsError}</p>
            </div>
            <button
              onClick={() => {
                if (myShift.state === 'checked_in') {
                  void handleShiftEnd()
                  return
                }
                void handleShiftStart()
              }}
              className={secondaryButtonClass}
              disabled={activeAction !== null}
            >
              Retry GPS
            </button>
          </div>
        </Surface>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Surface variant="table" padding="lg">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Today&apos;s Shift</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Start Shift and End Shift are protected by GPS radius checks and duplicate guards.</p>
            </div>
            <StatusBadge
              variant={myShift.otActive ? 'ot' : myShift.state === 'checked_out' ? 'idle' : myShift.state === 'checked_in' ? 'active' : 'requested'}
              label={myShift.otActive ? 'OT Active' : myShift.state === 'checked_out' ? 'Checked Out' : myShift.state === 'checked_in' ? 'Checked In' : 'Not Started'}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Working Time" value={formatDuration(liveWorkingSeconds)} helper={myShift.state === 'checked_in' ? 'Live timer running' : 'Latest recorded total'} />
            <MetricCard label="OT Minutes" value={String(liveOtMinutes)} helper={liveOtMinutes > 0 ? 'Triggered after 6 PM' : 'No overtime yet'} />
            <MetricCard label="GPS Status" value={myShift.geoVerified ? 'Verified' : 'Pending'} helper={myShift.checkInLocation ? formatCoordinates(myShift.checkInLocation) : 'No shift location yet'} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {permissions.canCheckIn && myShift.state === 'not_checked_in' && (
              <button onClick={() => void handleShiftStart()} disabled={activeAction !== null || !projectLocation} className="btn-primary">
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                {activeAction === 'crew-check-in' ? 'Starting...' : 'Start Shift'}
              </button>
            )}

            {permissions.canCheckOut && myShift.state === 'checked_in' && (
              <button onClick={() => void handleShiftEnd()} disabled={activeAction !== null} className="btn-primary">
                <span className="material-symbols-outlined text-sm">stop_circle</span>
                {activeAction === 'crew-check-out' ? 'Ending...' : 'End Shift'}
              </button>
            )}

            {(myShift.state === 'checked_out' || permissions.summaryOnly || !permissions.canCheckIn) && (
              <button className={secondaryButtonClass} disabled>
                {permissions.summaryOnly ? 'Summary View' : myShift.state === 'checked_out' ? 'Shift Closed' : 'Role Restricted'}
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ShiftInfo label="Check In" value={myShift.checkInTime ? `${formatDate(myShift.checkInTime)} - ${formatTime(myShift.checkInTime)}` : '--'} />
            <ShiftInfo label="Check Out" value={myShift.checkOutTime ? `${formatDate(myShift.checkOutTime)} - ${formatTime(myShift.checkOutTime)}` : '--'} />
            <ShiftInfo label="Shift Status" value={myShift.shiftStatus} />
            <ShiftInfo label="Open in Map" value={myShift.checkInLocation ? 'OSM Ready' : '--'} link={buildMapLink(myShift.checkInLocation)} />
          </div>
        </Surface>

        <Surface variant="table" padding="lg">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-title">Project Geofence</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">OSM links only. No Mapbox dependency is used here.</p>
            </div>
            {canEditGeofence && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true)
                  setLocationGpsError(null)
                }}
                className={editButtonClass}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <ShiftInfo label="Location" value={projectLocation?.name ?? 'Not configured'} />
            <ShiftInfo label="Coordinates" value={projectLocation ? `${projectLocation.latitude.toFixed(5)}, ${projectLocation.longitude.toFixed(5)}` : '--'} link={projectLocation?.mapLink} />
            <ShiftInfo label="Radius" value={projectLocation ? `${projectLocation.radiusMeters} m` : '--'} />
            <ShiftInfo label="Last Updated" value={projectLocation?.createdAt ? `${formatDate(projectLocation.createdAt)} - ${formatTime(projectLocation.createdAt)}` : '--'} />
          </div>

          {canEditGeofence ? (
            <div className="mt-6 space-y-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-dashed border-orange-200 bg-white/80 px-4 py-3 text-sm text-zinc-600 dark:border-orange-500/30 dark:bg-zinc-900/70 dark:text-zinc-300">
                <span>
                  {projectLocation
                    ? `Saved geofence: ${projectLocation.name}`
                    : 'No saved geofence yet. GPS will prefill the first draft when available.'}
                </span>
                <StatusBadge variant={isEditing ? 'warning' : 'stable'} label={isEditing ? 'Edit Mode' : 'Read Only'} />
              </div>

              <div className="space-y-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Search Location</span>
                <div className="relative">
                  <input
                    value={locationSearch}
                    disabled={!isEditing || isSavingLocation}
                    onChange={event => {
                      setIsLocationDraftDirty(true)
                      setSelectedLocation(null)
                      setLocationSearch(event.target.value)
                      setSearchError(null)
                    }}
                    placeholder="Search with OpenStreetMap"
                    className={inputClass}
                  />
                  {isEditing && (isSearching || searchResults.length > 0 || searchError) && (
                    <div className={suggestionPanelClass}>
                      {isSearching && <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Searching OSM...</p>}
                      {!isSearching && searchResults.length > 0 && searchResults.map(result => (
                        <button
                          key={`${result.name}-${result.lat}-${result.lng}`}
                          type="button"
                          onClick={() => handleLocationSelect(result)}
                          className="flex w-full flex-col rounded-[16px] px-3 py-2 text-left transition-colors hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        >
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{result.name}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{result.lat.toFixed(5)}, {result.lng.toFixed(5)}</span>
                        </button>
                      ))}
                      {!isSearching && searchResults.length === 0 && searchError && (
                        <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{searchError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Location Name</span>
                  <input
                    value={locationName}
                    readOnly={!isEditing}
                    disabled={isSavingLocation}
                    onChange={event => {
                      setIsLocationDraftDirty(true)
                      setSelectedLocation(null)
                      setLocationName(event.target.value)
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Radius: {radiusMeters}m</span>
                  <input
                    type="range"
                    min={100}
                    max={500}
                    step={10}
                    value={radiusMeters}
                    disabled={!isEditing || isSavingLocation}
                    onChange={event => {
                      setIsLocationDraftDirty(true)
                      setRadiusMeters(Number(event.target.value))
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Latitude</span>
                  <input
                    value={latitude}
                    readOnly={!isEditing}
                    disabled={isSavingLocation}
                    onChange={event => {
                      setIsLocationDraftDirty(true)
                      setSelectedLocation(null)
                      setLatitude(event.target.value)
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Longitude</span>
                  <input
                    value={longitude}
                    readOnly={!isEditing}
                    disabled={isSavingLocation}
                    onChange={event => {
                      setIsLocationDraftDirty(true)
                      setSelectedLocation(null)
                      setLongitude(event.target.value)
                    }}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{deviceLocationName ? `Auto-detected: ${deviceLocationName}` : 'Auto-detect runs once when no saved geofence exists and GPS is available.'}</span>
                {deviceLocation && <span>{formatCoordinates(deviceLocation)} {deviceLocation.accuracy ? `(${deviceLocation.accuracy}m)` : ''}</span>}
              </div>
              {locationGpsError && <p className="text-sm text-amber-600 dark:text-amber-300">{locationGpsError}</p>}
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void handleProjectLocationSave()}
                    disabled={isSavingLocation || !latitude || !longitude || !isLocationDraftDirty}
                    className="btn-primary"
                  >
                    <span className="material-symbols-outlined text-sm">place</span>
                    {isSavingLocation ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLocationCancel}
                    disabled={isSavingLocation}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Click Edit to update the project geofence. Unsaved changes are blocked outside edit mode.</p>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Location updates are limited to Production Manager, Admin, and Transport Captain roles.</p>
          )}
        </Surface>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Surface variant="table" padding="lg">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Batta Flow</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Crew requests, PM approves, and payment is recorded before closure.</p>
            </div>
            {currentAttendancePayout && (
              <StatusBadge variant={payoutStatusVariant(currentAttendancePayout.status)} label={currentAttendancePayout.status} />
            )}
          </div>

          {permissions.canRequestBatta ? (
            <div className="space-y-4">
              <label className="space-y-2 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Batta Amount</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={battaAmount}
                  onChange={event => setBattaAmount(event.target.value)}
                  placeholder="Enter amount"
                  className={inputClass}
                />
              </label>
              <button
                onClick={() => void handleBattaRequest()}
                disabled={activeAction !== null || !myShift.attendanceId || !battaAmount || Boolean(currentAttendancePayout)}
                className="btn-primary"
              >
                <span className="material-symbols-outlined text-sm">currency_rupee</span>
                {activeAction === 'crew-batta-request' ? 'Submitting...' : 'Request Batta'}
              </button>
              {currentAttendancePayout && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">A batta request already exists for this attendance record.</p>
              )}
            </div>
          ) : (
            <EmptyState icon="currency_rupee" title="Batta requests are role-scoped" description="Crew members can request batta after a valid attendance record is available." />
          )}

          <div className="mt-6 space-y-3">
            {myPayouts.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No batta records linked to your recent shifts yet.</p>
            ) : (
              myPayouts.slice(0, 4).map(payout => (
                <div key={payout.id} className="flex items-center justify-between gap-4 rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatCurrency(payout.amount, 'INR')}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatDate(payout.timestamp)} - {payout.method}</p>
                  </div>
                  <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
                </div>
              ))
            )}
          </div>
        </Surface>

        <Surface variant="table" padding="lg">
          <div className="mb-6">
            <p className="section-title">Manager Queue</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Approval and cash completion remain locked until the right stage is reached.</p>
          </div>

          {!permissions.canViewAllCrew ? (
            <EmptyState icon="lock" title="Manager actions restricted" description="Only PM and Transport Captain roles can approve or mark batta as paid." />
          ) : battaQueue.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No batta requests are waiting right now.</p>
          ) : (
            <div className="space-y-4">
              {battaQueue.map(payout => (
                <div key={payout.id} className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{payout.crewName}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{payout.department}</p>
                    </div>
                    <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
                  </div>
                  <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(payout.amount, 'INR')} - {payout.method}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void handleApproveBatta(payout.id)}
                      disabled={activeAction !== null || payout.status !== 'requested'}
                      className="btn-primary px-4 py-2 text-[11px]"
                    >
                      {activeAction === `approve-${payout.id}` ? 'Approving...' : 'Approve'}
                    </button>
                    <select
                      value={paymentMethods[payout.id] ?? 'CASH'}
                      onChange={event => setPaymentMethods(current => ({ ...current, [payout.id]: event.target.value as PaymentMethod }))}
                      className={inputClass}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK">Bank</option>
                    </select>
                    <button
                      onClick={() => void handleMarkPaid(payout.id)}
                      disabled={activeAction !== null || payout.status !== 'approved'}
                      className={secondaryButtonClass}
                    >
                      {activeAction === `pay-${payout.id}` ? 'Paying...' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      {permissions.canViewAllCrew ? (
        <Surface variant="table" padding="lg">
          <div className="mb-6">
            <p className="section-title">Crew Table</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Name, check-in time, coordinates, status, OT minutes, and batta state for the active project day.</p>
          </div>
          {!hasData ? (
            <EmptyState icon="groups" title="No crew activity yet" description="No attendance has been captured for the current project day." />
          ) : (
            <DataTable<CrewMember>
              columns={[
                { key: 'name', label: 'Name', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.name}</span> },
                { key: 'checkInTime', label: 'Check-In', render: row => <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{row.checkInTime}</span> },
                {
                  key: 'location',
                  label: 'Location',
                  render: row => row.location ? (
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-900 dark:text-white">{formatCoordinates(row.location)}</p>
                      <a href={row.mapLink ?? buildMapLink(row.location) ?? undefined} target="_blank" rel="noreferrer" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600 dark:text-orange-400">
                        Open in Map
                      </a>
                    </div>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">--</span>
                  ),
                },
                { key: 'status', label: 'Status', render: row => <StatusBadge variant={shiftStatusVariant(row.status)} label={row.status === 'offduty' ? 'Checked Out' : row.status === 'ot' ? 'OT' : 'Active'} /> },
                { key: 'otMinutes', label: 'OT Minutes', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.otMinutes ?? 0}</span> },
                {
                  key: 'attendanceId',
                  label: 'Batta Status',
                  render: row => {
                    const status = battaStatusByAttendanceId.get(row.attendanceId ?? '')
                    return status ? <StatusBadge variant={payoutStatusVariant(status)} label={status} /> : <span className="text-zinc-500 dark:text-zinc-400">None</span>
                  },
                },
              ]}
              data={crew}
              getKey={row => row.attendanceId ?? row.id}
            />
          )}
        </Surface>
      ) : (
        <Surface variant="table" padding="lg">
          <div className="mb-6">
            <p className="section-title">My Records</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Recent shifts are shown here with checkout status, OT minutes, and location links.</p>
          </div>
          {myRecords.length === 0 ? (
            <EmptyState icon="badge" title="No records yet" description="Start your first shift once GPS is available inside the project radius." />
          ) : (
            <DataTable<CrewAttendanceHistoryItem>
              columns={[
                { key: 'checkInTime', label: 'Date', render: row => row.checkInTime ? <span className="text-zinc-900 dark:text-white">{formatDate(row.checkInTime)}</span> : '--' },
                { key: 'shiftStatus', label: 'Status', render: row => <StatusBadge variant={row.state === 'checked_out' ? 'idle' : row.otMinutes > 0 ? 'ot' : 'active'} label={row.shiftStatus} /> },
                { key: 'durationMinutes', label: 'Duration', render: row => `${row.durationMinutes} min` },
                { key: 'otMinutes', label: 'OT Minutes', render: row => String(row.otMinutes) },
                {
                  key: 'location',
                  label: 'Location',
                  render: row => row.location ? (
                    <a href={row.mapLink ?? undefined} target="_blank" rel="noreferrer" className="text-orange-600 dark:text-orange-400">
                      {formatCoordinates(row.location)}
                    </a>
                  ) : (
                    '--'
                  ),
                },
              ]}
              data={myRecords}
              getKey={row => row.id}
            />
          )}
        </Surface>
      )}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-950">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{helper}</p>
    </div>
  )
}

function ShiftInfo({ label, value, link }: { label: string; value: string; link?: string | null }) {
  return (
    <div className="rounded-[20px] border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-orange-600 dark:text-orange-400">
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-white">{value}</p>
      )}
    </div>
  )
}
