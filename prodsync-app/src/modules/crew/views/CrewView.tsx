import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/shared/DataTable'
import { KpiCard } from '@/components/shared/KpiCard'
import { ModuleBudgetBadge } from '@/components/project/ModuleBudgetBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useProject } from '@/context/ProjectContext'
import { invalidateProjectData } from '@/context/project-sync'
import { useAuthStore } from '@/features/auth/auth.store'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { crewService } from '@/services/crew.service'
import type {
  CrewAttendanceHistoryItem,
  CrewLocationPoint,
  CrewMember,
  CrewProjectLocation,
  ProjectRequestedRole,
  WagePayout,
} from '@/types'
import { cn, formatCurrency, formatDate, formatTime } from '@/utils'
import { canEditGeofence, canViewCrewTable, canViewFullCrew, isProductionManagerUser } from '@/utils/permissionGuard'
import { CrewGeofenceMap } from '../components/CrewGeofenceMap'
import { CrewControlAdminMobile } from '../components/crew_control_admin_mobile'
import { CrewControlMemberMobile } from '../components/crew_control_member_mobile'
import { useCrewData } from '../hooks/useCrewData'

type PaymentMethod = 'UPI' | 'CASH' | 'BANK'
type LocationSearchResult = { name: string; lat: number; lng: number }
type AttendanceHistoryPreset = 'last_5_days' | 'last_30_days' | 'last_2_months' | 'custom'

const inputClass =
  'w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white'

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-200'

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${remainingSeconds}`
}

function formatDurationMinutes(minutes: number) {
  if (minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours <= 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function shiftMonths(value: Date, months: number) {
  const next = new Date(value)
  next.setMonth(next.getMonth() + months)
  return next
}

function resolveAttendanceRange(
  preset: AttendanceHistoryPreset,
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date()
  const endDate = toDateInputValue(today)

  if (preset === 'custom') {
    return {
      startDate: customStartDate || endDate,
      endDate: customEndDate || endDate,
    }
  }

  if (preset === 'last_5_days') {
    return {
      startDate: toDateInputValue(shiftDate(today, -4)),
      endDate,
    }
  }

  if (preset === 'last_30_days') {
    return {
      startDate: toDateInputValue(shiftDate(today, -29)),
      endDate,
    }
  }

  return {
    startDate: toDateInputValue(shiftMonths(today, -2)),
    endDate,
  }
}

function formatCoordinates(location: CrewLocationPoint | null | undefined) {
  if (!location) return '--'
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
}

function buildMapLink(location: CrewLocationPoint | null | undefined) {
  if (!location) return null
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`
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
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location access was denied. Please allow GPS access and try again.'))
          return
        }

        reject(new Error(error.message || 'Unable to fetch your current location.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    )
  })
}

function toCenterPoint(projectLocation: CrewProjectLocation | null, fallback?: CrewLocationPoint | null) {
  if (projectLocation) {
    return {
      lat: projectLocation.latitude,
      lng: projectLocation.longitude,
      accuracy: null,
      timestamp: projectLocation.createdAt,
    }
  }

  return fallback ?? null
}

function formatRoleLabel(role: ProjectRequestedRole | string | undefined | null) {
  return (role ?? 'Crew Member').toString()
}

