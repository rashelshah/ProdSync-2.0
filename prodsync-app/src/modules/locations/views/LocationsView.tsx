import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { SectionSelectorSheet } from '@/components/shared/SectionSelectorSheet'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showSuccess } from '@/lib/toast'
import { formatCurrency, formatDate, timeAgo } from '@/utils'
import { locationsService } from '@/services/locations.service'
import type { LocationResolutionRecord } from '@/services/locations.service'
import { LocationPreviewMap } from '../components/LocationPreviewMap'
import type {
  CreateLocationCommentInput,
  CreateLocationInput,
  CreateLocationPermissionInput,
  CreateLocationTimelineInput,
  LocationAmenityRecord,
  LocationAmenityType,
  LocationCommentRecord,
  LocationDetailRecord,
  LocationDocumentRecord,
  LocationListFilters,
  LocationMediaRecord,
  LocationPermissionRecord,
  LocationPermissionStatus,
  LocationPermissionType,
  LocationRecord,
  LocationRiskLevel,
  LocationSearchSuggestion,
  LocationStatus,
  LocationTimelineRecord,
  LocationType,
  NearbyAmenitySuggestion,
  NearbyHotelSuggestion,
  PaginatedLocationDocuments,
  PaginatedLocationMedia,
  UpdateLocationInput,
  UpsertLocationAmenityInput,
} from '../types'

type WorkspaceTab = 'overview' | 'scouting' | 'permissions' | 'amenities' | 'documents' | 'timeline'
type CreateMode = 'menu' | 'capture' | 'upload' | 'drop'
type MediaViewerState = {
  item: LocationMediaRecord
  scale: number
  offsetX: number
  offsetY: number
}

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab
  label: string
  mobileLabel: string
  icon: string
  description: string
}> = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Overview', icon: 'dashboard', description: 'Readiness and key summary cards.' },
  { id: 'scouting', label: 'Scouting Gallery', mobileLabel: 'Scouting Gallery', icon: 'photo_library', description: 'Location media and upload history.' },
  { id: 'permissions', label: 'Permissions', mobileLabel: 'Permissions', icon: 'fact_check', description: 'Checklist-first permissions workflow.' },
  { id: 'amenities', label: 'Nearby Amenities', mobileLabel: 'Nearby Amenities', icon: 'local_hospital', description: 'Mapbox-powered nearby essentials.' },
  { id: 'documents', label: 'Documents', mobileLabel: 'Documents', icon: 'folder_open', description: 'Location documents and version history.' },
  { id: 'timeline', label: 'Timeline', mobileLabel: 'Timeline', icon: 'timeline', description: 'Audit-safe activity feed and comments.' },
]

const LOCATION_TYPES: LocationType[] = ['government', 'private', 'studio', 'outdoor', 'indoor']
const RISK_LEVELS: LocationRiskLevel[] = ['low', 'medium', 'high']
const PERMISSION_CHECKLIST: Array<{
  key: string
  permissionType: LocationPermissionType
  label: string
  defaultAssignedLabel?: string
}> = [
  { key: 'police', permissionType: 'police_permission', label: 'Police Permission' },
  { key: 'corporation', permissionType: 'corporation_approval', label: 'Corporation Approval' },
  { key: 'traffic', permissionType: 'traffic_department', label: 'Traffic Clearance' },
  { key: 'private-owner', permissionType: 'private_owner_agreement', label: 'Private Property Consent' },
  { key: 'fire', permissionType: 'fire_department', label: 'Fire Safety Clearance' },
  { key: 'drone', permissionType: 'custom', label: 'Drone Permission', defaultAssignedLabel: 'Drone Permission' },
  { key: 'environment', permissionType: 'environmental_clearance', label: 'Environmental Clearance' },
]

function labelize(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Shoot dates not set'
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`
  return formatDate(start ?? end ?? new Date().toISOString())
}

function isWithinProjectRange(date: string | null | undefined, start?: string | null, end?: string | null) {
  if (!date) return true
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function locationStatusVariant(status: LocationStatus) {
  switch (status) {
    case 'completed': return 'completed'
    case 'shoot_ready': return 'approved'
    case 'permissions_pending': return 'pending'
    case 'recce_complete': return 'active'
    default: return 'stable'
  }
}

function riskVariant(riskLevel: LocationRiskLevel) {
  switch (riskLevel) {
    case 'high': return 'rejected'
    case 'medium': return 'warning'
    default: return 'approved'
  }
}

function permissionStatusVariant(status: LocationPermissionStatus) {
  switch (status) {
    case 'approved': return 'approved'
    case 'submitted': return 'active'
    case 'rejected':
    case 'expired':
      return 'rejected'
    default:
      return 'pending'
  }
}

function workspaceTabFromValue(value: string | null): WorkspaceTab {
  if (value === 'scouting' || value === 'permissions' || value === 'amenities' || value === 'documents' || value === 'timeline') {
    return value
  }
  return 'overview'
}

function createDefaultLocationDraft(projectId: string): CreateLocationInput {
  return {
    projectId,
    name: '',
    address: '',
    latitude: undefined,
    longitude: undefined,
    locationType: 'private',
    shootStartDate: '',
    shootEndDate: '',
    riskLevel: 'medium',
    status: 'draft',
    notes: '',
  }
}

function fileToPreviewUrl(file: File | null) {
  if (!file) return ''
  return URL.createObjectURL(file)
}

function buildDirectionsUrl(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'))
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-4xl',
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-[color:rgba(9,9,11,0.7)] backdrop-blur-md"
        onClick={onClose}
      />
      <Surface variant="raised" padding="none" className={`relative z-10 w-full overflow-hidden ${maxWidth}`}>
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">ProdSync</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">{title}</h2>
              {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-muted)]">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-muted)] transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
        {footer && (
          <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-6">
            {footer}
          </div>
        )}
      </Surface>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  tone = 'default',
  type = 'button',
  disabled = false,
  loading = false,
}: {
  label: string
  icon: string
  onClick?: () => void
  tone?: 'default' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
        tone === 'danger'
          ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600'
      } ${(disabled || loading) ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {loading ? (
        <span aria-hidden="true" className="inline-flex items-center gap-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
        </span>
      ) : (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
      {label}
    </button>
  )
}

function Field({
  label,
  children,
  hint,
  required = false,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <label className="space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
        {label}
        {required && <span className="ml-1 text-red-500 dark:text-red-400">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs leading-5 text-[color:var(--app-muted)]">{hint}</p>}
    </label>
  )
}

function LoadingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
    </span>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`}
    />
  )
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[108px] w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`}
    />
  )
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`}
    />
  )
}

function LocationSearchField({
  projectId,
  value,
  onChange,
  onSelect,
  placeholder = 'Search a city, town, street, or place',
}: {
  projectId: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: LocationSearchSuggestion) => void
  placeholder?: string
}) {
  const [results, setResults] = useState<LocationSearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debouncedValue = useDebouncedValue(value, 300)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const query = debouncedValue.trim()
    if (query.length < 3) {
      abortRef.current?.abort()
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    void locationsService.searchLocationSuggestions(projectId, query, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return
        setResults(items)
        setActiveIndex(0)
        setOpen(true)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setError(resolveErrorMessage(err, 'Could not load location suggestions.'))
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [projectId, debouncedValue])

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(current => Math.min(current + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(current => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      onSelect(results[activeIndex])
      setOpen(false)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={event => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (loading || error || results.length > 0 || value.trim().length >= 3) && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_22px_46px_rgba(15,23,42,0.16)]">
            {loading && (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-[color:var(--app-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--app-border)] border-t-orange-500" />
              Searching locations...
            </div>
          )}
          {!loading && error && (
            <div className="px-4 py-4 text-sm text-red-600 dark:text-red-300">{error}</div>
          )}
          {!loading && !error && results.length === 0 && value.trim().length >= 3 && (
            <div className="px-4 py-4 text-sm text-[color:var(--app-muted)]">No matching places found.</div>
          )}
          {!loading && !error && results.length > 0 && (
            <div className="max-h-72 overflow-y-auto py-2">
              {results.map((suggestion, index) => (
                <button
                  type="button"
                  key={suggestion.id}
                  onMouseDown={event => {
                    event.preventDefault()
                    onSelect(suggestion)
                    setOpen(false)
                  }}
                  className={`block w-full px-4 py-3 text-left transition ${
                    index === activeIndex
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-900 hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-900'
                  }`}
                >
                  <p className="text-sm font-medium">{suggestion.label}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{suggestion.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LocationsView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedLocationId = searchParams.get('locationId')
  const workspaceTab = workspaceTabFromValue(searchParams.get('tab'))

  const [createMode, setCreateMode] = useState<CreateMode>('menu')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null)
  const [locationTabSheetOpen, setLocationTabSheetOpen] = useState(false)
  const [switchingTab, setSwitchingTab] = useState<WorkspaceTab | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LocationRecord | null>(null)
  const [deletePrompt, setDeletePrompt] = useState<{
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)
  const [locationPage, setLocationPage] = useState(1)
  const [newLocationFile, setNewLocationFile] = useState<File | null>(null)
  const [newLocationPreview, setNewLocationPreview] = useState('')
  const [newLocationSearch, setNewLocationSearch] = useState('')
  const [dropLocationInput, setDropLocationInput] = useState('')
  const [dropInputMode, setDropInputMode] = useState<'typing' | 'paste'>('typing')
  const [dropLocationResolution, setDropLocationResolution] = useState<LocationResolutionRecord | null>(null)
  const [dropResolutionState, setDropResolutionState] = useState<'idle' | 'resolving' | 'ready' | 'error'>('idle')
  const [dropResolutionMessage, setDropResolutionMessage] = useState('')
  const [captureState, setCaptureState] = useState<'idle' | 'fetching' | 'ready' | 'error'>('idle')
  const [captureMessage, setCaptureMessage] = useState('')
  const [locationDraft, setLocationDraft] = useState<CreateLocationInput>(() => createDefaultLocationDraft(activeProjectId ?? ''))
  const [uploadPermissionId, setUploadPermissionId] = useState('')
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null)
  const [mediaUploadNotes, setMediaUploadNotes] = useState('')
  const [mediaUploadLatitude, setMediaUploadLatitude] = useState('')
  const [mediaUploadLongitude, setMediaUploadLongitude] = useState('')
  const [documentUploadFile, setDocumentUploadFile] = useState<File | null>(null)
  const [documentUploadCategory, setDocumentUploadCategory] = useState('noc')
  const [documentUploadNotes, setDocumentUploadNotes] = useState('')
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null)
  const [timelineForm, setTimelineForm] = useState<CreateLocationTimelineInput>({
    projectId: activeProjectId ?? '',
    title: '',
    description: '',
    eventType: 'custom',
    eventAt: '',
  })
  const [commentForm, setCommentForm] = useState<CreateLocationCommentInput>({
    projectId: activeProjectId ?? '',
    message: '',
  })
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, {
    id?: string
    projectId: string
    permissionType: LocationPermissionType
    customLabel?: string
    authorityName?: string
    authorityContact?: string
    status: LocationPermissionStatus
    expiryDate?: string
    notes?: string
  }>>({})
  const [amenityDrafts, setAmenityDrafts] = useState<Record<LocationAmenityType, UpsertLocationAmenityInput>>({
    hospital: { projectId: activeProjectId ?? '', amenityType: 'hospital', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
    police_station: { projectId: activeProjectId ?? '', amenityType: 'police_station', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
    petrol_bunk: { projectId: activeProjectId ?? '', amenityType: 'petrol_bunk', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
  })

  const selectedTab = workspaceTab

  useEffect(() => {
    if (!switchingTab) return
    const timer = window.setTimeout(() => setSwitchingTab(null), 180)
    return () => window.clearTimeout(timer)
  }, [switchingTab, selectedTab])

  const locationFileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)
  const documentFileInputRef = useRef<HTMLInputElement | null>(null)
  const dropResolveAbortRef = useRef<AbortController | null>(null)
  const mediaViewerDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  let selectedDetailData: LocationDetailRecord | null = null

  useEffect(() => {
    if (!activeProjectId) return
    setLocationDraft(current => ({ ...createDefaultLocationDraft(activeProjectId), ...current, projectId: activeProjectId }))
    setTimelineForm(current => ({ ...current, projectId: activeProjectId }))
    setCommentForm(current => ({ ...current, projectId: activeProjectId }))
    setAmenityDrafts({
      hospital: { projectId: activeProjectId, amenityType: 'hospital', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
      police_station: { projectId: activeProjectId, amenityType: 'police_station', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
      petrol_bunk: { projectId: activeProjectId, amenityType: 'petrol_bunk', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
    })
  }, [activeProjectId, activeProject?.currency])

  useEffect(() => {
    if (!newLocationFile) {
      setNewLocationPreview('')
      return
    }

    const previewUrl = fileToPreviewUrl(newLocationFile)
    setNewLocationPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [newLocationFile])

  const resolveDropLocationInput = (rawInput: string) => {
    const trimmed = rawInput.trim()
    if (createMode !== 'drop' || !activeProjectId || trimmed.length < 3) {
      return
    }

    const controller = new AbortController()
    dropResolveAbortRef.current?.abort()
    dropResolveAbortRef.current = controller
    setDropResolutionState('resolving')
    setDropResolutionMessage('Resolving location input...')

    void locationsService.resolveLocationInput(activeProjectId, trimmed, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return

        setDropLocationResolution(result)
        setLocationDraft(current => ({
          ...current,
          address: result.address,
          latitude: result.latitude ?? undefined,
          longitude: result.longitude ?? undefined,
        }))
        setDropResolutionState('ready')
        setDropResolutionMessage(
          result.source === 'coordinates'
            ? 'Coordinates resolved successfully.'
            : 'Location details resolved successfully.',
        )
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return

        setDropLocationResolution(null)
        setDropResolutionState('error')
        setDropResolutionMessage(resolveErrorMessage(error, 'Could not resolve the location input.'))
      })
  }

  useEffect(() => {
    if (createMode !== 'drop' || !activeProjectId || dropLocationInput.trim().length < 3) {
      dropResolveAbortRef.current?.abort()
      dropResolveAbortRef.current = null
      setDropLocationResolution(null)
      setDropResolutionState('idle')
      setDropResolutionMessage('')
      return
    }

    const delayMs = dropInputMode === 'paste' ? 400 : 700
    const timer = window.setTimeout(() => {
      resolveDropLocationInput(dropLocationInput)
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [activeProjectId, createMode, dropInputMode, dropLocationInput])

  useEffect(() => () => dropResolveAbortRef.current?.abort(), [])

  useEffect(() => {
    if (!selectedLocationId || !activeProjectId) {
      setPermissionDrafts({})
      return
    }

    const currentDrafts: Record<string, {
      id?: string
      projectId: string
      permissionType: LocationPermissionType
      customLabel?: string
      authorityName?: string
      authorityContact?: string
      status: LocationPermissionStatus
      expiryDate?: string
      notes?: string
    }> = {}

    PERMISSION_CHECKLIST.forEach(item => {
      const existing = selectedDetailData?.permissions.find(permission => {
        if (item.permissionType !== 'custom') {
          return permission.permissionType === item.permissionType
        }

        return permission.permissionType === 'custom' && normalizeLabel(permission.label) === normalizeLabel(item.label)
      })

      currentDrafts[item.key] = {
        id: existing?.id,
        projectId: activeProjectId,
        permissionType: item.permissionType,
        customLabel: item.permissionType === 'custom' ? item.defaultAssignedLabel ?? item.label : undefined,
        authorityName: existing?.authorityName ?? '',
        authorityContact: existing?.authorityContact ?? '',
        status: existing?.status ?? 'pending',
        expiryDate: existing?.expiryDate ?? '',
        notes: existing?.notes ?? '',
      }
    })

    setPermissionDrafts(currentDrafts)
  }, [selectedLocationId, activeProjectId])

  useEffect(() => {
    if (!selectedLocationId || !selectedDetailData) return

    const nextDrafts: Record<LocationAmenityType, UpsertLocationAmenityInput> = {
      hospital: { projectId: activeProjectId ?? '', amenityType: 'hospital', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
      police_station: { projectId: activeProjectId ?? '', amenityType: 'police_station', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
      petrol_bunk: { projectId: activeProjectId ?? '', amenityType: 'petrol_bunk', source: 'manual', name: '', address: '', phoneNumber: '', mapLink: '' },
    }

    selectedDetailData.amenities.forEach(amenity => {
      nextDrafts[amenity.amenityType] = {
        projectId: activeProjectId ?? '',
        amenityType: amenity.amenityType,
        name: amenity.name ?? '',
        address: amenity.address ?? '',
        phoneNumber: amenity.phoneNumber ?? '',
        distanceKm: amenity.distanceKm ?? undefined,
        latitude: amenity.latitude ?? undefined,
        longitude: amenity.longitude ?? undefined,
        mapLink: amenity.mapLink ?? '',
        source: amenity.source,
      }
    })

    setAmenityDrafts(nextDrafts)
  }, [selectedLocationId, selectedDetailData, activeProjectId])

  useEffect(() => {
    if (!activeProjectId) return
    setTimelineForm(current => ({ ...current, projectId: activeProjectId }))
    setCommentForm(current => ({ ...current, projectId: activeProjectId }))
  }, [activeProjectId])

  const locationsQuery = useQuery({
    queryKey: ['locations', activeProjectId, locationPage],
    queryFn: () => locationsService.getLocations(activeProjectId!, { page: locationPage, pageSize: 12 } satisfies LocationListFilters),
    enabled: Boolean(activeProjectId),
    staleTime: 15_000,
  })

  const selectedDetailQuery = useQuery({
    queryKey: ['location-detail', activeProjectId, selectedLocationId],
    queryFn: () => locationsService.getLocation(activeProjectId!, selectedLocationId!),
    enabled: Boolean(activeProjectId && selectedLocationId),
    staleTime: 10_000,
  })

  const scoutingMediaQuery = useQuery<PaginatedLocationMedia>({
    queryKey: ['location-media', activeProjectId, selectedLocationId],
    queryFn: () => locationsService.getMedia(activeProjectId!, selectedLocationId!, 1, 18),
    enabled: Boolean(activeProjectId && selectedLocationId && selectedTab === 'scouting'),
    staleTime: 10_000,
  })

  const documentsQuery = useQuery<PaginatedLocationDocuments>({
    queryKey: ['location-documents', activeProjectId, selectedLocationId],
    queryFn: () => locationsService.getDocuments(activeProjectId!, selectedLocationId!, 1, 18),
    enabled: Boolean(activeProjectId && selectedLocationId && selectedTab === 'documents'),
    staleTime: 10_000,
  })

  const nearbyAmenitiesQuery = useQuery({
    queryKey: ['location-nearby-amenities', activeProjectId, selectedLocationId, selectedDetailQuery.data?.location.latitude, selectedDetailQuery.data?.location.longitude],
    queryFn: () => locationsService.getNearbyAmenities(activeProjectId!, {
      latitude: selectedDetailQuery.data?.location.latitude ?? undefined,
      longitude: selectedDetailQuery.data?.location.longitude ?? undefined,
    }),
    enabled: Boolean(activeProjectId && selectedLocationId && selectedTab === 'amenities' && selectedDetailQuery.data?.location.latitude != null && selectedDetailQuery.data?.location.longitude != null),
    staleTime: 5 * 60 * 1000,
  })
  const nearbyHotelsQuery = useQuery<NearbyHotelSuggestion[]>({
    queryKey: ['location-nearby-hotels', activeProjectId, selectedLocationId, selectedDetailQuery.data?.location.latitude, selectedDetailQuery.data?.location.longitude],
    queryFn: () => locationsService.getNearbyHotels(activeProjectId!, {
      latitude: selectedDetailQuery.data?.location.latitude ?? undefined,
      longitude: selectedDetailQuery.data?.location.longitude ?? undefined,
    }),
    enabled: Boolean(activeProjectId && selectedLocationId && selectedTab === 'amenities' && selectedDetailQuery.data?.location.latitude != null && selectedDetailQuery.data?.location.longitude != null),
    staleTime: 5 * 60 * 1000,
  })

  selectedDetailData = selectedDetailQuery.data ?? null
  const selectedLocation = selectedDetailData?.location ?? null
  const locations = locationsQuery.data?.data ?? []

  useEffect(() => {
    if (!activeProjectId) return
    if (!selectedLocationId && locations.length > 0) return
    if (selectedLocationId && locations.some(location => location.id === selectedLocationId)) return
    if (selectedLocationId && selectedDetailQuery.data) return
    if (selectedLocationId && !locationsQuery.isFetching && !selectedDetailQuery.isFetching && !selectedLocation) {
      setSearchParams(params => {
        params.delete('locationId')
        params.delete('tab')
        return params
      })
    }
  }, [activeProjectId, selectedLocationId, locations, selectedDetailQuery.data, locationsQuery.isFetching, selectedDetailQuery.isFetching, selectedLocation, setSearchParams])

  useEffect(() => {
    if (!activeProjectId) return
    setLocationDraft(current => ({ ...createDefaultLocationDraft(activeProjectId), ...current, projectId: activeProjectId }))
  }, [activeProjectId])

  const invalidateLocationData = async (locationId?: string | null) => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['locations', activeProjectId] }),
    queryClient.invalidateQueries({ queryKey: ['location-detail', activeProjectId, locationId ?? selectedLocationId] }),
    queryClient.invalidateQueries({ queryKey: ['location-media', activeProjectId, locationId ?? selectedLocationId] }),
    queryClient.invalidateQueries({ queryKey: ['location-documents', activeProjectId, locationId ?? selectedLocationId] }),
    queryClient.invalidateQueries({ queryKey: ['locations-dashboard', activeProjectId] }),
    queryClient.invalidateQueries({ queryKey: ['locations-reports', activeProjectId] }),
    queryClient.invalidateQueries({ queryKey: ['activity', activeProjectId] }),
    queryClient.invalidateQueries({ queryKey: ['alerts', activeProjectId] }),
  ])

  const createLocationMutation = useMutation({
    mutationFn: async (payload: { values: CreateLocationInput; imageFile?: File | null; imageLatitude?: number; imageLongitude?: number; imageNotes?: string }) => {
      const created = await locationsService.createLocation(payload.values)
      if (payload.imageFile) {
        await locationsService.uploadMedia(
          created.location.id,
          {
            projectId: payload.values.projectId,
            notes: payload.imageNotes ?? payload.values.notes ?? undefined,
            latitude: payload.imageLatitude,
            longitude: payload.imageLongitude,
            uploadTime: new Date().toISOString(),
          },
          payload.imageFile,
        )
      }
      return created
    },
    onSuccess: async result => {
      await invalidateLocationData(result.location.id)
      setCreateModalOpen(false)
      setCreateMode('menu')
      setNewLocationFile(null)
      setNewLocationSearch('')
      setNewLocationPreview('')
      setCaptureState('idle')
      setCaptureMessage('')
      setLocationDraft(createDefaultLocationDraft(activeProjectId ?? ''))
      setSearchParams(params => {
        params.set('locationId', result.location.id)
        params.set('tab', 'overview')
        return params
      })
      showSuccess('Location created.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not create location.')),
  })

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateLocationInput }) => locationsService.updateLocation(id, values),
    onSuccess: async result => {
      await invalidateLocationData(result.location.id)
      setCreateModalOpen(false)
      setEditingLocation(null)
      setLocationDraft(createDefaultLocationDraft(activeProjectId ?? ''))
      showSuccess('Location updated.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not update location.')),
  })

  const deleteLocationMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => locationsService.deleteLocation(projectId, id),
    onSuccess: async () => {
      await invalidateLocationData(deleteTarget?.id)
      setDeleteTarget(null)
      setSearchParams(params => {
        params.delete('locationId')
        params.delete('tab')
        return params
      })
      showSuccess('Location deleted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not delete location.')),
  })

  const uploadMediaMutation = useMutation({
    mutationFn: ({ locationId, projectId, file, notes, latitude, longitude }: { locationId: string; projectId: string; file: File; notes?: string; latitude?: number; longitude?: number }) =>
      locationsService.uploadMedia(locationId, {
        projectId,
        notes,
        latitude,
        longitude,
        uploadTime: new Date().toISOString(),
      }, file),
    onSuccess: async () => {
      setMediaUploadFile(null)
      setMediaUploadNotes('')
      setMediaUploadLatitude('')
      setMediaUploadLongitude('')
      await invalidateLocationData()
      showSuccess('Image uploaded.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not upload media.')),
  })

  const deleteMediaMutation = useMutation({
    mutationFn: ({ projectId, locationId, mediaId }: { projectId: string; locationId: string; mediaId: string }) => locationsService.deleteMedia(projectId, locationId, mediaId),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Media deleted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not delete media.')),
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ locationId, projectId, file, category, permissionId, notes }: { locationId: string; projectId: string; file: File; category: string; permissionId?: string; notes?: string }) =>
      locationsService.uploadDocument(locationId, { projectId, category, permissionId, notes }, file),
    onSuccess: async () => {
      setDocumentUploadFile(null)
      setDocumentUploadCategory('noc')
      setDocumentUploadNotes('')
      setUploadPermissionId('')
      await invalidateLocationData()
      showSuccess('Document uploaded.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not upload document.')),
  })

  const deleteDocumentMutation = useMutation({
    mutationFn: ({ projectId, locationId, documentId }: { projectId: string; locationId: string; documentId: string }) => locationsService.deleteDocument(projectId, locationId, documentId),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Document deleted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not delete document.')),
  })

  const createPermissionMutation = useMutation({
    mutationFn: ({ locationId, values }: { locationId: string; values: CreateLocationPermissionInput }) => locationsService.createPermission(locationId, values),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Permission saved.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save permission.')),
  })

  const updatePermissionMutation = useMutation({
    mutationFn: ({ locationId, permissionId, values }: { locationId: string; permissionId: string; values: Partial<CreateLocationPermissionInput> & { projectId: string } }) =>
      locationsService.updatePermission(locationId, permissionId, values),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Permission updated.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not update permission.')),
  })

  const deletePermissionMutation = useMutation({
    mutationFn: ({ projectId, locationId, permissionId }: { projectId: string; locationId: string; permissionId: string }) => locationsService.deletePermission(projectId, locationId, permissionId),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Permission deleted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not delete permission.')),
  })

  const upsertAmenityMutation = useMutation({
    mutationFn: ({ locationId, values }: { locationId: string; values: UpsertLocationAmenityInput }) => locationsService.upsertAmenity(locationId, values),
    onSuccess: async () => {
      await invalidateLocationData()
      showSuccess('Amenity saved.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save amenity.')),
  })

  const createTimelineMutation = useMutation({
    mutationFn: ({ locationId, values }: { locationId: string; values: CreateLocationTimelineInput }) => locationsService.createTimeline(locationId, values),
    onSuccess: async () => {
      setTimelineForm(current => ({ ...current, title: '', description: '', eventType: 'custom', eventAt: '' }))
      await invalidateLocationData()
      showSuccess('Timeline entry added.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not add timeline entry.')),
  })

  const createCommentMutation = useMutation({
    mutationFn: ({ locationId, values }: { locationId: string; values: CreateLocationCommentInput }) => locationsService.createComment(locationId, values),
    onSuccess: async () => {
      setCommentForm(current => ({ ...current, message: '' }))
      await invalidateLocationData()
      showSuccess('Comment added.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not add comment.')),
  })

  const handleWorkspaceTabSwitch = (locationId: string, tab: WorkspaceTab) => {
    setSwitchingTab(tab)
    setSearchParams(params => {
      params.set('locationId', locationId)
      params.set('tab', tab)
      return params
    })
  }

  const openMediaViewer = (item: LocationMediaRecord) => {
    setMediaViewer({
      item,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
  }

  const closeMediaViewer = () => {
    setMediaViewer(null)
    mediaViewerDragRef.current = null
  }

  const updateMediaViewerScale = (nextScale: number) => {
    setMediaViewer(current => {
      if (!current) return current
      return {
        ...current,
        scale: Math.max(1, Math.min(4, Number(nextScale.toFixed(2)))),
      }
    })
  }

  const resetMediaViewerPosition = () => {
    setMediaViewer(current => {
      if (!current) return current
      return {
        ...current,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      }
    })
  }

  const downloadMediaFile = (item: LocationMediaRecord) => {
    const anchor = document.createElement('a')
    anchor.href = item.url
    anchor.download = item.originalName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const startMediaDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!mediaViewer || mediaViewer.item.mediaKind !== 'image') return
    mediaViewerDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: mediaViewer.offsetX,
      originY: mediaViewer.offsetY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveMediaDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!mediaViewer || mediaViewer.item.mediaKind !== 'image' || !mediaViewerDragRef.current) return
    const { startX, startY, originX, originY } = mediaViewerDragRef.current
    const nextOffsetX = originX + (event.clientX - startX)
    const nextOffsetY = originY + (event.clientY - startY)
    setMediaViewer(current => current ? { ...current, offsetX: nextOffsetX, offsetY: nextOffsetY } : current)
  }

  const stopMediaDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    mediaViewerDragRef.current = null
  }

  const selectedDetailComments = selectedDetailData?.comments ?? []

  const overviewStats = useMemo(() => {
    const readiness = selectedLocation?.readiness
    const permissionsComplete = selectedDetailData?.permissions.filter(permission => permission.status === 'approved').length ?? 0
    const permissionsTotal = selectedDetailData?.permissions.length ?? 0
    const mediaCount = scoutingMediaQuery.data?.pagination.total ?? selectedLocation?.metrics.mediaCount ?? 0
    const documentCount = documentsQuery.data?.pagination.total ?? selectedLocation?.metrics.documentCount ?? 0
    const timelineCount = selectedDetailData?.timeline.length ?? 0
    const totalCost = selectedDetailData?.costs.reduce((sum, cost) => sum + cost.amount, 0) ?? 0
    const pendingCosts = selectedDetailData?.costs.filter(cost => cost.approvalStatus === 'pending').length ?? 0

    return {
      readinessScore: readiness?.readinessScore ?? 0,
      readinessSummary: readiness?.summary ?? 'Readiness has not been calculated yet.',
      permissionsScore: permissionsTotal > 0 ? `${permissionsComplete}/${permissionsTotal}` : '0/0',
      mediaCount,
      documentCount,
      timelineCount,
      totalCost,
      pendingCosts,
    }
  }, [documentsQuery.data?.pagination.total, scoutingMediaQuery.data?.pagination.total, selectedDetailData, selectedLocation])

  const renderOverviewPanel = () => {
    if (!selectedLocation) {
      return <EmptyState icon="map" title="Select a location" description="Open a location workspace to review readiness, scouting, permissions, amenities, documents, and timeline activity." />
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Surface variant="table" padding="lg">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Selected Location</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{selectedLocation.name}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{selectedLocation.address}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge variant={locationStatusVariant(selectedLocation.status)} label={labelize(selectedLocation.status)} />
                <StatusBadge variant={riskVariant(selectedLocation.riskLevel)} label={`${labelize(selectedLocation.riskLevel)} Risk`} />
                <StatusBadge variant={selectedLocation.readiness?.readinessStatus === 'ready' ? 'approved' : selectedLocation.readiness?.readinessStatus === 'almost_ready' ? 'warning' : 'pending'} label={selectedLocation.readiness?.readinessStatus ? labelize(selectedLocation.readiness.readinessStatus) : 'Not Ready'} />
              </div>
            </div>
            <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Shoot Window</p>
              <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{formatRange(selectedLocation.shootStartDate, selectedLocation.shootEndDate)}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{selectedLocation.readiness?.summary ?? 'Readiness summary will appear as permissions, media, and documents are completed.'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Shoot Readiness" value={String(selectedLocation.readiness?.readinessScore ?? 0)} subLabel={selectedLocation.readiness?.readinessStatus ? labelize(selectedLocation.readiness.readinessStatus) : 'Not ready'} subType={selectedLocation.readiness?.readinessStatus === 'ready' ? 'success' : selectedLocation.readiness?.readinessStatus === 'almost_ready' ? 'warning' : 'critical'} />
            <KpiCard label="Permission Readiness" value={overviewStats.permissionsScore} subLabel="Approved / total" />
            <KpiCard label="Risk Score" value={selectedLocation.riskLevel === 'high' ? '90' : selectedLocation.riskLevel === 'medium' ? '60' : '30'} subLabel={`${labelize(selectedLocation.riskLevel)} risk profile`} />
            <KpiCard label="Document Count" value={String(overviewStats.documentCount)} subLabel="Secure files stored" />
            <KpiCard label="Gallery Count" value={String(overviewStats.mediaCount)} subLabel="Images and videos captured" />
            <KpiCard label="Timeline Activity" value={String(overviewStats.timelineCount)} subLabel="Audit-safe events logged" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Project Spend</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(overviewStats.totalCost)}</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{overviewStats.pendingCosts} cost approvals pending</p>
            </div>
            <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Latest Timeline Entry</p>
              {selectedDetailData?.timeline[0] ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">{selectedDetailData.timeline[0].title}</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(selectedDetailData.timeline[0].eventAt)} · {timeAgo(selectedDetailData.timeline[0].eventAt)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No timeline activity yet.</p>
              )}
            </div>
          </div>
        </Surface>

        <div className="space-y-6">
          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Map Preview</p>
                <h3 className="section-title">Location Snapshot</h3>
              </div>
            </div>
            <div className="mt-5">
              <LocationPreviewMap
                latitude={selectedLocation.latitude}
                longitude={selectedLocation.longitude}
                name={selectedLocation.name}
                address={selectedLocation.address}
              />
            </div>
          </Surface>

          <Surface variant="table" padding="lg">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Quick Facts</p>
                <h3 className="section-title">Production Notes</h3>
              </div>
            </div>
            <div className="mt-5 space-y-4 text-sm text-zinc-500 dark:text-zinc-400">
              <p><span className="font-semibold text-zinc-900 dark:text-white">Type:</span> {labelize(selectedLocation.locationType)}</p>
              <p><span className="font-semibold text-zinc-900 dark:text-white">Coordinates:</span> {selectedLocation.latitude != null && selectedLocation.longitude != null ? `${selectedLocation.latitude.toFixed(5)}, ${selectedLocation.longitude.toFixed(5)}` : 'Unavailable'}</p>
              <p><span className="font-semibold text-zinc-900 dark:text-white">Notes:</span> {selectedLocation.notes?.trim() || 'No additional notes.'}</p>
            </div>
          </Surface>
        </div>
        <SectionSelectorSheet
          open={locationTabSheetOpen}
          title="Select Section"
          description="Choose a workspace section without horizontal scrolling."
          selectedId={selectedTab}
          options={WORKSPACE_TABS}
          onSelect={tab => {
            setLocationTabSheetOpen(false)
            handleWorkspaceTabSwitch(selectedLocation.id, tab as WorkspaceTab)
          }}
          onClose={() => setLocationTabSheetOpen(false)}
        />
      </div>
    )
  }

  const renderScoutingPanel = () => {
    const media = scoutingMediaQuery.data?.data ?? []
    const hasMedia = media.length > 0

    if (!selectedLocation) {
      return <EmptyState icon="photo_library" title="Select a location first" description="Scouting media is tied to a single location workspace." />
    }

    return (
      <Surface variant="table" padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Scouting Gallery</p>
            <h3 className="section-title">Images, videos, and capture history</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={mediaFileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0] ?? null
                if (!file) return
                setMediaUploadFile(file)
                setMediaUploadNotes('')
                setMediaUploadLatitude('')
                setMediaUploadLongitude('')
              }}
            />
            <ActionButton label="Upload" icon="upload" loading={uploadMediaMutation.isPending} disabled={createLocationMutation.isPending || updateLocationMutation.isPending} onClick={() => mediaFileInputRef.current?.click()} />
          </div>
        </div>

        {!hasMedia ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/70">
            <EmptyState
              icon="photo_camera"
              title="Nothing is here yet"
              description="Upload scouting photos or clips to start the gallery."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {media.map(item => (
              <Surface key={item.id} variant="raised" padding="none" className="overflow-hidden">
                <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                  {item.mediaKind === 'image' ? (
                    <img src={item.url} alt={item.originalName} className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} controls className="h-full w-full object-cover bg-black" />
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{item.originalName}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(item.uploadTime)} · {timeAgo(item.uploadTime)}</p>
                    </div>
                    <StatusBadge variant={item.mediaKind === 'image' ? 'approved' : 'stable'} label={item.mediaKind.toUpperCase()} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.latitude != null && item.longitude != null && <StatusBadge variant="stable" label={`Geo ${item.latitude.toFixed(3)}, ${item.longitude.toFixed(3)}`} />}
                    {item.uploadedByName && <StatusBadge variant="stable" label={item.uploadedByName} />}
                  </div>
                  {item.notes && <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.notes}</p>}
                  <div className="flex flex-wrap gap-3">
                    <ActionButton
                      label="Open"
                      icon="visibility"
                      onClick={() => openMediaViewer(item)}
                    />
                    <ActionButton
                      label="Delete"
                      icon="delete"
                      tone="danger"
                      loading={deleteMediaMutation.isPending}
                      onClick={() => {
                        if (!selectedLocationId || !activeProjectId) return
                        setDeletePrompt({
                          title: 'Delete Media',
                          description: `Delete ${item.originalName}? This removes the scouting file from the current location.`,
                          confirmLabel: 'Delete Media',
                          onConfirm: () => deleteMediaMutation.mutate({ projectId: activeProjectId, locationId: selectedLocationId, mediaId: item.id }),
                        })
                      }}
                    />
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {mediaUploadFile && (
          <Surface variant="muted" padding="lg" className="mt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{mediaUploadFile.name}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{Math.round(mediaUploadFile.size / 1024)} KB</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Latitude"><Input value={mediaUploadLatitude} onChange={event => setMediaUploadLatitude(event.target.value)} placeholder="Optional" /></Field>
                <Field label="Longitude"><Input value={mediaUploadLongitude} onChange={event => setMediaUploadLongitude(event.target.value)} placeholder="Optional" /></Field>
                <Field label="Notes"><Input value={mediaUploadNotes} onChange={event => setMediaUploadNotes(event.target.value)} placeholder="Optional" /></Field>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <ActionButton label="Cancel" icon="close" onClick={() => setMediaUploadFile(null)} />
              <ActionButton
                label="Upload File"
                icon="upload"
                loading={uploadMediaMutation.isPending}
                onClick={() => {
                  if (!selectedLocationId || !activeProjectId || !mediaUploadFile) return
                  uploadMediaMutation.mutate({
                    locationId: selectedLocationId,
                    projectId: activeProjectId,
                    file: mediaUploadFile,
                    notes: mediaUploadNotes || undefined,
                    latitude: mediaUploadLatitude ? Number(mediaUploadLatitude) : undefined,
                    longitude: mediaUploadLongitude ? Number(mediaUploadLongitude) : undefined,
                  })
                }}
              />
            </div>
          </Surface>
        )}
      </Surface>
    )
  }

  const renderPermissionsPanel = () => {
    if (!selectedLocation) {
      return <EmptyState icon="fact_check" title="Select a location first" description="Permissions are managed per location workspace." />
    }

    return (
      <Surface variant="table" padding="lg">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Permissions</p>
            <h3 className="section-title">Checklist-first compliance workflow</h3>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {PERMISSION_CHECKLIST.map(item => {
            const draft = permissionDrafts[item.key]
            const existing = selectedDetailData?.permissions.find(permission => {
              if (item.permissionType !== 'custom') {
                return permission.permissionType === item.permissionType
              }

              return permission.permissionType === 'custom' && normalizeLabel(permission.label) === normalizeLabel(item.label)
            }) ?? null

            if (!draft) return null

            return (
              <div key={item.key} className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${existing ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                        <span className="material-symbols-outlined text-[18px]">{existing ? 'check_circle' : 'radio_button_unchecked'}</span>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.label}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{existing ? 'Tracked and editable' : 'Not started yet'}</p>
                      </div>
                      {existing && <StatusBadge variant={permissionStatusVariant(existing.status)} label={labelize(existing.status)} />}
                    </div>
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Due date, assigned person, notes, and attachments are all handled here without leaving the location workspace.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ActionButton
                      label="Attach Doc"
                      icon="attach_file"
                      onClick={() => {
                        setUploadPermissionId(existing?.id ?? '')
                        setSearchParams(params => {
                          params.set('locationId', selectedLocation.id)
                          params.set('tab', 'documents')
                          return params
                        })
                      }}
                    />
                    {existing && (
                      <ActionButton
                        label="Delete"
                        icon="delete"
                        tone="danger"
                        loading={deletePermissionMutation.isPending}
                        onClick={() => deletePermissionMutation.mutate({
                          projectId: activeProjectId!,
                          locationId: selectedLocation.id,
                          permissionId: existing.id,
                        })}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Status">
                    <Select
                      value={draft.status}
                      onChange={event => setPermissionDrafts(current => ({
                        ...current,
                        [item.key]: { ...current[item.key], status: event.target.value as LocationPermissionStatus },
                      }))}
                    >
                      <option value="pending">Pending</option>
                      <option value="submitted">In Progress</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </Select>
                  </Field>
                  <Field label="Due Date">
                    <Input
                      type="date"
                      value={draft.expiryDate ?? ''}
                      onChange={event => setPermissionDrafts(current => ({
                        ...current,
                        [item.key]: { ...current[item.key], expiryDate: event.target.value },
                      }))}
                    />
                  </Field>
                  <Field label="Assigned Person">
                    <Input
                      value={draft.authorityName ?? ''}
                      onChange={event => setPermissionDrafts(current => ({
                        ...current,
                        [item.key]: { ...current[item.key], authorityName: event.target.value },
                      }))}
                    />
                  </Field>
                  <Field label="Contact">
                    <Input
                      value={draft.authorityContact ?? ''}
                      onChange={event => setPermissionDrafts(current => ({
                        ...current,
                        [item.key]: { ...current[item.key], authorityContact: event.target.value },
                      }))}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_220px]">
                  <Field label="Notes">
                    <Textarea
                      value={draft.notes ?? ''}
                      onChange={event => setPermissionDrafts(current => ({
                        ...current,
                        [item.key]: { ...current[item.key], notes: event.target.value },
                      }))}
                    />
                  </Field>
                  <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Attachment Hint</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Use Documents to attach the actual PDF or scan. The button above opens the upload flow already linked to this permission.</p>
                    <div className="mt-4 flex justify-end">
                    <ActionButton
                      label={existing ? 'Save Changes' : 'Create Item'}
                      icon="save"
                      loading={existing ? updatePermissionMutation.isPending : createPermissionMutation.isPending}
                      onClick={() => {
                          if (!selectedLocationId || !activeProjectId) return
                          const values: CreateLocationPermissionInput = {
                            projectId: activeProjectId,
                            permissionType: draft.permissionType,
                            customLabel: draft.permissionType === 'custom' ? (draft.customLabel ?? item.label) : undefined,
                            authorityName: draft.authorityName || undefined,
                            authorityContact: draft.authorityContact || undefined,
                            status: draft.status,
                            issueDate: undefined,
                            expiryDate: draft.expiryDate || undefined,
                            notes: draft.notes || undefined,
                          }

                          if (existing) {
                            updatePermissionMutation.mutate({
                              locationId: selectedLocationId,
                              permissionId: existing.id,
                              values,
                            })
                            return
                          }

                          createPermissionMutation.mutate({
                            locationId: selectedLocationId,
                            values,
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Surface>
    )
  }

  const renderAmenitiesPanel = () => {
    if (!selectedLocation) {
      return <EmptyState icon="local_hospital" title="Select a location first" description="Nearby amenities are calculated from saved coordinates." />
    }

    if (selectedLocation.latitude == null || selectedLocation.longitude == null) {
      return <EmptyState icon="location_off" title="Coordinates required" description="Capture or select a location with GPS coordinates to load nearby amenities." />
    }

    const nearbyByType = new Map<LocationAmenityType, NearbyAmenitySuggestion[]>()
    ;(nearbyAmenitiesQuery.data ?? []).forEach(item => {
      const current = nearbyByType.get(item.amenityType) ?? []
      current.push(item)
      nearbyByType.set(item.amenityType, current)
    })
    const hotelSuggestions = nearbyHotelsQuery.data ?? []

    const amenityCards: Array<{ key: LocationAmenityType; label: string }> = [
      { key: 'hospital', label: 'Hospitals' },
      { key: 'police_station', label: 'Police Stations' },
      { key: 'petrol_bunk', label: 'Petrol Pumps' },
    ]

    return (
      <Surface variant="table" padding="lg">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Nearby Amenities</p>
            <h3 className="section-title">Mapbox-powered essentials within 5 km</h3>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {amenityCards.map(card => {
            const draft = amenityDrafts[card.key]
            const results = nearbyByType.get(card.key) ?? []
            const existing = selectedDetailData?.amenities.find(amenity => amenity.amenityType === card.key) ?? null

            return (
              <div key={card.key} className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{card.label}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{results.length > 0 ? 'Nearby matches found' : 'No nearby match, fill manually'}</p>
                  </div>
                  {existing && <StatusBadge variant={existing.source === 'mapbox' ? 'approved' : 'stable'} label={existing.source.toUpperCase()} />}
                </div>

                <div className="mt-4 space-y-2">
                  {results.slice(0, 3).map(result => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setAmenityDrafts(current => ({
                          ...current,
                          [card.key]: {
                            ...current[card.key],
                            amenityType: card.key,
                            source: 'mapbox',
                            name: result.name,
                            address: result.address,
                            phoneNumber: result.phoneNumber ?? '',
                            distanceKm: result.distanceKm,
                            latitude: result.latitude ?? undefined,
                            longitude: result.longitude ?? undefined,
                            mapLink: result.mapLink ?? '',
                          },
                        }))
                        const directionsUrl = buildDirectionsUrl(result.latitude, result.longitude) ?? result.mapLink
                        if (directionsUrl) {
                          window.open(directionsUrl, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      className="w-full rounded-[22px] border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{result.name}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{result.address}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge variant="stable" label={`${result.distanceKm.toFixed(2)} km`} />
                        {result.metadata?.poiCategories?.[0] && <StatusBadge variant="stable" label={result.metadata.poiCategories[0]} />}
                      </div>
                    </button>
                  ))}
                </div>

                {results.length === 0 && (
                  <div className="mt-4 rounded-[22px] border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    Nothing nearby surfaced automatically. Add the best known option manually.
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <Field label="Name"><Input value={draft.name ?? ''} onChange={event => setAmenityDrafts(current => ({ ...current, [card.key]: { ...current[card.key], amenityType: card.key, name: event.target.value } }))} /></Field>
                  <Field label="Address"><Input value={draft.address ?? ''} onChange={event => setAmenityDrafts(current => ({ ...current, [card.key]: { ...current[card.key], amenityType: card.key, address: event.target.value } }))} /></Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Phone"><Input value={draft.phoneNumber ?? ''} onChange={event => setAmenityDrafts(current => ({ ...current, [card.key]: { ...current[card.key], amenityType: card.key, phoneNumber: event.target.value } }))} /></Field>
                    <Field label="Distance Km"><Input type="number" step="0.01" min="0" value={draft.distanceKm ?? ''} onChange={event => setAmenityDrafts(current => ({ ...current, [card.key]: { ...current[card.key], amenityType: card.key, distanceKm: event.target.value ? Number(event.target.value) : undefined } }))} /></Field>
                  </div>
                  <Field label="Directions Link"><Input value={draft.mapLink ?? ''} onChange={event => setAmenityDrafts(current => ({ ...current, [card.key]: { ...current[card.key], amenityType: card.key, mapLink: event.target.value } }))} /></Field>
                  <div className="flex flex-wrap justify-end gap-3">
                    <ActionButton
                      label="Save"
                      icon="save"
                      loading={upsertAmenityMutation.isPending}
                      onClick={() => {
                        if (!selectedLocationId || !activeProjectId) return
                        upsertAmenityMutation.mutate({
                          locationId: selectedLocationId,
                          values: {
                            ...draft,
                            projectId: activeProjectId,
                            source: draft.source ?? 'manual',
                          },
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Hotels</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Nearby stays pulled from the same Mapbox lookup pipeline.</p>
            </div>
            <StatusBadge variant="stable" label={hotelSuggestions.length > 0 ? `${hotelSuggestions.length} found` : 'No hotel match'} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {hotelSuggestions.slice(0, 3).map(hotel => (
              <div key={hotel.id} className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{hotel.name}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hotel.address}</p>
                  </div>
                  <StatusBadge variant="stable" label={`${hotel.distanceKm.toFixed(2)} km`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hotel.phoneNumber && <StatusBadge variant="stable" label={hotel.phoneNumber} />}
                  {hotel.metadata?.poiCategories?.[0] && <StatusBadge variant="stable" label={hotel.metadata.poiCategories[0]} />}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ActionButton
                    label="Open"
                    icon="open_in_new"
                    onClick={() => {
                      const directionsUrl = buildDirectionsUrl(hotel.latitude, hotel.longitude) ?? hotel.mapLink
                      if (directionsUrl) {
                        window.open(directionsUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Surface>
    )
  }

  const renderDocumentsPanel = () => {
    if (!selectedLocation) {
      return <EmptyState icon="folder_open" title="Select a location first" description="Documents are tied to one location workspace." />
    }

    const docs = documentsQuery.data?.data ?? []
    const groupedVersionMap = new Map<string, number>()
    docs
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .forEach(document => {
        const key = `${document.category}:${document.permissionId ?? 'none'}`
        groupedVersionMap.set(key, (groupedVersionMap.get(key) ?? 0) + 1)
      })

    return (
      <Surface variant="table" padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-kicker">Documents</p>
            <h3 className="section-title">Upload, preview, version, and replace</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={documentFileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0] ?? null
                if (!file) return
                setDocumentUploadFile(file)
              }}
            />
            <ActionButton label="Upload" icon="upload_file" onClick={() => documentFileInputRef.current?.click()} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Category">
            <Input value={documentUploadCategory} onChange={event => setDocumentUploadCategory(event.target.value)} />
          </Field>
          <Field label="Permission Link">
            <Select value={uploadPermissionId} onChange={event => setUploadPermissionId(event.target.value)}>
              <option value="">No linked permission</option>
              {selectedDetailData?.permissions.map(permission => (
                <option key={permission.id} value={permission.id}>{permission.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={documentUploadNotes} onChange={event => setDocumentUploadNotes(event.target.value)} />
          </Field>
          <Field label="File">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              {documentUploadFile ? documentUploadFile.name : 'Choose a PDF, image, or scan'}
            </div>
          </Field>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <ActionButton
            label="Replace"
            icon="swap_horiz"
            loading={uploadDocumentMutation.isPending}
            onClick={() => {
              if (!documentUploadFile) {
                documentFileInputRef.current?.click()
                return
              }
              if (!selectedLocationId || !activeProjectId) return
              uploadDocumentMutation.mutate({
                locationId: selectedLocationId,
                projectId: activeProjectId,
                file: documentUploadFile,
                category: documentUploadCategory,
                permissionId: uploadPermissionId || undefined,
                notes: documentUploadNotes || undefined,
              })
            }}
          />
          <ActionButton
            label="Upload Document"
            icon="upload_file"
            loading={uploadDocumentMutation.isPending}
            onClick={() => {
              if (!selectedLocationId || !activeProjectId || !documentUploadFile) {
                showError('Choose a document file first.')
                return
              }
              uploadDocumentMutation.mutate({
                locationId: selectedLocationId,
                projectId: activeProjectId,
                file: documentUploadFile,
                category: documentUploadCategory,
                permissionId: uploadPermissionId || undefined,
                notes: documentUploadNotes || undefined,
              })
            }}
          />
        </div>

        <div className="mt-6 space-y-3">
          {docs.length === 0 ? (
            <EmptyState icon="folder_open" title="No documents yet" description="Upload permissions, contracts, NOCs, and insurance docs here." />
          ) : (
            docs.map(document => {
              const versionKey = `${document.category}:${document.permissionId ?? 'none'}`
              const version = groupedVersionMap.get(versionKey) ?? 1

              return (
                <div key={document.id} className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{document.originalName}</p>
                        <StatusBadge variant="stable" label={`v${version}`} />
                        {document.permissionId && <StatusBadge variant="approved" label="Linked" />}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {document.category} · {document.uploadedByName ?? 'ProdSync User'} · {formatDate(document.createdAt)}
                      </p>
                      {document.notes && <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{document.notes}</p>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <a href={document.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-zinc-600 dark:hover:bg-zinc-900">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Preview
                      </a>
                      <a href={document.url} download={document.originalName} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-zinc-600 dark:hover:bg-zinc-900">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Download
                      </a>
                      <ActionButton
                        label="Replace"
                        icon="swap_horiz"
                        loading={uploadDocumentMutation.isPending}
                        onClick={() => {
                          setDocumentUploadCategory(document.category)
                          setUploadPermissionId(document.permissionId ?? '')
                          setDocumentUploadNotes(document.notes ?? '')
                          documentFileInputRef.current?.click()
                        }}
                      />
                      <ActionButton
                        label="Delete"
                        icon="delete"
                        tone="danger"
                        loading={deleteDocumentMutation.isPending}
                        onClick={() => {
                          if (!selectedLocationId || !activeProjectId) return
                          setDeletePrompt({
                            title: 'Delete Document',
                            description: `Delete ${document.originalName}? The file will be removed from the location repository.`,
                            confirmLabel: 'Delete Document',
                            onConfirm: () => deleteDocumentMutation.mutate({
                              projectId: activeProjectId,
                              locationId: selectedLocationId,
                              documentId: document.id,
                            }),
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Surface>
    )
  }

  const renderTimelinePanel = () => {
    if (!selectedLocation) {
      return <EmptyState icon="timeline" title="Select a location first" description="Timeline entries belong to a single location workspace." />
    }

    const feed = [
      ...selectedDetailData?.timeline.map(item => ({ kind: 'timeline' as const, date: item.eventAt, item })) ?? [],
      ...selectedDetailComments.map(item => ({ kind: 'comment' as const, date: item.createdAt, item })),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())

    return (
      <Surface variant="table" padding="lg">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Timeline</p>
            <h3 className="section-title">Chronological activity feed</h3>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {feed.length === 0 ? (
              <EmptyState icon="history" title="No activity yet" description="Location events, uploads, permission changes, and comments will appear here." />
            ) : feed.map(entry => {
              if (entry.kind === 'comment') {
                const comment = entry.item as LocationCommentRecord
                return (
                  <div key={comment.id} className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">User Comment</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{comment.userName ?? 'ProdSync User'} · {formatDate(comment.createdAt)}</p>
                      </div>
                      <StatusBadge variant="stable" label="COMMENT" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{comment.message}</p>
                  </div>
                )
              }

              const timelineItem = entry.item as LocationTimelineRecord
              return (
                <div key={timelineItem.id} className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{timelineItem.title}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(timelineItem.eventAt)} · {timeAgo(timelineItem.eventAt)}</p>
                    </div>
                    <StatusBadge variant="stable" label={labelize(timelineItem.eventType)} />
                  </div>
                  {timelineItem.description && <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{timelineItem.description}</p>}
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Logged by {timelineItem.createdByName ?? 'ProdSync User'}</p>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Add Comment</p>
              <Textarea
                value={commentForm.message}
                onChange={event => setCommentForm(current => ({ ...current, message: event.target.value }))}
                placeholder="Share a production update..."
                className="mt-3"
              />
              <div className="mt-4 flex justify-end">
                <ActionButton
                  label="Post Comment"
                  icon="send"
                  loading={createCommentMutation.isPending}
                  onClick={() => {
                    if (!selectedLocationId || !activeProjectId || !commentForm.message.trim()) return
                    createCommentMutation.mutate({
                      locationId: selectedLocationId,
                      values: {
                        projectId: activeProjectId,
                        message: commentForm.message.trim(),
                      },
                    })
                  }}
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Custom Event</p>
              <div className="mt-3 space-y-3">
                <Field label="Title"><Input value={timelineForm.title ?? ''} onChange={event => setTimelineForm(current => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Event Type"><Select value={timelineForm.eventType ?? 'custom'} onChange={event => setTimelineForm(current => ({ ...current, eventType: event.target.value }))}><option value="custom">Custom</option><option value="location_created">Location Created</option><option value="recce_completed">Recce Completed</option><option value="permission_submitted">Permission Submitted</option><option value="permission_approved">Permission Approved</option><option value="shoot_started">Shoot Started</option><option value="shoot_completed">Shoot Completed</option><option value="status_changed">Status Changed</option><option value="upload_added">Upload Added</option><option value="document_uploaded">Document Uploaded</option></Select></Field>
                <Field label="Date & Time"><Input type="datetime-local" value={timelineForm.eventAt ?? ''} onChange={event => setTimelineForm(current => ({ ...current, eventAt: event.target.value }))} /></Field>
                <Field label="Description"><Textarea value={timelineForm.description ?? ''} onChange={event => setTimelineForm(current => ({ ...current, description: event.target.value }))} /></Field>
              </div>
              <div className="mt-4 flex justify-end">
                <ActionButton
                  label="Add Event"
                  icon="event"
                  loading={createTimelineMutation.isPending}
                  onClick={() => {
                    if (!selectedLocationId || !activeProjectId || !timelineForm.title.trim()) return
                    createTimelineMutation.mutate({
                      locationId: selectedLocationId,
                      values: {
                        projectId: activeProjectId,
                        title: timelineForm.title.trim(),
                        description: timelineForm.description?.trim() || undefined,
                        eventType: timelineForm.eventType,
                        eventAt: timelineForm.eventAt || undefined,
                      },
                    })
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Surface>
    )
  }

  const renderWorkspace = () => {
    if (selectedDetailQuery.isLoading) {
      return <PageLoader open message="Loading location workspace..." />
    }

    if (selectedDetailQuery.isError) {
      return <ErrorState message="Could not load this location." retry={() => selectedDetailQuery.refetch()} />
    }

    if (!selectedLocation) {
      return <EmptyState icon="map" title="Select a location" description="Use Details on any location row to open the workspace." />
    }

    return (
      <div className="space-y-6">
        <Surface variant="table" padding="lg" className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setSearchParams(params => {
                    params.delete('locationId')
                    params.delete('tab')
                    return params
                  })
                }}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back to locations
              </button>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-zinc-900 dark:text-white">{selectedLocation.name}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{selectedLocation.address}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={locationStatusVariant(selectedLocation.status)} label={labelize(selectedLocation.status)} />
              <StatusBadge variant={riskVariant(selectedLocation.riskLevel)} label={`${labelize(selectedLocation.riskLevel)} Risk`} />
              <ActionButton
                label="Edit"
                icon="edit"
                onClick={() => {
                  setEditingLocation(selectedLocation)
                  setLocationDraft({
                    projectId: selectedLocation.projectId,
                    name: selectedLocation.name,
                    address: selectedLocation.address,
                    latitude: selectedLocation.latitude ?? undefined,
                    longitude: selectedLocation.longitude ?? undefined,
                    locationType: selectedLocation.locationType,
                    shootStartDate: selectedLocation.shootStartDate ?? '',
                    shootEndDate: selectedLocation.shootEndDate ?? '',
                    riskLevel: selectedLocation.riskLevel,
                    status: selectedLocation.status,
                    notes: selectedLocation.notes ?? '',
                  })
                  setCreateMode('upload')
                  setCreateModalOpen(true)
                }}
              />
            </div>
          </div>

          <div className="mt-5 hidden gap-2 md:flex md:flex-wrap">
            {WORKSPACE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleWorkspaceTabSwitch(selectedLocation.id, tab.id)}
                disabled={switchingTab !== null}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  selectedTab === tab.id
                    ? 'bg-orange-50 text-orange-600 shadow-[0_10px_24px_rgba(249,115,22,0.14)] dark:bg-orange-500/12 dark:text-orange-400'
                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface)]'
                }`}
              >
                {switchingTab === tab.id ? <LoadingDots /> : <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5 md:hidden">
            <button
              type="button"
              onClick={() => setLocationTabSheetOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-left text-sm text-[color:var(--app-text)]"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined text-[18px]">{WORKSPACE_TABS.find(tab => tab.id === selectedTab)?.icon}</span>
                {WORKSPACE_TABS.find(tab => tab.id === selectedTab)?.mobileLabel}
              </span>
              <span className="material-symbols-outlined text-[18px] text-[color:var(--app-muted)]">keyboard_arrow_down</span>
            </button>
          </div>
          {switchingTab && (
            <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-muted)]">
              <LoadingDots />
              Switching section...
            </p>
          )}
        </Surface>

        {selectedTab === 'overview' && renderOverviewPanel()}
        {selectedTab === 'scouting' && renderScoutingPanel()}
        {selectedTab === 'permissions' && renderPermissionsPanel()}
        {selectedTab === 'amenities' && renderAmenitiesPanel()}
        {selectedTab === 'documents' && renderDocumentsPanel()}
        {selectedTab === 'timeline' && renderTimelinePanel()}
      </div>
    )
  }

  const renderLocationList = () => {
    if (locationsQuery.isLoading) {
      return <PageLoader open message="Loading locations..." />
    }

    if (locationsQuery.isError) {
      return <ErrorState message="Could not load locations." retry={() => locationsQuery.refetch()} />
    }

    if (locations.length === 0) {
      return (
        <Surface variant="table" padding="lg" className="mt-6">
          <EmptyState
            icon="map"
            title="No locations yet"
            description="Create the first recce location using capture or image upload."
          />
        </Surface>
      )
    }

    return (
      <div className="mt-6 space-y-3">
        {locations.map(location => (
          <Surface key={location.id} variant="table" padding="md" className="transition hover:border-zinc-400 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:hover:border-zinc-600">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">{location.name}</h3>
                  <StatusBadge variant={locationStatusVariant(location.status)} label={labelize(location.status)} />
                  <StatusBadge variant={riskVariant(location.riskLevel)} label={`${labelize(location.riskLevel)} Risk`} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{location.address}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge variant="stable" label={labelize(location.locationType)} />
                  <StatusBadge variant="stable" label={formatRange(location.shootStartDate, location.shootEndDate)} />
                  <StatusBadge variant="stable" label={`${location.metrics.mediaCount} media`} />
                  <StatusBadge variant="stable" label={`${location.metrics.documentCount} docs`} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ActionButton
                  label="Details"
                  icon="arrow_forward"
                  loading={switchingTab === 'overview' && selectedLocationId === location.id}
                  onClick={() => handleWorkspaceTabSwitch(location.id, 'overview')}
                />
                <ActionButton
                  label="Edit"
                  icon="edit"
                  onClick={() => {
                    setEditingLocation(location)
                    setLocationDraft({
                      projectId: location.projectId,
                      name: location.name,
                      address: location.address,
                      latitude: location.latitude ?? undefined,
                      longitude: location.longitude ?? undefined,
                      locationType: location.locationType,
                      shootStartDate: location.shootStartDate ?? '',
                      shootEndDate: location.shootEndDate ?? '',
                      riskLevel: location.riskLevel,
                      status: location.status,
                      notes: location.notes ?? '',
                    })
                    setCreateMode('upload')
                    setCreateModalOpen(true)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setDeleteTarget(location)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          </Surface>
        ))}

        {locationsQuery.data?.pagination && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              Page {locationsQuery.data.pagination.page} of {locationsQuery.data.pagination.totalPages}
            </p>
            <div className="flex gap-3">
              <ActionButton
                label="Previous"
                icon="chevron_left"
                disabled={locationPage <= 1}
                onClick={() => setLocationPage(current => Math.max(1, current - 1))}
              />
              <ActionButton
                label="Next"
                icon="chevron_right"
                disabled={locationPage >= locationsQuery.data.pagination.totalPages}
                onClick={() => setLocationPage(current => Math.min(locationsQuery.data!.pagination.totalPages, current + 1))}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleLocationCapture = async () => {
    if (!activeProjectId) return
    if (!navigator.geolocation) {
      setCaptureState('error')
      setCaptureMessage('This device does not support location services.')
      return
    }

    setCaptureState('fetching')
    setCaptureMessage('Reading GPS and resolving address...')

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const latitude = position.coords.latitude
          const longitude = position.coords.longitude
          setLocationDraft(current => ({
            ...current,
            latitude,
            longitude,
            address: current.address || '',
          }))
          const address = await locationsService.reverseGeocodeLocation(activeProjectId, latitude, longitude)
          setLocationDraft(current => ({
            ...current,
            latitude,
            longitude,
            address,
          }))
          setCaptureState('ready')
          setCaptureMessage('GPS and reverse geocode resolved.')
        } catch (error) {
          setCaptureState('error')
          setCaptureMessage(resolveErrorMessage(error, 'Could not resolve location.'))
        }
      },
      error => {
        setCaptureState('error')
        setCaptureMessage(error.message || 'Location permission is required.')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    if (createModalOpen && createMode === 'capture' && newLocationFile && captureState === 'idle') {
      void handleLocationCapture()
    }
  }, [createModalOpen, createMode, newLocationFile, captureState])

  useEffect(() => {
    if (!newLocationPreview) return
    return () => URL.revokeObjectURL(newLocationPreview)
  }, [newLocationPreview])

  if (isLoadingProjectContext) {
    return <PageLoader open message="Loading locations workspace..." />
  }

  if (isErrorProjectContext || !activeProjectId) {
    return <ErrorState message="Project context is unavailable." retry={() => window.location.reload()} />
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-muted)]">LOCATION</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[color:var(--app-text)]">LOCATION</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-muted)]">
              Enter the module and immediately see your location list. Open a workspace only when you need to manage scouting, permissions, amenities, documents, and timeline activity for one location.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              label="New Location"
              icon="add_location"
              onClick={() => {
                setEditingLocation(null)
                setCreateMode('menu')
                setCreateModalOpen(true)
                setLocationDraft(createDefaultLocationDraft(activeProjectId))
              }}
            />
          </div>
        </div>

        {!selectedLocationId && (
          <>
            {renderLocationList()}
          </>
        )}

        {selectedLocationId && renderWorkspace()}
      </div>

      <ModalShell
        open={createModalOpen}
        title={editingLocation ? 'Edit Location' : createMode === 'menu' ? 'Create New Location' : createMode === 'capture' ? 'Capture Location' : createMode === 'upload' ? 'Upload Image' : 'Drop Location'}
        description={
          editingLocation
            ? 'Update the location details without changing the existing media or security rules.'
            : createMode === 'menu'
              ? 'Choose the fastest production workflow for this location.'
              : createMode === 'capture'
                ? 'Use the phone camera, then auto-fill GPS and reverse geocode details.'
                : createMode === 'upload'
                  ? 'Upload an image first, then select the exact location from intelligent Mapbox suggestions.'
                  : 'Paste a Google Maps link, Mapbox URL, coordinates, or plain address and let ProdSync resolve it automatically.'
        }
        onClose={() => {
          setCreateModalOpen(false)
          setCreateMode('menu')
          setEditingLocation(null)
          setNewLocationFile(null)
          setNewLocationSearch('')
          setDropLocationInput('')
          setDropInputMode('typing')
          setDropLocationResolution(null)
          setDropResolutionState('idle')
          setDropResolutionMessage('')
          setCaptureState('idle')
          setCaptureMessage('')
          setNewLocationPreview('')
          setUploadPermissionId('')
          setDocumentUploadFile(null)
          setMediaUploadFile(null)
        }}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ActionButton
              label="Close"
              icon="close"
              onClick={() => {
                setCreateModalOpen(false)
                setCreateMode('menu')
                setEditingLocation(null)
                setNewLocationFile(null)
                setNewLocationSearch('')
                setDropLocationInput('')
                setDropInputMode('typing')
                setDropLocationResolution(null)
                setDropResolutionState('idle')
                setDropResolutionMessage('')
                setCaptureState('idle')
                setCaptureMessage('')
              }}
            />
            {editingLocation ? (
              <ActionButton
                label="Save Changes"
                icon="save"
                loading={updateLocationMutation.isPending}
                onClick={() => {
                  if (!editingLocation) return
                  updateLocationMutation.mutate({ id: editingLocation.id, values: { ...locationDraft, projectId: editingLocation.projectId } })
                }}
              />
            ) : createMode !== 'menu' && (
              <ActionButton
                label="Save Location"
                icon="save"
                loading={createLocationMutation.isPending}
                onClick={() => {
                  const projectStartDate = activeProject?.startDate ?? null
                  const projectEndDate = activeProject?.endDate ?? null

                  if (!locationDraft.name.trim()) {
                    showError('Please fill the required fields before saving the location.')
                    return
                  }

                  if (createMode === 'upload' && (!newLocationSearch.trim() || !locationDraft.address.trim())) {
                    showError('Pick a location suggestion before saving.')
                    return
                  }

                  if (createMode === 'capture' && (!locationDraft.address.trim() || locationDraft.latitude == null || locationDraft.longitude == null)) {
                    showError('Wait for GPS and reverse geocode to complete.')
                    return
                  }

                  if (createMode === 'drop' && !dropLocationInput.trim()) {
                    showError('Please paste a supported location link or address.')
                    return
                  }

                  if (!isWithinProjectRange(locationDraft.shootStartDate ?? null, projectStartDate, projectEndDate) || !isWithinProjectRange(locationDraft.shootEndDate ?? null, projectStartDate, projectEndDate)) {
                    showError(`Shoot dates must stay within ${formatRange(projectStartDate, projectEndDate)}.`)
                    return
                  }

                  if (createMode === 'drop' && dropResolutionState === 'resolving') {
                    showError('Please wait for the location to finish resolving.')
                    return
                  }

                  if (createMode === 'drop' && (!locationDraft.address.trim() || locationDraft.latitude == null || locationDraft.longitude == null)) {
                    showError(dropResolutionState === 'error' ? dropResolutionMessage || 'Could not resolve the location input.' : 'Could not resolve the location input.')
                    return
                  }

                  createLocationMutation.mutate({
                    values: {
                      ...locationDraft,
                      projectId: activeProjectId,
                      name: locationDraft.name.trim(),
                      address: locationDraft.address.trim(),
                      shootStartDate: locationDraft.shootStartDate || undefined,
                      shootEndDate: locationDraft.shootEndDate || undefined,
                      notes: locationDraft.notes?.trim() || undefined,
                    },
                    imageFile: newLocationFile,
                    imageLatitude: locationDraft.latitude,
                    imageLongitude: locationDraft.longitude,
                    imageNotes: locationDraft.notes?.trim() || undefined,
                  })
                }}
              />
            )}
          </div>
        }
      >
        {editingLocation ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Location Label / Name" required><Input value={locationDraft.name} onChange={event => setLocationDraft(current => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Location Type" required><Select value={locationDraft.locationType} onChange={event => setLocationDraft(current => ({ ...current, locationType: event.target.value as LocationType }))}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}</Select></Field>
              <Field label="Risk Level" required><Select value={locationDraft.riskLevel} onChange={event => setLocationDraft(current => ({ ...current, riskLevel: event.target.value as LocationRiskLevel }))}>{RISK_LEVELS.map(level => <option key={level} value={level}>{labelize(level)}</option>)}</Select></Field>
              <Field label="Status" required><Select value={locationDraft.status} onChange={event => setLocationDraft(current => ({ ...current, status: event.target.value as LocationStatus }))}><option value="draft">Draft</option><option value="recce_complete">Recce Complete</option><option value="permissions_pending">Permissions Pending</option><option value="shoot_ready">Shoot Ready</option><option value="completed">Completed</option></Select></Field>
              <Field label="Shoot Start Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootStartDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootStartDate: event.target.value }))} /></Field>
              <Field label="Shoot End Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootEndDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootEndDate: event.target.value }))} /></Field>
            </div>
            <Field label="Address" required><Input value={locationDraft.address} onChange={event => setLocationDraft(current => ({ ...current, address: event.target.value }))} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Latitude"><Input value={locationDraft.latitude ?? ''} onChange={event => setLocationDraft(current => ({ ...current, latitude: event.target.value ? Number(event.target.value) : undefined }))} /></Field>
              <Field label="Longitude"><Input value={locationDraft.longitude ?? ''} onChange={event => setLocationDraft(current => ({ ...current, longitude: event.target.value ? Number(event.target.value) : undefined }))} /></Field>
            </div>
            <Field label="Notes"><Textarea value={locationDraft.notes ?? ''} onChange={event => setLocationDraft(current => ({ ...current, notes: event.target.value }))} /></Field>
          </div>
        ) : createMode === 'menu' ? (
          <div className="grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setCreateMode('capture')
                setNewLocationFile(null)
                setCaptureState('idle')
                setCaptureMessage('')
                locationFileInputRef.current?.click()
              }}
              className="group rounded-[30px] border border-zinc-200 bg-zinc-50 p-6 text-left transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <span className="material-symbols-outlined text-[28px]">photo_camera</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">Capture Location</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Use the native camera, auto-resolve GPS, and create a location in under 15 seconds.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMode('upload')
                setNewLocationFile(null)
                setNewLocationSearch('')
                locationFileInputRef.current?.click()
              }}
              className="group rounded-[30px] border border-zinc-200 bg-zinc-50 p-6 text-left transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <span className="material-symbols-outlined text-[28px]">upload_file</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">Upload Image</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Upload an image, search for the location, and store exact coordinates with Mapbox suggestions.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMode('drop')
                setNewLocationFile(null)
                setNewLocationSearch('')
                setDropLocationInput('')
                setDropInputMode('typing')
                setDropLocationResolution(null)
                setDropResolutionState('idle')
                setDropResolutionMessage('')
              }}
              className="group rounded-[30px] border border-zinc-200 bg-zinc-50 p-6 text-left transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <span className="material-symbols-outlined text-[28px]">pin_drop</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">Drop Location</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Paste a Google Maps link, Mapbox URL, coordinates, or address text. ProdSync resolves the location for you.</p>
            </button>
          </div>
        ) : createMode === 'capture' ? (
          <div className="space-y-5">
            <input
              ref={locationFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0] ?? null
                if (!file) return
                setNewLocationFile(file)
                setCaptureState('idle')
              }}
            />
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                {newLocationPreview ? (
                  <div className="overflow-hidden rounded-[28px] border border-zinc-200 dark:border-zinc-800">
                    <img src={newLocationPreview} alt="Captured location preview" className="h-[320px] w-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/70">
                    <EmptyState icon="photo_camera" title="Capture your first image" description="The phone camera opens directly with retake support." />
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                    <ActionButton label="Retake" icon="cameraswitch" disabled={createLocationMutation.isPending || updateLocationMutation.isPending} onClick={() => locationFileInputRef.current?.click()} />
                  <ActionButton
                    label="Reset"
                    icon="refresh"
                    onClick={() => {
                      setNewLocationFile(null)
                      setNewLocationPreview('')
                      setCaptureState('idle')
                      setCaptureMessage('')
                      setLocationDraft(current => ({ ...current, address: '', latitude: undefined, longitude: undefined }))
                      locationFileInputRef.current?.click()
                    }}
                  />
                </div>
                <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <p className="font-semibold text-zinc-900 dark:text-white">Capture Status</p>
                  <p className="mt-2">{captureMessage || 'Waiting for GPS and reverse geocode.'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Location Label / Name" required><Input value={locationDraft.name} onChange={event => setLocationDraft(current => ({ ...current, name: event.target.value }))} /></Field>
                  <Field label="Location Type" required><Select value={locationDraft.locationType} onChange={event => setLocationDraft(current => ({ ...current, locationType: event.target.value as LocationType }))}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}</Select></Field>
                  <Field label="Risk Level" required><Select value={locationDraft.riskLevel} onChange={event => setLocationDraft(current => ({ ...current, riskLevel: event.target.value as LocationRiskLevel }))}>{RISK_LEVELS.map(level => <option key={level} value={level}>{labelize(level)}</option>)}</Select></Field>
                  <Field label="Shoot Start Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootStartDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootStartDate: event.target.value }))} /></Field>
                  <Field label="Shoot End Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootEndDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootEndDate: event.target.value }))} /></Field>
                  <Field label="Status" required><Select value={locationDraft.status} onChange={event => setLocationDraft(current => ({ ...current, status: event.target.value as LocationStatus }))}><option value="draft">Draft</option><option value="recce_complete">Recce Complete</option><option value="permissions_pending">Permissions Pending</option><option value="shoot_ready">Shoot Ready</option><option value="completed">Completed</option></Select></Field>
                </div>
                <Field label="Resolved Address" required><Input value={locationDraft.address} readOnly /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Latitude"><Input value={locationDraft.latitude ?? ''} readOnly /></Field>
                  <Field label="Longitude"><Input value={locationDraft.longitude ?? ''} readOnly /></Field>
                </div>
                <Field label="Notes"><Textarea value={locationDraft.notes ?? ''} onChange={event => setLocationDraft(current => ({ ...current, notes: event.target.value }))} /></Field>
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {captureState === 'fetching' ? 'Resolving GPS now...' : 'Camera capture only. No manual coordinates needed.'}
            </p>
          </div>
        ) : createMode === 'upload' ? (
          <div className="space-y-5">
            <input
              ref={locationFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0] ?? null
                if (!file) return
                setNewLocationFile(file)
                setLocationDraft(current => ({ ...current, address: current.address }))
              }}
            />
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                {newLocationPreview ? (
                  <div className="overflow-hidden rounded-[28px] border border-zinc-200 dark:border-zinc-800">
                    <img src={newLocationPreview} alt="Uploaded location preview" className="h-[320px] w-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/70">
                    <EmptyState icon="upload_file" title="Upload an image" description="Upload the scouting image first, then pick the exact place from intelligent search suggestions." />
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <ActionButton label="Choose Image" icon="upload" disabled={createLocationMutation.isPending || updateLocationMutation.isPending} onClick={() => locationFileInputRef.current?.click()} />
                  <ActionButton
                    label="Clear"
                    icon="close"
                    onClick={() => {
                      setNewLocationFile(null)
                      setNewLocationPreview('')
                      setNewLocationSearch('')
                      setLocationDraft(current => ({ ...current, address: '', latitude: undefined, longitude: undefined }))
                    }}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Location Search">
                  <LocationSearchField
                    projectId={activeProjectId}
                    value={newLocationSearch}
                    onChange={value => {
                      setNewLocationSearch(value)
                      if (value.trim().length === 0) {
                        setLocationDraft(current => ({ ...current, address: '', latitude: undefined, longitude: undefined }))
                      }
                    }}
                    onSelect={suggestion => {
                      setNewLocationSearch(suggestion.label)
                      setLocationDraft(current => ({
                        ...current,
                        address: suggestion.address,
                        latitude: suggestion.latitude,
                        longitude: suggestion.longitude,
                      }))
                    }}
                    placeholder="Search Chennai, Anna Nagar, or the exact street..."
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Location Label / Name"><Input value={locationDraft.name} onChange={event => setLocationDraft(current => ({ ...current, name: event.target.value }))} /></Field>
                  <Field label="Location Type"><Select value={locationDraft.locationType} onChange={event => setLocationDraft(current => ({ ...current, locationType: event.target.value as LocationType }))}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}</Select></Field>
                  <Field label="Risk Level"><Select value={locationDraft.riskLevel} onChange={event => setLocationDraft(current => ({ ...current, riskLevel: event.target.value as LocationRiskLevel }))}>{RISK_LEVELS.map(level => <option key={level} value={level}>{labelize(level)}</option>)}</Select></Field>
                  <Field label="Shoot Start Date"><Input type="date" value={locationDraft.shootStartDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootStartDate: event.target.value }))} /></Field>
                  <Field label="Shoot End Date"><Input type="date" value={locationDraft.shootEndDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootEndDate: event.target.value }))} /></Field>
                  <Field label="Status"><Select value={locationDraft.status} onChange={event => setLocationDraft(current => ({ ...current, status: event.target.value as LocationStatus }))}><option value="draft">Draft</option><option value="recce_complete">Recce Complete</option><option value="permissions_pending">Permissions Pending</option><option value="shoot_ready">Shoot Ready</option><option value="completed">Completed</option></Select></Field>
                </div>
                <Field label="Resolved Address"><Input value={locationDraft.address} readOnly /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Latitude"><Input value={locationDraft.latitude ?? ''} readOnly /></Field>
                  <Field label="Longitude"><Input value={locationDraft.longitude ?? ''} readOnly /></Field>
                </div>
                <Field label="Notes"><Textarea value={locationDraft.notes ?? ''} onChange={event => setLocationDraft(current => ({ ...current, notes: event.target.value }))} /></Field>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                {dropLocationResolution?.latitude != null && dropLocationResolution?.longitude != null ? (
                  <LocationPreviewMap
                    latitude={dropLocationResolution.latitude}
                    longitude={dropLocationResolution.longitude}
                    name={locationDraft.name || 'Drop location'}
                    address={locationDraft.address || dropLocationResolution.address}
                  />
                ) : (
                  <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/70">
                    <EmptyState icon="pin_drop" title="Paste a location link" description="Google Maps, Mapbox, coordinates, or plain address text will be resolved automatically." />
                  </div>
                )}
                <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <p className="font-semibold text-zinc-900 dark:text-white">Resolution Status</p>
                  <p className="mt-2">{dropResolutionMessage || 'Waiting for pasted location data.'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Paste Maps Link or Address" required>
                  <Textarea
                    rows={5}
                    value={dropLocationInput}
                    onChange={event => {
                      setDropInputMode('typing')
                      setDropLocationInput(event.target.value)
                      setDropResolutionState('idle')
                      setDropResolutionMessage('')
                    }}
                    onPaste={event => {
                      event.preventDefault()
                      const pastedText = event.clipboardData.getData('text')
                      if (!pastedText.trim()) return
                      const target = event.currentTarget
                      const start = target.selectionStart ?? target.value.length
                      const end = target.selectionEnd ?? start
                      const nextValue = `${target.value.slice(0, start)}${pastedText}${target.value.slice(end)}`
                      setDropInputMode('paste')
                      setDropLocationInput(nextValue)
                      setDropResolutionState('idle')
                      setDropResolutionMessage('')
                    }}
                    placeholder="https://maps.app.goo.gl/... or 12.9716, 77.5946 or full address"
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Location Label / Name" required><Input value={locationDraft.name} onChange={event => setLocationDraft(current => ({ ...current, name: event.target.value }))} /></Field>
                  <Field label="Location Type" required><Select value={locationDraft.locationType} onChange={event => setLocationDraft(current => ({ ...current, locationType: event.target.value as LocationType }))}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}</Select></Field>
                  <Field label="Risk Level" required><Select value={locationDraft.riskLevel} onChange={event => setLocationDraft(current => ({ ...current, riskLevel: event.target.value as LocationRiskLevel }))}>{RISK_LEVELS.map(level => <option key={level} value={level}>{labelize(level)}</option>)}</Select></Field>
                  <Field label="Shoot Start Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootStartDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootStartDate: event.target.value }))} /></Field>
                  <Field label="Shoot End Date"><Input type="date" min={activeProject?.startDate ?? undefined} max={activeProject?.endDate ?? undefined} value={locationDraft.shootEndDate ?? ''} onChange={event => setLocationDraft(current => ({ ...current, shootEndDate: event.target.value }))} /></Field>
                  <Field label="Status" required><Select value={locationDraft.status} onChange={event => setLocationDraft(current => ({ ...current, status: event.target.value as LocationStatus }))}><option value="draft">Draft</option><option value="recce_complete">Recce Complete</option><option value="permissions_pending">Permissions Pending</option><option value="shoot_ready">Shoot Ready</option><option value="completed">Completed</option></Select></Field>
                </div>
                <Field label="Resolved Address" required><Input value={locationDraft.address} readOnly /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Latitude"><Input value={locationDraft.latitude ?? ''} readOnly /></Field>
                  <Field label="Longitude"><Input value={locationDraft.longitude ?? ''} readOnly /></Field>
                </div>
                <Field label="Notes"><Textarea value={locationDraft.notes ?? ''} onChange={event => setLocationDraft(current => ({ ...current, notes: event.target.value }))} /></Field>
              </div>
            </div>
          </div>
        )}
      </ModalShell>

      {mediaViewer && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[color:rgba(9,9,11,0.72)] px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6">
          <div className="flex h-full w-full flex-col overflow-hidden bg-[color:var(--app-bg)] shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:h-[min(92vh,980px)] sm:max-w-6xl sm:rounded-[32px]">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">Media Viewer</p>
                <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-text)]">{mediaViewer.item.originalName}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--app-muted)]">Use zoom, drag, print-safe download, and fullscreen viewing without leaving ProdSync.</p>
              </div>
              <div className="flex items-center gap-2">
                {mediaViewer.item.mediaKind === 'image' && (
                  <>
                    <ActionButton label="Zoom +" icon="zoom_in" onClick={() => updateMediaViewerScale((mediaViewer.scale ?? 1) + 0.25)} />
                    <ActionButton label="Zoom -" icon="zoom_out" onClick={() => updateMediaViewerScale((mediaViewer.scale ?? 1) - 0.25)} />
                    <ActionButton label="Reset" icon="restart_alt" onClick={resetMediaViewerPosition} />
                  </>
                )}
                <ActionButton label="Download" icon="download" onClick={() => downloadMediaFile(mediaViewer.item)} />
                <button
                  type="button"
                  onClick={closeMediaViewer}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-muted)] transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] border border-[color:var(--app-border)] bg-black">
                {mediaViewer.item.mediaKind === 'image' ? (
                  <div
                    className="relative h-full w-full overflow-hidden"
                    style={{ touchAction: 'none', cursor: mediaViewer.scale > 1 ? 'grab' : 'default' }}
                    onWheel={event => {
                      event.preventDefault()
                      updateMediaViewerScale((mediaViewer.scale ?? 1) + (event.deltaY > 0 ? -0.15 : 0.15))
                    }}
                    onPointerDown={startMediaDrag}
                    onPointerMove={moveMediaDrag}
                    onPointerUp={stopMediaDrag}
                    onPointerLeave={stopMediaDrag}
                    onPointerCancel={stopMediaDrag}
                  >
                    <img
                      src={mediaViewer.item.url}
                      alt={mediaViewer.item.originalName}
                      className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
                      style={{
                        transform: `translate(-50%, -50%) translate(${mediaViewer.offsetX}px, ${mediaViewer.offsetY}px) scale(${mediaViewer.scale})`,
                      }}
                      draggable={false}
                    />
                  </div>
                ) : (
                  <video
                    src={mediaViewer.item.url}
                    controls
                    className="h-full w-full bg-black object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalShell
        open={Boolean(deleteTarget)}
        title="Delete Location"
        description={deleteTarget ? `This will permanently delete ${deleteTarget.name} and all related location data from the current project workspace.` : undefined}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-xl"
        footer={
          <div className="flex justify-end gap-3">
            <ActionButton label="Cancel" icon="close" onClick={() => setDeleteTarget(null)} />
            <ActionButton
              label="Delete"
              icon="delete"
              tone="danger"
              loading={deleteLocationMutation.isPending}
              onClick={() => {
                if (!deleteTarget || !activeProjectId) return
                deleteLocationMutation.mutate({ projectId: activeProjectId, id: deleteTarget.id })
              }}
            />
          </div>
        }
      >
        {deleteTarget && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            Confirm deletion to keep the production workspace clean. This cannot be undone.
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(deletePrompt)}
        title={deletePrompt?.title ?? 'Confirm Action'}
        description={deletePrompt?.description}
        onClose={() => setDeletePrompt(null)}
        maxWidth="max-w-xl"
        footer={
          <div className="flex justify-end gap-3">
            <ActionButton label="Cancel" icon="close" onClick={() => setDeletePrompt(null)} />
            <ActionButton
              label={deletePrompt?.confirmLabel ?? 'Confirm'}
              icon="delete"
              tone="danger"
              onClick={() => {
                deletePrompt?.onConfirm()
                setDeletePrompt(null)
              }}
            />
          </div>
        }
      >
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          This action cannot be undone. Please confirm before continuing.
        </div>
      </ModalShell>
    </div>
  )
}