export function CrewView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { project: activeProject } = useProject()
  const {
    activeProjectId,
    isLoading,
    isError,
    summary,
    permissions,
    projectLocation,
    myShift,
    myRecords,
    crew,
    payouts,
    battaQueue,
    refetch,
  } = useCrewData()

  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [shiftGpsError, setShiftGpsError] = useState<string | null>(null)
  const [locationGpsError, setLocationGpsError] = useState<string | null>(null)
  const [battaAmount, setBattaAmount] = useState('')
  const [isEditingGeofence, setIsEditingGeofence] = useState(false)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [radiusMeters, setRadiusMeters] = useState(200)
  const [locationName, setLocationName] = useState('Project Base')
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLocationDraftDirty, setIsLocationDraftDirty] = useState(false)
  const [mapCenter, setMapCenter] = useState<CrewLocationPoint | null>(null)
  const [deviceLocationName, setDeviceLocationName] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({})
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [historyPreset, setHistoryPreset] = useState<AttendanceHistoryPreset>('last_30_days')
  const [historyPage, setHistoryPage] = useState(1)
  const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(shiftDate(new Date(), -29)))
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()))
  const searchDebounceRef = useRef<number | null>(null)

  const projectRole = user?.projectRoleTitle
  const isProductionManager = isProductionManagerUser(user)
  const canUseCrewModule = permissions.canAccessModule
  const canSeeCrewTable = canViewCrewTable(user) && permissions.canViewCrewTable
  const canSeeFullCrew = canViewFullCrew(user) && permissions.crewScope === 'project'
  const canManageGeofence = canEditGeofence(user) && permissions.canManageLocation
  const canManageBatta = permissions.canApproveBatta
  const canSeeFinancials = permissions.canViewFinancials
  const isSelfServiceOnly = permissions.crewScope === 'self'
  const showManagerQueueInline = canManageBatta && !isSelfServiceOnly
  const historyRange = useMemo(
    () => resolveAttendanceRange(historyPreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, historyPreset],
  )

  const attendanceHistoryQ = useQuery({
    queryKey: ['crew-attendance-history', activeProjectId, historyRange.startDate, historyRange.endDate, historyPage],
    queryFn: () => crewService.getAttendanceHistory(activeProjectId!, {
      startDate: historyRange.startDate,
      endDate: historyRange.endDate,
      page: historyPage,
      limit: 10,
    }),
    enabled: Boolean(activeProjectId) && canUseCrewModule,
    staleTime: 15_000,
  })

  const currentAttendancePayout = useMemo(
    () => payouts.find(payout => payout.attendanceId === myShift.attendanceId),
    [myShift.attendanceId, payouts],
  )

  const myPayouts = useMemo(() => {
    const attendanceIds = new Set([myShift.attendanceId, ...myRecords.map(record => record.id)].filter(Boolean))
    return payouts.filter(payout => payout.attendanceId && attendanceIds.has(payout.attendanceId))
  }, [myRecords, myShift.attendanceId, payouts])

  const liveWorkingSeconds = myShift.state === 'checked_in' && myShift.checkInTime
    ? Math.max(0, Math.floor((nowTick - new Date(myShift.checkInTime).getTime()) / 1000))
    : myShift.workingSeconds

  const attendanceHistory = attendanceHistoryQ.data?.data ?? []
  const attendancePagination = attendanceHistoryQ.data?.pagination
  const historyColumns = useMemo(() => (
    canSeeCrewTable
      ? [
          { key: 'name', label: 'Name', render: (row: CrewAttendanceHistoryItem) => <span className="font-medium text-zinc-900 dark:text-white">{row.name ?? 'Crew Member'}</span> },
          { key: 'department', label: 'Department', render: (row: CrewAttendanceHistoryItem) => row.department ?? '--' },
          { key: 'role', label: 'Role', render: (row: CrewAttendanceHistoryItem) => row.role ?? '--' },
          { key: 'date', label: 'Date', render: (row: CrewAttendanceHistoryItem) => row.checkInTime ? formatDate(row.checkInTime) : '--' },
          { key: 'checkInTime', label: 'Check In', render: (row: CrewAttendanceHistoryItem) => row.checkInTime ? formatTime(row.checkInTime) : '--' },
          { key: 'checkOutTime', label: 'Check Out', render: (row: CrewAttendanceHistoryItem) => row.checkOutTime ? formatTime(row.checkOutTime) : 'Working' },
          { key: 'durationMinutes', label: 'Duration', render: (row: CrewAttendanceHistoryItem) => formatDurationMinutes(row.durationMinutes) },
          { key: 'shiftStatus', label: 'Status', render: (row: CrewAttendanceHistoryItem) => <StatusBadge variant={row.state === 'checked_out' ? 'idle' : row.otMinutes > 0 ? 'ot' : 'active'} label={row.shiftStatus} /> },
          { key: 'otMinutes', label: 'OT', render: (row: CrewAttendanceHistoryItem) => String(row.otMinutes), align: 'right' as const },
        ]
      : [
          { key: 'date', label: 'Date', render: (row: CrewAttendanceHistoryItem) => row.checkInTime ? formatDate(row.checkInTime) : '--' },
          { key: 'checkInTime', label: 'Check In', render: (row: CrewAttendanceHistoryItem) => row.checkInTime ? formatTime(row.checkInTime) : '--' },
          { key: 'checkOutTime', label: 'Check Out', render: (row: CrewAttendanceHistoryItem) => row.checkOutTime ? formatTime(row.checkOutTime) : 'Working' },
          { key: 'durationMinutes', label: 'Duration', render: (row: CrewAttendanceHistoryItem) => formatDurationMinutes(row.durationMinutes) },
          { key: 'shiftStatus', label: 'Status', render: (row: CrewAttendanceHistoryItem) => <StatusBadge variant={row.state === 'checked_out' ? 'idle' : row.otMinutes > 0 ? 'ot' : 'active'} label={row.shiftStatus} /> },
          { key: 'otMinutes', label: 'OT', render: (row: CrewAttendanceHistoryItem) => String(row.otMinutes), align: 'right' as const },
        ]
  ), [canSeeCrewTable])

  useEffect(() => {
    if (myShift.state !== 'checked_in') return
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [myShift.state])

  useEffect(() => {
    setHistoryPage(1)
  }, [activeProjectId, historyPreset, customEndDate, customStartDate])

  useEffect(() => {
    if (isEditingGeofence) return
    setRadiusMeters(projectLocation?.radiusMeters ?? 200)
    setLocationName(projectLocation?.name ?? 'Project Base')
    setLocationSearch(projectLocation?.name ?? '')
    setMapCenter(toCenterPoint(projectLocation))
    setIsLocationDraftDirty(false)
    setSearchResults([])
    setSearchError(null)
    setLocationGpsError(null)
  }, [isEditingGeofence, projectLocation])

  useEffect(() => {
    if (!isEditingGeofence || !activeProjectId) return
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)

    if (!locationSearch.trim() || locationSearch.trim().length < 3) {
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      return
    }

    // Do not fetch suggestions if the value matches the current selected address
    if (locationSearch.trim() === locationName.trim()) {
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      return
    }

    searchDebounceRef.current = window.setTimeout(() => {
      setIsSearching(true)
      crewService.searchLocations(activeProjectId, locationSearch.trim())
        .then(results => {
          setSearchResults(results.slice(0, 6))
          setSearchError(results.length === 0 ? 'No matching places found.' : null)
        })
        .catch(error => {
          setSearchResults([])
          setSearchError(resolveErrorMessage(error, 'Location search failed.'))
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, 350)

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    }
  }, [activeProjectId, isEditingGeofence, locationSearch])

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

  async function runAction<T>(actionKey: string, loadingMessage: string, successMessage: string, action: () => Promise<T>) {
    setActiveAction(actionKey)
    showLoading(loadingMessage, { id: actionKey })

    try {
      const result = await action()
      showSuccess(successMessage, { id: actionKey })
      return result
    } catch (error) {
      showError(resolveErrorMessage(error, 'Something went wrong.'), { id: actionKey })
      throw error
    } finally {
      setActiveAction(null)
    }
  }

  async function fetchCurrentLocationIntoDraft() {
    setIsFetchingLocation(true)
    setLocationGpsError(null)

    try {
      const point = await requestBrowserLocation()
      setMapCenter(point)
      setIsLocationDraftDirty(true)

      if (!activeProjectId) {
        return
      }

      const geocode = await crewService.reverseGeocode(activeProjectId, point)
      const resolvedName = geocode.name || geocode.address || 'Current Location'
      setLocationName(resolvedName)
      setLocationSearch(resolvedName)
      setDeviceLocationName(resolvedName)
    } catch (error) {
      const message = resolveErrorMessage(error, 'Unable to fetch current location.')
      setLocationGpsError(message)
      showError(message, { id: 'crew-geofence-gps' })
    } finally {
      setIsFetchingLocation(false)
    }
  }

  function beginGeofenceEditing() {
    setIsEditingGeofence(true)
    setSearchResults([])
    setSearchError(null)
    setLocationSearch(locationName)
    // DO NOT fetchCurrentLocation automatically here on edit.
  }

  function cancelGeofenceEditing() {
    setIsEditingGeofence(false)
    setLocationGpsError(null)
    setSearchResults([])
    setSearchError(null)
  }

  function handleSearchSelection(result: LocationSearchResult) {
    const nextPoint: CrewLocationPoint = {
      lat: result.lat,
      lng: result.lng,
      accuracy: null,
      timestamp: new Date().toISOString(),
    }

    setMapCenter(nextPoint)
    setLocationName(result.name)
    setLocationSearch(result.name)
    setSearchResults([])
    setSearchError(null)
    setIsLocationDraftDirty(true)
  }

  async function handleProjectLocationSave() {
    if (!activeProjectId || !mapCenter) {
      showError('Choose a valid geofence location before saving.', { id: 'crew-location-update' })
      return
    }

    await runAction('crew-location-update', 'Saving geofence...', 'Project geofence updated.', async () => {
      await updateLocationMutation.mutateAsync({
        projectId: activeProjectId,
        name: locationName.trim() || 'Project Base',
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        radius: radiusMeters,
      })

      await invalidateProjectData(queryClient, {
        projectId: activeProjectId,
        userId: user?.id,
      })
      setIsEditingGeofence(false)
    })
  }

  async function handleShiftStart() {
    setShiftGpsError(null)

    try {
      const payload = await requestBrowserLocation()
      await runAction('crew-check-in', 'Starting shift...', 'Shift started successfully.', async () => {
        await checkInMutation.mutateAsync(payload)
        await invalidateProjectData(queryClient, {
          projectId: activeProjectId,
          userId: user?.id,
        })
      })
    } catch (error) {
      const message = resolveErrorMessage(error, 'Unable to start shift.')
      setShiftGpsError(message)
      showError(message, { id: 'crew-check-in' })
    }
  }

  async function handleShiftEnd() {
    setShiftGpsError(null)

    try {
      const payload = await requestBrowserLocation()
      await runAction('crew-check-out', 'Ending shift...', 'Shift ended successfully.', async () => {
        await checkOutMutation.mutateAsync(payload)
        await invalidateProjectData(queryClient, {
          projectId: activeProjectId,
          userId: user?.id,
        })
      })
    } catch (error) {
      const message = resolveErrorMessage(error, 'Unable to end shift.')
      setShiftGpsError(message)
      showError(message, { id: 'crew-check-out' })
    }
  }

  async function handleBattaRequest() {
    const amount = Number(battaAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('Enter a valid batta amount.', { id: 'crew-batta-request' })
      return
    }

    await runAction('crew-batta-request', 'Submitting batta request...', 'Batta request submitted.', async () => {
      await requestBattaMutation.mutateAsync(amount)
      setBattaAmount('')
      await invalidateProjectData(queryClient, {
        projectId: activeProjectId,
        userId: user?.id,
      })
    })
  }

  async function handleApproveBatta(payoutId: string) {
    await runAction(`approve-${payoutId}`, 'Approving batta request...', 'Batta approved.', async () => {
      await approveBattaMutation.mutateAsync(payoutId)
      await invalidateProjectData(queryClient, {
        projectId: activeProjectId,
        userId: user?.id,
      })
    })
  }

  async function handleMarkPaid(payoutId: string) {
    await runAction(`pay-${payoutId}`, 'Marking batta as paid...', 'Payment recorded.', async () => {
      await markBattaPaidMutation.mutateAsync({
        payoutId,
        paymentMethod: paymentMethods[payoutId] ?? 'CASH',
      })
      await invalidateProjectData(queryClient, {
        projectId: activeProjectId,
        userId: user?.id,
      })
    })
  }

  async function handleHistoryExport() {
    if (!activeProjectId) {
      return
    }

    showLoading('Preparing attendance PDF...', { id: 'crew-history-export' })

    try {
      await crewService.exportAttendancePdf(activeProjectId, {
        startDate: historyRange.startDate,
        endDate: historyRange.endDate,
        page: historyPage,
        limit: 10,
      })
      showSuccess('Attendance PDF exported.', { id: 'crew-history-export' })
    } catch (error) {
      showError(resolveErrorMessage(error, 'Attendance export failed.'), { id: 'crew-history-export' })
    }
  }

  if (isLoading) return <LoadingState message="Loading crew control..." />
  if (isError) return <ErrorState message="Failed to load crew data" retry={() => void refetch()} />

  if (!canUseCrewModule) {
    return (
      <div className="page-shell">
        <Surface variant="table" padding="lg">
          <EmptyState
            icon="lock"
            title="Crew access is restricted"
            description="This role does not have access to the Crew & Wages workspace for the active project."
          />
        </Surface>
      </div>
    )
  }

  return (
    <div className="page-shell space-y-6 md:space-y-0 pb-safe">
      <div className="block md:hidden">
        {isSelfServiceOnly ? (
          <CrewControlMemberMobile
            myShift={myShift}
            permissions={permissions}
            shiftGpsError={shiftGpsError}
            activeAction={activeAction}
            projectLocation={projectLocation}
            handleShiftStart={handleShiftStart}
            handleShiftEnd={handleShiftEnd}
            liveWorkingSeconds={liveWorkingSeconds}
            battaAmount={battaAmount}
            setBattaAmount={setBattaAmount}
            handleBattaRequest={handleBattaRequest}
            currentAttendancePayout={currentAttendancePayout}
            myPayouts={myPayouts}
            myRecords={myRecords}
          />
        ) : (
          <CrewControlAdminMobile
            summary={summary}
            canSeeFinancials={canSeeFinancials}
            canSeeFullCrew={canSeeFullCrew}
            canManageGeofence={canManageGeofence}
            projectLocation={projectLocation}
            mapCenter={mapCenter}
            radiusMeters={radiusMeters}
            locationName={locationName}
            isEditingGeofence={isEditingGeofence}
            locationSearch={locationSearch}
            searchResults={searchResults}
            searchError={searchError}
            isSearching={isSearching}
            deviceLocationName={deviceLocationName}
            locationGpsError={locationGpsError}
            isFetchingLocation={isFetchingLocation}
            isLocationDraftDirty={isLocationDraftDirty}
            activeAction={activeAction}
            setMapCenter={setMapCenter}
            setIsLocationDraftDirty={setIsLocationDraftDirty}
            setLocationSearch={setLocationSearch}
            setSearchError={setSearchError}
            setLocationName={setLocationName}
            setRadiusMeters={setRadiusMeters}
            beginGeofenceEditing={beginGeofenceEditing}
            cancelGeofenceEditing={cancelGeofenceEditing}
            handleSearchSelection={handleSearchSelection}
            fetchCurrentLocationIntoDraft={fetchCurrentLocationIntoDraft}
            handleProjectLocationSave={handleProjectLocationSave}
            showManagerQueueInline={showManagerQueueInline}
            canManageBatta={canManageBatta}
            battaQueue={battaQueue}
            paymentMethods={paymentMethods}
            setPaymentMethods={setPaymentMethods}
            handleApproveBatta={handleApproveBatta}
            handleMarkPaid={handleMarkPaid}
            canSeeCrewTable={canSeeCrewTable}
            crew={crew}
          />
        )}
      </div>

      <div className="hidden md:block space-y-6">
        <header className="page-header">
          <div>
            <span className="page-kicker">Attendance, Geofence, and Crew Visibility</span>
            <h1 className="page-title page-title-compact">Crew Control Center</h1>
            <p className="page-subtitle">
              {isSelfServiceOnly
                ? 'Your check-in, check-out, and personal attendance history are locked to your own records.'
                : canSeeFullCrew
                  ? 'Full-project operational visibility with geofence controls and batta oversight.'
                  : 'Department-scoped crew visibility with a cleaner, production-focused layout.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeProjectId && (
              <ModuleBudgetBadge
                projectId={activeProjectId}
                department="crew"
                currency={activeProject?.currency}
              />
            )}
            <StatusBadge variant="verified" label="OpenStreetMap" />
            <div className="rounded-full bg-zinc-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-900">
              {formatRoleLabel(projectRole)}
            </div>
          </div>
        </header>

        {(canSeeFinancials || canSeeCrewTable) && (
        <section className={cn('grid gap-4', canSeeFinancials ? 'sm:grid-cols-2 xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-2')}>
          <KpiCard label="Visible Crew" value={String(summary.totalCrew)} subLabel={canSeeFullCrew ? 'Project-wide attendance' : 'Scoped to your department'} />
          <KpiCard label="Active OT Crew" value={String(summary.activeOTCrew)} subLabel="Live check-ins after 6 PM" />
          {canSeeFinancials && <KpiCard label="Total OT Cost" value={formatCurrency(summary.totalOTCost)} subLabel="Rate-aware estimate" />}
          {canSeeFinancials && <KpiCard label="Batta Requested" value={formatCurrency(summary.battaRequested)} subLabel="Pending approvals" />}
          {canSeeFinancials && <KpiCard label="Batta Paid" value={formatCurrency(summary.battaPaid)} subLabel="Closed settlements" />}
        </section>
      )}

      {shiftGpsError && (
        <Surface variant="warning" padding="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-title">GPS retry needed</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{shiftGpsError}</p>
            </div>
            {isSelfServiceOnly && (
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
            )}
          </div>
        </Surface>
      )}

      {isSelfServiceOnly && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Surface variant="table" padding="lg">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="section-title">Today&apos;s Shift</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Your check-in and check-out actions are GPS-verified inside the active project geofence.</p>
              </div>
              <StatusBadge
                variant={myShift.otActive ? 'ot' : myShift.state === 'checked_out' ? 'idle' : myShift.state === 'checked_in' ? 'active' : 'requested'}
                label={myShift.otActive ? 'OT Active' : myShift.state === 'checked_out' ? 'Checked Out' : myShift.state === 'checked_in' ? 'Checked In' : 'Not Started'}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Working Time" value={formatDuration(liveWorkingSeconds)} helper={myShift.state === 'checked_in' ? 'Live timer running' : 'Latest recorded total'} />
              <MetricCard label="OT Minutes" value={String(myShift.otMinutes)} helper={myShift.otMinutes > 0 ? 'Triggered after 6 PM' : 'No overtime yet'} />
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
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoCard label="Check In" value={myShift.checkInTime ? `${formatDate(myShift.checkInTime)} | ${formatTime(myShift.checkInTime)}` : '--'} />
              <InfoCard label="Check Out" value={myShift.checkOutTime ? `${formatDate(myShift.checkOutTime)} | ${formatTime(myShift.checkOutTime)}` : 'Working'} />
              <InfoCard label="Shift Status" value={myShift.shiftStatus} />
              <InfoCard label="Map Link" value={myShift.checkInLocation ? 'Open in OpenStreetMap' : '--'} link={buildMapLink(myShift.checkInLocation)} />
            </div>
          </Surface>
        </div>
      )}

      <div className={cn('grid gap-6 items-start', showManagerQueueInline ? 'xl:grid-cols-[1.15fr_0.95fr]' : 'max-w-[920px]')}>
        <Surface variant="table" padding="lg">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Project Geofence</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {canManageGeofence
                  ? 'Search, auto-fetch, or drag the map marker to update the saved geofence.'
                  : 'Read-only geofence preview for the active project.'}
              </p>
            </div>
            {canManageGeofence && !isEditingGeofence && (
              <button type="button" onClick={beginGeofenceEditing} className="btn-soft">
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
          </div>

          {!projectLocation && !canManageGeofence && (
            <div className="mb-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              No geofence is configured yet. Check-in will remain blocked until production sets one.
            </div>
          )}

          <CrewGeofenceMap
            center={mapCenter}
            radiusMeters={radiusMeters}
            editable={canManageGeofence && isEditingGeofence}
            onCenterChange={async next => {
              setMapCenter(next)
              setIsLocationDraftDirty(true)
              
              // Reverse geocode via OSM (Nominatim)
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${next.lat}&lon=${next.lng}&format=json`)
                const data = await res.json()
                if (data && data.display_name) {
                  setLocationName(data.display_name)
                  setLocationSearch(data.display_name)
                }
              } catch (e) {
                console.error('OSM Reverse Geocoding failed:', e)
              }
            }}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard label="Location" value={locationName || projectLocation?.name || 'Not configured'} />
            <InfoCard label="Radius" value={`${radiusMeters} m`} />
            <InfoCard label="Coordinates" value={formatCoordinates(mapCenter)} link={buildMapLink(mapCenter)} />
            <InfoCard label="Last Updated" value={projectLocation?.createdAt ? `${formatDate(projectLocation.createdAt)} | ${formatTime(projectLocation.createdAt)}` : 'Not configured'} />
          </div>

          {canManageGeofence && isEditingGeofence && (
            <div className="mt-5 space-y-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Search Location</label>
                  <div className="relative">
                    <input
                      value={locationSearch}
                      onChange={event => {
                        setLocationSearch(event.target.value)
                        setSearchError(null)
                      }}
                      placeholder="Search with OpenStreetMap"
                      className={inputClass}
                    />
                    {(isSearching || searchResults.length > 0 || searchError) && (
                      <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[20px] border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                        {isSearching && <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Searching locations...</p>}
                        {!isSearching && searchResults.map(result => (
                          <button
                            key={`${result.name}-${result.lat}-${result.lng}`}
                            type="button"
                            onClick={() => handleSearchSelection(result)}
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Location Label</label>
                  <input
                    value={locationName}
                    onChange={event => {
                      setLocationName(event.target.value)
                      setIsLocationDraftDirty(true)
                    }}
                    className={inputClass}
                    placeholder="Project Base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Radius</label>
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-900">{radiusMeters} m</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={1000}
                  step={10}
                  value={radiusMeters}
                  onChange={event => {
                    setRadiusMeters(Number(event.target.value))
                    setIsLocationDraftDirty(true)
                  }}
                  className="w-full accent-orange-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <button type="button" onClick={() => void fetchCurrentLocationIntoDraft()} className={secondaryButtonClass} disabled={isFetchingLocation}>
                  <span className="material-symbols-outlined text-sm">my_location</span>
                  {isFetchingLocation ? 'Fetching current location...' : 'Use Current Location'}
                </button>
                {deviceLocationName && <span>Detected: {deviceLocationName}</span>}
              </div>
              {locationGpsError && <p className="text-sm text-amber-600 dark:text-amber-200">{locationGpsError}</p>}

              <div className="flex flex-wrap gap-3">
                <button onClick={() => void handleProjectLocationSave()} disabled={activeAction === 'crew-location-update' || !mapCenter || !isLocationDraftDirty} className="btn-primary">
                  {activeAction === 'crew-location-update' ? 'Saving...' : 'Save Geofence'}
                </button>
                <button onClick={cancelGeofenceEditing} disabled={activeAction === 'crew-location-update'} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Surface>

        {showManagerQueueInline && (
          <ManagerQueueSection
            battaQueue={battaQueue}
            activeAction={activeAction}
            paymentMethods={paymentMethods}
            setPaymentMethods={setPaymentMethods}
            handleApproveBatta={handleApproveBatta}
            handleMarkPaid={handleMarkPaid}
          />
        )}
      </div>

      {!isProductionManager && permissions.canRequestBatta && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface variant="table" padding="lg">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="section-title">Batta Flow</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Your batta request is tied to attendance and visible only to authorized approvers.</p>
              </div>
              {currentAttendancePayout && (
                <StatusBadge variant={payoutStatusVariant(currentAttendancePayout.status)} label={currentAttendancePayout.status} />
              )}
            </div>

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
              className="btn-primary mt-4"
            >
              <span className="material-symbols-outlined text-sm">currency_rupee</span>
              {activeAction === 'crew-batta-request' ? 'Submitting...' : 'Request Batta'}
            </button>

            {currentAttendancePayout && (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">A batta request already exists for the current attendance record.</p>
            )}
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="mb-6">
              <p className="section-title">My Payouts</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Attendance-linked batta history for your recent shifts.</p>
            </div>

            {myPayouts.length === 0 ? (
              <EmptyState icon="currency_rupee" title="No payout activity yet" description="Your approved or paid batta requests will appear here." />
            ) : (
              <div className="space-y-3">
                {myPayouts.slice(0, 6).map(payout => (
                  <div key={payout.id} className="flex items-center justify-between gap-4 rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatCurrency(payout.amount)}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatDate(payout.timestamp)} | {payout.method}</p>
                    </div>
                    <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      )}

      {canManageBatta && !showManagerQueueInline && (
        <ManagerQueueSection
          battaQueue={battaQueue}
          activeAction={activeAction}
          paymentMethods={paymentMethods}
          setPaymentMethods={setPaymentMethods}
          handleApproveBatta={handleApproveBatta}
          handleMarkPaid={handleMarkPaid}
        />
      )}

      {canSeeCrewTable ? (
        <Surface variant="table" padding="lg">
          <div className="mb-6">
            <p className="section-title">{canSeeFullCrew ? 'Crew Table' : 'Department Crew Table'}</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {canSeeFullCrew
                ? 'Full-project attendance visibility with checkout state and live durations.'
                : 'Only crew assigned to your department are visible here.'}
            </p>
          </div>

          {crew.length === 0 ? (
            <EmptyState icon="groups" title="No crew activity yet" description="No attendance has been captured for the active scope today." />
          ) : (
            <DataTable<CrewMember>
              columns={[
                { key: 'name', label: 'Name', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.name}</span> },
                { key: 'role', label: 'Role', render: row => <span className="text-zinc-600 dark:text-zinc-300">{row.role}</span> },
                { key: 'checkInTime', label: 'Check In', render: row => <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{row.checkInTime}</span> },
                { key: 'checkOutTime', label: 'Check Out', render: row => <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{row.checkOutTime ?? 'Working'}</span> },
                { key: 'computedDuration', label: 'Total Duration', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.computedDuration ?? '--'}</span> },
                { key: 'status', label: 'Status', render: row => <StatusBadge variant={shiftStatusVariant(row.status)} label={row.status === 'offduty' ? 'Checked Out' : row.status === 'ot' ? 'OT' : 'Working'} /> },
                { key: 'otMinutes', label: 'OT Minutes', render: row => <span className="font-medium text-zinc-900 dark:text-white">{row.otMinutes ?? 0}</span>, align: 'right' },
              ]}
              data={crew}
              getKey={row => row.attendanceId ?? row.id}
              stickyHeader
              className="max-h-[400px] overflow-y-auto"
            />
          )}
        </Surface>
      ) : (
        <Surface variant="table" padding="lg">
          <div className="mb-6">
            <p className="section-title">My Records</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Your own attendance history only. Other crew data and financials stay hidden.</p>
          </div>

          {myRecords.length === 0 ? (
            <EmptyState icon="badge" title="No records yet" description="Start your first shift once GPS is available inside the project radius." />
          ) : (
            <DataTable<CrewAttendanceHistoryItem>
              columns={[
                { key: 'checkInTime', label: 'Date', render: row => row.checkInTime ? formatDate(row.checkInTime) : '--' },
                { key: 'checkInTimeLabel', label: 'Check In', render: row => row.checkInTime ? formatTime(row.checkInTime) : '--' },
                { key: 'checkOutTimeLabel', label: 'Check Out', render: row => row.checkOutTime ? formatTime(row.checkOutTime) : 'Working' },
                { key: 'durationMinutes', label: 'Total Duration', render: row => formatDurationMinutes(row.durationMinutes) },
                { key: 'shiftStatus', label: 'Status', render: row => <StatusBadge variant={row.state === 'checked_out' ? 'idle' : row.otMinutes > 0 ? 'ot' : 'active'} label={row.shiftStatus} /> },
                { key: 'otMinutes', label: 'OT Minutes', render: row => String(row.otMinutes), align: 'right' },
              ]}
              data={myRecords}
              getKey={row => row.id}
              stickyHeader
              className="max-h-[400px] overflow-y-auto"
            />
          )}
        </Surface>
      )}

      <Surface variant="table" padding="lg">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-title">Attendance History</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Filtered attendance history stays available for audit, exports, and payout checks.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'last_5_days' as const, label: 'Last 5 Days' },
                { id: 'last_30_days' as const, label: 'Last 30 Days' },
                { id: 'last_2_months' as const, label: 'Last 2 Months' },
                { id: 'custom' as const, label: 'Custom Range' },
              ].map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setHistoryPreset(option.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                    historyPreset === option.id
                      ? 'border-orange-500 bg-orange-500 text-black shadow-[0_10px_22px_rgba(249,115,22,0.24)]'
                      : 'border-zinc-200 text-zinc-600 hover:border-orange-200 hover:text-orange-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-orange-500/30 dark:hover:text-orange-200',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {historyPreset === 'custom' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="auth-field">
                  <span className="auth-field-label">Start Date</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={event => setCustomStartDate(event.target.value)}
                    className="project-modal-select"
                  />
                </label>
                <label className="auth-field">
                  <span className="auth-field-label">End Date</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={event => setCustomEndDate(event.target.value)}
                    className="project-modal-select"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleHistoryExport()}
              disabled={attendanceHistoryQ.isFetching || attendanceHistory.length === 0}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-black shadow-[0_14px_28px_rgba(249,115,22,0.24)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        {attendanceHistoryQ.isLoading ? (
          <LoadingState message="Loading attendance history..." />
        ) : attendanceHistoryQ.isError ? (
          <ErrorState message="Attendance history could not be loaded." retry={() => void attendanceHistoryQ.refetch()} />
        ) : attendanceHistory.length === 0 ? (
          <EmptyState icon="history" title="No historical attendance found" description="Try broadening the date range to see older records." />
        ) : (
          <>
            <DataTable<CrewAttendanceHistoryItem>
              columns={historyColumns}
              data={attendanceHistory}
              getKey={row => row.attendanceId ?? row.id}
              stickyHeader
              className="max-h-[420px] overflow-y-auto"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <p>
                Showing page {attendancePagination?.page ?? historyPage} of {attendancePagination?.totalPages ?? 1}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryPage(current => Math.max(current - 1, 1))}
                  disabled={(attendancePagination?.page ?? historyPage) <= 1}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700 transition-colors hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-orange-500/30 dark:hover:text-orange-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPage(current => {
                    const totalPages = attendancePagination?.totalPages ?? current
                    return Math.min(current + 1, totalPages)
                  })}
                  disabled={(attendancePagination?.page ?? historyPage) >= (attendancePagination?.totalPages ?? historyPage)}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700 transition-colors hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-orange-500/30 dark:hover:text-orange-200"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Surface>
      </div>
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

function InfoCard({ label, value, link }: { label: string; value: string; link?: string | null }) {
  return (
    <div className="rounded-[20px] border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-orange-600 dark:text-orange-200">
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-white">{value}</p>
      )}
    </div>
  )
}

function ManagerQueueSection({
  battaQueue,
  activeAction,
  paymentMethods,
  setPaymentMethods,
  handleApproveBatta,
  handleMarkPaid,
}: {
  battaQueue: WagePayout[]
  activeAction: string | null
  paymentMethods: Record<string, PaymentMethod>
  setPaymentMethods: Dispatch<SetStateAction<Record<string, PaymentMethod>>>
  handleApproveBatta: (payoutId: string) => Promise<void>
  handleMarkPaid: (payoutId: string) => Promise<void>
}) {
  return (
    <Surface variant="table" padding="lg" className="h-full">
      <div className="mb-6">
        <p className="section-title">Manager Queue</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Approve batta requests and record final settlement without exposing this queue to crew-level roles.</p>
      </div>

      {battaQueue.length === 0 ? (
        <EmptyState icon="inventory_2" title="No pending batta requests" description="The queue is clear for the active project." />
      ) : (
        <div className="grid gap-4">
          {battaQueue.map(payout => (
            <div key={payout.id} className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{payout.crewName}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{payout.department}</p>
                </div>
                <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
              </div>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(payout.amount)} | {payout.method}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void handleApproveBatta(payout.id)} disabled={activeAction !== null || payout.status !== 'requested'} className="btn-primary px-4 py-2 text-[11px]">
                  {activeAction === `approve-${payout.id}` ? 'Approving...' : 'Approve'}
                </button>
                <select
                  value={paymentMethods[payout.id] ?? 'CASH'}
                  onChange={event => setPaymentMethods(current => ({ ...current, [payout.id]: event.target.value as PaymentMethod }))}
                  className={cn(inputClass, 'max-w-[180px]')}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                </select>
                <button onClick={() => void handleMarkPaid(payout.id)} disabled={activeAction !== null || payout.status !== 'approved'} className={secondaryButtonClass}>
                  {activeAction === `pay-${payout.id}` ? 'Paying...' : 'Mark Paid'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  )
}
