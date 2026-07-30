import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState } from '@/components/system/SystemStates'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { LiquidGlassNavbar } from '@/components/shared/LiquidGlassNavbar'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'
import { resolveErrorMessage, showError, showSuccess } from '@/lib/toast'
import { accommodationService } from '@/services/accommodation.service'
import { formatDate, formatTime, timeAgo } from '@/utils'
import { useAccommodationData } from '../hooks/useAccommodationData'
import type {
  AccommodationAlert,
  AccommodationHotel,
  CreateAccommodationHotelInput,
  CreateHotelAllocationInput,
  HotelAllocation,
  UpdateAccommodationHotelInput,
  UpdateHotelAllocationInput,
} from '../types'

const todayDate = new Date().toISOString().slice(0, 10)

const allocationStatusOptions = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked-In' },
  { value: 'checked_out', label: 'Checked-Out' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

const departmentOptions = [
  { value: 'actors', label: 'Actors' },
  { value: 'production', label: 'Production' },
  { value: 'direction', label: 'Direction' },
  { value: 'camera', label: 'Camera' },
  { value: 'art', label: 'Art' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'transport', label: 'Transport' },
]

type AllocationFormState = {
  personName: string
  roleTitle: string
  department: string
  hotelName: string
  roomNumber: string
  checkInDate: string
  checkOutDate: string
  bookingStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  notes: string
}

type HotelFormState = {
  hotelName: string
  address: string
  city: string
  contactPerson: string
  contactNumber: string
}

type ConfirmState = {
  title: string
  message: string
  actionLabel: string
  action: () => Promise<void>
} | null

const emptyAllocationForm: AllocationFormState = {
  personName: '',
  roleTitle: '',
  department: 'actors',
  hotelName: '',
  roomNumber: '',
  checkInDate: todayDate,
  checkOutDate: todayDate,
  bookingStatus: 'confirmed',
  notes: '',
}

const emptyHotelForm: HotelFormState = {
  hotelName: '',
  address: '',
  city: '',
  contactPerson: '',
  contactNumber: '',
}

function bookingBadge(allocation: HotelAllocation) {
  const extended = allocation.notes?.toLowerCase().includes('extended stay') ?? false

  return (
    <div className="flex flex-wrap gap-2">
      {extended && <StatusBadge variant="warning" label="Extended" />}
      {allocation.bookingStatus === 'checked_in' && <StatusBadge variant="active" label="Checked-In" />}
      {allocation.bookingStatus === 'checked_out' && <StatusBadge variant="completed" label="Checked-Out" />}
      {allocation.bookingStatus === 'cancelled' && <StatusBadge variant="flagged" label="Cancelled" />}
      {allocation.bookingStatus === 'confirmed' && <StatusBadge variant="pending" label="Confirmed" />}
    </div>
  )
}

function alertBadge(alert: AccommodationAlert) {
  return alert.type === 'critical'
    ? <StatusBadge variant="flagged" label="Critical" />
    : <StatusBadge variant="warning" label="Warning" />
}

function ModalShell({
  open,
  title,
  kicker,
  description,
  isSubmitting,
  onClose,
  children,
  primaryLabel,
  onSubmit,
}: {
  open: boolean
  title: string
  kicker: string
  description: string
  isSubmitting: boolean
  onClose: () => void
  children: ReactNode
  primaryLabel: string
  onSubmit: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 sm:py-8 transition-opacity">
      <button type="button" aria-label="Close modal" className="absolute inset-0 w-full h-full bg-black/55 backdrop-blur-sm" onClick={onClose} disabled={isSubmitting} />
      <Surface variant="raised" padding="lg" className="relative z-10 flex max-h-[90vh] sm:max-h-[88vh] w-full max-w-2xl flex-col border border-zinc-200 shadow-2xl dark:border-zinc-800 rounded-t-[32px] rounded-b-none sm:rounded-[32px]">
        <div className="shrink-0 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">{kicker}</p>
              <h2 className="section-title mt-1">{title}</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
            </div>
            <button onClick={onClose} disabled={isSubmitting} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-muted)] transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 sm:pr-2 custom-scrollbar">{children}</div>
        <div className="shrink-0 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost w-full sm:w-auto justify-center">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={isSubmitting} className="btn-primary w-full sm:w-auto justify-center disabled:opacity-60">
            {isSubmitting ? 'Saving...' : primaryLabel}
          </button>
        </div>
      </Surface>
    </div>
  )
}

function ConfirmModal({
  open,
  title,
  message,
  actionLabel,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  actionLabel: string
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 sm:py-8 transition-opacity">
      <button type="button" aria-label="Close modal" className="absolute inset-0 w-full h-full bg-black/55 backdrop-blur-sm" onClick={onClose} disabled={isSubmitting} />
      <Surface variant="raised" padding="lg" className="relative z-10 w-full max-w-lg border border-zinc-200 shadow-2xl dark:border-zinc-800 rounded-t-[32px] rounded-b-none sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Confirmation</p>
            <h2 className="section-title mt-1">{title}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-muted)] transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost w-full sm:w-auto justify-center">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="btn-primary w-full sm:w-auto justify-center disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white">
            {isSubmitting ? 'Working...' : actionLabel}
          </button>
        </div>
      </Surface>
    </div>
  )
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  )
}

function ModalTextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: 'text' | 'date' | 'tel'
  readOnly?: boolean
}) {
  return (
    <div className="project-modal-input-shell">
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        readOnly={readOnly}
        className="project-modal-input"
      />
    </div>
  )
}

function ModalTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="project-modal-input-shell">
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="project-modal-input min-h-[112px] resize-none bg-transparent"
      />
    </div>
  )
}

function ModalSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  value: T | ''
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find(option => option.value === value)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen(current => !current)} className="project-modal-input-shell w-full text-left">
        <span className="flex w-full items-center justify-between gap-3">
          <span className="project-modal-input text-zinc-900 dark:text-white">{selectedOption?.label ?? placeholder}</span>
          <svg className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 rounded-[1.4rem] border border-zinc-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-1">
            {options.map(option => {
              const isSelected = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-orange-500/12 text-orange-600 dark:bg-orange-500/18 dark:text-orange-300'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-[28px] bg-zinc-100 dark:bg-zinc-900" />
}

function PanelHeader({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function SmallEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-200 px-6 text-center dark:border-zinc-800">
      <p className="text-base font-semibold text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function AccommodationView() {
  const queryClient = useQueryClient()
  const { activeProjectId, isLoadingProjectContext } = useResolvedProjectContext()
  const { hotels, allocations, reminders, travelSync, alerts, isLoading, isError, refetch } = useAccommodationData(activeProjectId)

  const [hotelModalOpen, setHotelModalOpen] = useState(false)
  const [hotelEditTarget, setHotelEditTarget] = useState<AccommodationHotel | null>(null)
  const [hotelForm, setHotelForm] = useState<HotelFormState>(emptyHotelForm)
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [allocationEditTarget, setAllocationEditTarget] = useState<HotelAllocation | null>(null)
  const [allocationForm, setAllocationForm] = useState<AllocationFormState>(emptyAllocationForm)
  const [extendTarget, setExtendTarget] = useState<HotelAllocation | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState(todayDate)
  const [extendNotes, setExtendNotes] = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [expandedAllocationId, setExpandedAllocationId] = useState<string | null>(null)
  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'hotels' | 'reminders' | 'transport' | 'alerts'>('home')

  const { navRef: bottomNavRef, companionRef: floatingActionsRef } = useMobileScrollHide()

  const refreshAccommodation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['accommodation-hotels'] }),
      queryClient.invalidateQueries({ queryKey: ['accommodation-allocations', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['accommodation-reminders', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['accommodation-travel-sync', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['accommodation-alerts', activeProjectId] }),
    ])
  }

  function closeHotelModal() {
    setHotelModalOpen(false)
    setHotelEditTarget(null)
    setHotelForm(emptyHotelForm)
  }

  function openCreateHotelModal() {
    setHotelEditTarget(null)
    setHotelForm(emptyHotelForm)
    setHotelModalOpen(true)
  }

  function openEditHotelModal(hotel: AccommodationHotel) {
    setHotelEditTarget(hotel)
    setHotelForm({
      hotelName: hotel.hotelName,
      address: hotel.address,
      city: hotel.city,
      contactPerson: hotel.contactPerson ?? '',
      contactNumber: hotel.contactNumber ?? '',
    })
    setHotelModalOpen(true)
  }

  function closeAllocationModal() {
    setAllocationModalOpen(false)
    setAllocationEditTarget(null)
    setAllocationForm(emptyAllocationForm)
  }

  function openCreateAllocationModal() {
    setAllocationEditTarget(null)
    setAllocationForm({
      ...emptyAllocationForm,
      hotelName: hotels[0]?.hotelName ?? '',
    })
    setAllocationModalOpen(true)
  }

  function openEditAllocationModal(allocation: HotelAllocation) {
    setAllocationEditTarget(allocation)
    setAllocationForm({
      personName: allocation.personName,
      roleTitle: allocation.roleTitle ?? '',
      department: allocation.department ?? 'actors',
      hotelName: allocation.hotelName,
      roomNumber: allocation.roomNumber,
      checkInDate: allocation.checkInDate,
      checkOutDate: allocation.checkOutDate,
      bookingStatus: allocation.bookingStatus,
      notes: allocation.notes ?? '',
    })
    setAllocationModalOpen(true)
  }

  function closeExtendModal() {
    setExtendTarget(null)
    setExtendCheckoutDate(todayDate)
    setExtendNotes('')
  }

  function openExtendModal(allocation: HotelAllocation) {
    setExtendTarget(allocation)
    setExtendCheckoutDate(allocation.checkOutDate)
    setExtendNotes('')
  }

  const createHotelMutation = useMutation({
    mutationFn: (input: CreateAccommodationHotelInput) => accommodationService.createHotel(input),
    onSuccess: async () => {
      showSuccess('Hotel added successfully.')
      await refreshAccommodation()
      closeHotelModal()
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not add hotel.')),
  })

  const updateHotelMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccommodationHotelInput }) => accommodationService.updateHotel(id, input),
    onSuccess: async () => {
      showSuccess('Hotel updated successfully.')
      await refreshAccommodation()
      closeHotelModal()
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not update hotel.')),
  })

  const createAllocationMutation = useMutation({
    mutationFn: (input: CreateHotelAllocationInput) => accommodationService.createAllocation(input),
    onSuccess: async () => {
      showSuccess('Allocation created successfully.')
      await refreshAccommodation()
      closeAllocationModal()
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not create allocation.')),
  })

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHotelAllocationInput }) => accommodationService.updateAllocation(id, input),
    onSuccess: async () => {
      showSuccess('Allocation updated successfully.')
      await refreshAccommodation()
      closeAllocationModal()
      closeExtendModal()
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not update allocation.')),
  })

  const deleteAllocationMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => accommodationService.deleteAllocation(projectId, id),
    onSuccess: async () => {
      showSuccess('Allocation removed successfully.')
      await refreshAccommodation()
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not remove allocation.')),
  })

  const allocationConflict = useMemo(() => {
    if (!allocationForm.hotelName || !allocationForm.roomNumber || !allocationForm.checkInDate || !allocationForm.checkOutDate) {
      return null
    }

    const conflicting = allocations.find(item => item.id !== allocationEditTarget?.id
      && item.hotelName.trim().toLowerCase() === allocationForm.hotelName.trim().toLowerCase()
      && item.roomNumber.trim().toLowerCase() === allocationForm.roomNumber.trim().toLowerCase()
      && ['confirmed', 'checked_in'].includes(item.bookingStatus)
      && allocationForm.checkInDate <= item.checkOutDate
      && item.checkInDate <= allocationForm.checkOutDate)

    if (!conflicting) {
      return null
    }

    return `${conflicting.personName} already has this room for overlapping dates.`
  }, [allocationForm, allocations, allocationEditTarget])

  const derivedAlerts = useMemo(() => {
    const items = [...alerts]

    allocations.forEach(allocation => {
      if ((allocation.bookingStatus === 'confirmed' || allocation.bookingStatus === 'checked_in') && allocation.checkOutDate < todayDate) {
        items.push({
          type: 'critical' as const,
          message: `Potential Extra Day Charge: ${allocation.personName} is still active past ${allocation.checkOutDate}.`,
          timestamp: allocation.updatedAt,
        })
      }
    })

    return items.sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 20)
  }, [alerts, allocations])

  const upcomingReminders = useMemo(() => {
    const reminderRows = reminders.map(item => ({
      key: item.id,
      title: item.reminderType === 'checkin' ? 'Upcoming check-in' : 'Upcoming check-out',
      timestamp: item.reminderTime,
      meta: item.status,
      variant: item.reminderType === 'checkout' ? 'warning' : 'pending',
    }))

    const extendedRows = allocations
      .filter(item => item.notes?.toLowerCase().includes('extended stay'))
      .map(item => ({
        key: `extended-${item.id}`,
        title: `${item.personName} stay extended`,
        timestamp: item.updatedAt,
        meta: item.checkOutDate,
        variant: 'warning',
      }))

    return [...reminderRows, ...extendedRows]
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .slice(0, 8)
  }, [reminders, allocations])

  const isPageEmpty = hotels.length === 0 && allocations.length === 0 && reminders.length === 0 && travelSync.length === 0 && derivedAlerts.length === 0
  const hotelOptions = hotels.map(item => ({ value: item.hotelName, label: item.hotelName }))

  async function quickStatusUpdate(allocation: HotelAllocation, status: 'checked_in' | 'checked_out') {
    if (!activeProjectId) return

    try {
      await updateAllocationMutation.mutateAsync({
        id: allocation.id,
        input: {
          projectId: activeProjectId,
          bookingStatus: status,
        },
      })
      showSuccess(status === 'checked_in' ? 'Guest marked as checked-in.' : 'Guest marked as checked-out.')
    } catch {}
  }

  function handleHotelSubmit() {
    const payload = {
      projectId: activeProjectId ?? undefined,
      hotelName: hotelForm.hotelName.trim(),
      address: hotelForm.address.trim(),
      city: hotelForm.city.trim(),
      contactPerson: hotelForm.contactPerson.trim(),
      contactNumber: hotelForm.contactNumber.trim(),
    }

    if (!payload.hotelName || !payload.address || !payload.city) {
      showError('Hotel name, address, and city are required.')
      return
    }

    if (hotelEditTarget) {
      void updateHotelMutation.mutate({ id: hotelEditTarget.id, input: payload })
      return
    }

    void createHotelMutation.mutate(payload)
  }

  function handleAllocationSubmit() {
    if (!activeProjectId) return

    const payload = {
      projectId: activeProjectId,
      personName: allocationForm.personName.trim(),
      roleTitle: allocationForm.roleTitle.trim(),
      department: allocationForm.department.trim(),
      hotelName: allocationForm.hotelName.trim(),
      roomNumber: allocationForm.roomNumber.trim(),
      checkInDate: allocationForm.checkInDate,
      checkOutDate: allocationForm.checkOutDate,
      bookingStatus: allocationForm.bookingStatus,
      notes: allocationForm.notes.trim(),
    }

    if (!payload.personName || !payload.hotelName || !payload.roomNumber) {
      showError('Person name, hotel, and room number are required.')
      return
    }

    if (payload.checkOutDate < payload.checkInDate) {
      showError('Check-out date cannot be earlier than check-in date.')
      return
    }

    if (allocationConflict) {
      showError(allocationConflict)
      return
    }

    if (allocationEditTarget) {
      void updateAllocationMutation.mutate({ id: allocationEditTarget.id, input: payload })
      return
    }

    void createAllocationMutation.mutate(payload)
  }

  function handleExtendSubmit() {
    if (!activeProjectId || !extendTarget) return

    if (extendCheckoutDate < extendTarget.checkInDate) {
      showError('Extended checkout cannot be earlier than check-in date.')
      return
    }

    const mergedNotes = [extendTarget.notes, 'Extended stay', extendNotes.trim()].filter(Boolean).join(' • ')

    void updateAllocationMutation.mutate({
      id: extendTarget.id,
      input: {
        projectId: activeProjectId,
        checkOutDate: extendCheckoutDate,
        notes: mergedNotes,
        bookingStatus: extendTarget.bookingStatus === 'cancelled' ? 'confirmed' : extendTarget.bookingStatus,
      },
    })
  }

  async function runConfirmAction() {
    if (!confirmState) return

    setConfirmBusy(true)
    try {
      await confirmState.action()
      setConfirmState(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const allocationColumns = [
    {
      key: 'personName',
      label: 'Person Name',
      render: (row: HotelAllocation) => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-white">{row.personName}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.department ?? 'No department'}</div>
        </div>
      ),
    },
    { key: 'roleTitle', label: 'Role', render: (row: HotelAllocation) => row.roleTitle ?? '—' },
    {
      key: 'hotelName',
      label: 'Hotel',
      render: (row: HotelAllocation) => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-white">{row.hotelName}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Room {row.roomNumber}</div>
        </div>
      ),
    },
    { key: 'checkInDate', label: 'Check-In', render: (row: HotelAllocation) => formatDate(row.checkInDate) },
    {
      key: 'checkOutDate',
      label: 'Check-Out',
      render: (row: HotelAllocation) => (
        <div>
          <div>{formatDate(row.checkOutDate)}</div>
          {row.checkOutDate < todayDate && (row.bookingStatus === 'confirmed' || row.bookingStatus === 'checked_in') ? (
            <div className="mt-1 text-[11px] font-medium text-red-500 dark:text-red-400">Potential Extra Day Charge</div>
          ) : null}
        </div>
      ),
    },
    { key: 'bookingStatus', label: 'Booking Status', render: (row: HotelAllocation) => bookingBadge(row) },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[260px]',
      render: (row: HotelAllocation) => (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openEditAllocationModal(row)} className="btn-ghost px-3 py-2 text-[10px]" type="button">
            Edit
          </button>
          <button
            onClick={() => setConfirmState({
              title: 'Delete allocation',
              message: `Remove ${row.personName} from the accommodation matrix?`,
              actionLabel: 'Delete',
              action: async () => {
                if (!activeProjectId) return
                await deleteAllocationMutation.mutateAsync({ projectId: activeProjectId, id: row.id })
              },
            })}
            className="btn-ghost px-3 py-2 text-[10px] text-red-500 dark:text-red-400"
            type="button"
          >
            Delete
          </button>
          <button onClick={() => void quickStatusUpdate(row, 'checked_in')} disabled={row.bookingStatus === 'checked_in'} className="btn-soft px-3 py-2 text-[10px] disabled:opacity-50" type="button">
            Mark Checked-In
          </button>
          <button onClick={() => void quickStatusUpdate(row, 'checked_out')} disabled={row.bookingStatus === 'checked_out'} className="btn-soft px-3 py-2 text-[10px] disabled:opacity-50" type="button">
            Mark Checked-Out
          </button>
          <button onClick={() => openExtendModal(row)} className="btn-primary px-3 py-2 text-[10px]" type="button">
            Extend Stay
          </button>
        </div>
      ),
    },
  ]

  if (isLoadingProjectContext) {
    return (
      <div className="page-shell space-y-6">
        <SkeletonCard />
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!activeProjectId) {
    return (
      <div className="page-shell">
        <EmptyState icon="hotel" title="No active project selected" description="Choose a project to access accommodation and travel operations." />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page-shell">
        <ErrorState message="Unable to load accommodation data." retry={() => { void refetch() }} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-shell space-y-6 pb-56 md:pb-0">
        <Surface variant="table" padding="lg" className="hidden md:block">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker">Operations</p>
              <h1 className="section-title">Accommodation & Travel</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Manage hotels, room allocations, reminders, status updates, and transport pickup syncing from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={openCreateHotelModal} className="btn-soft" type="button">
                Add Hotel
              </button>
              <button onClick={openCreateAllocationModal} className="btn-primary" type="button">
                Add Allocation
              </button>
            </div>
          </div>
        </Surface>

        <div className="md:hidden w-full relative z-10 pt-2 pb-2">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
            <span className="page-kicker text-orange-500">OPERATIONS</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Accommodation & Travel</h1>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
              Manage hotels, room allocations, reminders, status updates, and transport pickup syncing from one workspace.
            </p>
          </div>
        </div>

        {/* Mobile Bottom Sticky Actions */}
        <div ref={floatingActionsRef} className="fixed bottom-[88px] left-1/2 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 z-40 md:hidden bg-[#111111] border border-[#222222] rounded-[32px] p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-transform duration-300">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={openCreateAllocationModal} className="flex flex-col items-center justify-center rounded-[24px] bg-orange-500 py-3 font-bold text-zinc-950 transition active:scale-95" type="button">
              <span className="material-symbols-outlined text-[24px]">hotel_class</span>
              <span className="mt-1 text-[10px] uppercase tracking-wider">Add Allocation</span>
            </button>
            <button onClick={openCreateHotelModal} className="flex flex-col items-center justify-center rounded-[24px] border border-zinc-700 py-3 font-bold text-orange-500 transition active:scale-95" type="button">
              <span className="material-symbols-outlined text-[24px]">domain_add</span>
              <span className="mt-1 text-[10px] uppercase tracking-wider">Add Hotel</span>
            </button>
          </div>
        </div>

        {isPageEmpty ? (
          <Surface variant="table" padding="lg" className="min-h-[420px]">
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <div className="flex h-18 w-18 items-center justify-center rounded-[28px] bg-orange-500/12 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400">
                <span className="material-symbols-outlined text-4xl">travel</span>
              </div>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">No accommodation records yet</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-500 dark:text-zinc-400">
                Turn this workspace into your live stay-management board by adding hotels and room allocations for cast and HOD travel.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button onClick={openCreateAllocationModal} className="btn-primary" type="button">
                  Add Allocation
                </button>
                <button onClick={openCreateHotelModal} className="btn-soft" type="button">
                  Add Hotel
                </button>
              </div>
            </div>
          </Surface>
        ) : (
          <>
            <div className={`gap-6 xl:grid-cols-[1.7fr_1fr] ${activeMobileTab === 'home' || activeMobileTab === 'hotels' ? 'grid' : 'hidden md:grid'}`}>
              <Surface variant="table" padding="none" className={`overflow-hidden ${activeMobileTab === 'home' ? '' : 'hidden md:block'}`}>
                <div className="p-6 sm:p-7">
                  <PanelHeader
                    kicker="Core Feature"
                    title="Room Allocation Matrix"
                    action={<button onClick={openCreateAllocationModal} className="btn-primary text-[11px]" type="button">+ Add Allocation</button>}
                  />
                </div>
                {allocations.length === 0 ? (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                    <SmallEmpty
                      title="No room allocations"
                      description="Start by assigning actors and HODs to hotel rooms."
                      action={<button onClick={openCreateAllocationModal} className="btn-primary" type="button">Add Allocation</button>}
                    />
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <DataTable columns={allocationColumns} data={allocations} getKey={row => row.id} />
                    </div>
                    <div className="md:hidden flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
                      {allocations.map(allocation => {
                        const isExpanded = expandedAllocationId === allocation.id
                        return (
                          <div key={allocation.id} className="p-4 flex flex-col bg-white dark:bg-zinc-950 transition-colors">
                            <div className="flex items-start justify-between gap-3 cursor-pointer select-none" onClick={() => setExpandedAllocationId(isExpanded ? null : allocation.id)}>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900 dark:text-white">{allocation.personName}</p>
                                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{allocation.department ?? 'No department'} · {allocation.roleTitle ?? 'No role'}</p>
                                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                  <span className="font-medium text-zinc-900 dark:text-white">{allocation.hotelName}</span> — Room {allocation.roomNumber}
                                </div>
                              </div>
                              <div className="flex flex-col items-end shrink-0 gap-2">
                                {bookingBadge(allocation)}
                                <span className="material-symbols-outlined text-zinc-400 text-xl transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Check-in</p>
                                    <p className="mt-1 font-medium text-zinc-900 dark:text-white">{formatDate(allocation.checkInDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Check-out</p>
                                    <p className="mt-1 font-medium text-zinc-900 dark:text-white">{formatDate(allocation.checkOutDate)}</p>
                                    {allocation.checkOutDate < todayDate && (allocation.bookingStatus === 'confirmed' || allocation.bookingStatus === 'checked_in') && (
                                      <p className="mt-1 text-[10px] font-medium text-red-500">Extra Day Charge</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => openEditAllocationModal(allocation)} className="btn-ghost px-3 py-2 text-[10px] flex-1 text-center justify-center" type="button">Edit</button>
                                  <button
                                    onClick={() => setConfirmState({
                                      title: 'Delete allocation',
                                      message: `Remove ${allocation.personName} from the accommodation matrix?`,
                                      actionLabel: 'Delete',
                                      action: async () => {
                                        if (!activeProjectId) return
                                        await deleteAllocationMutation.mutateAsync({ projectId: activeProjectId, id: allocation.id })
                                      },
                                    })}
                                    className="btn-ghost px-3 py-2 text-[10px] text-red-500 dark:text-red-400 flex-1 text-center justify-center" type="button"
                                  >
                                    Delete
                                  </button>
                                  <button onClick={() => void quickStatusUpdate(allocation, 'checked_in')} disabled={allocation.bookingStatus === 'checked_in'} className="btn-soft px-3 py-2 text-[10px] disabled:opacity-50 flex-1 text-center justify-center" type="button">
                                    Check In
                                  </button>
                                  <button onClick={() => void quickStatusUpdate(allocation, 'checked_out')} disabled={allocation.bookingStatus === 'checked_out'} className="btn-soft px-3 py-2 text-[10px] disabled:opacity-50 flex-1 text-center justify-center" type="button">
                                    Check Out
                                  </button>
                                  <button onClick={() => openExtendModal(allocation)} className="btn-primary px-3 py-2 text-[10px] w-full text-center justify-center mt-1" type="button">
                                    Extend Stay
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </Surface>

              <Surface variant="table" padding="lg" className={`h-full ${activeMobileTab === 'home' || activeMobileTab === 'hotels' ? '' : 'hidden md:block'}`}>
                <PanelHeader
                  kicker="Directory"
                  title="Hotel Management"
                  action={<button onClick={openCreateHotelModal} className="btn-soft px-3 py-2 text-[10px]" type="button">Add Hotel</button>}
                />
                {hotels.length === 0 ? (
                  <SmallEmpty
                    title="No hotels configured"
                    description="Create your hotel directory so allocations and pickup addresses can sync automatically."
                    action={<button onClick={openCreateHotelModal} className="btn-primary" type="button">Add Hotel</button>}
                  />
                ) : (
                  <div className="space-y-3">
                    {hotels.map(hotel => (
                      <div key={hotel.id} className="rounded-[22px] border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-zinc-900 dark:text-white">{hotel.hotelName}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hotel.address}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hotel.city}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                              {hotel.contactPerson ?? hotel.contactNumber ?? 'No contact listed'}
                            </p>
                          </div>
                          <button onClick={() => openEditHotelModal(hotel)} className="btn-ghost px-3 py-2 text-[10px]" type="button">
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </div>

            <div className={`gap-6 xl:grid-cols-3 ${activeMobileTab !== 'hotels' ? 'grid' : 'hidden md:grid'}`}>
              <Surface variant="table" padding="lg" className={activeMobileTab === 'home' || activeMobileTab === 'reminders' ? '' : 'hidden md:block'}>
                <PanelHeader kicker="Automation" title="Upcoming Reminders" />
                {upcomingReminders.length === 0 ? (
                  <SmallEmpty title="No reminders scheduled" description="Check-in, check-out, and extension reminders will appear here automatically." />
                ) : (
                  <div className="space-y-3">
                    {upcomingReminders.map(item => (
                      <div key={item.key} className="rounded-[22px] border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(item.timestamp)} · {formatTime(item.timestamp)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{item.meta}</p>
                          </div>
                          <StatusBadge variant={item.variant === 'warning' ? 'warning' : 'pending'} label={item.variant === 'warning' ? 'Attention' : 'Upcoming'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              <Surface variant="table" padding="lg" className={activeMobileTab === 'home' || activeMobileTab === 'transport' ? '' : 'hidden md:block'}>
                <PanelHeader kicker="Transport" title="Travel Sync Queue" />
                {travelSync.length === 0 ? (
                  <SmallEmpty title="No travel sync rows" description="As soon as active stays exist, hotel pickup addresses will flow here for transport coordination." />
                ) : (
                  <div className="space-y-3">
                    {travelSync.map(item => (
                      <div key={`${item.person_name}-${item.hotel_name}`} className="rounded-[22px] border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.person_name}</p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.hotel_name}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Pickup · {item.pickup_location ?? 'Pending address'}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Call Time · {item.call_time ?? 'Pending'}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge variant={item.assigned_vehicle ? 'active' : 'warning'} label={item.assigned_vehicle ? 'Vehicle Assigned' : 'Vehicle Pending'} />
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.assigned_vehicle ?? 'No vehicle assigned'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              <Surface variant="table" padding="lg" className={activeMobileTab === 'home' || activeMobileTab === 'alerts' ? '' : 'hidden md:block'}>
                <PanelHeader kicker="Signals" title="Alerts Panel" />
                {derivedAlerts.length === 0 ? (
                  <SmallEmpty title="No active alerts" description="Overlaps, late checkouts, travel mismatches, and extension issues will surface here automatically." />
                ) : (
                  <div className="space-y-3">
                    {derivedAlerts.map((alert, index) => (
                      <div key={`${alert.timestamp}-${index}`} className="rounded-[22px] border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.message}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{timeAgo(alert.timestamp)}</p>
                          </div>
                          {alertBadge(alert)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="md:hidden">
        <LiquidGlassNavbar
          ref={bottomNavRef}
          activeTabId={activeMobileTab}
          onTabChange={(id) => setActiveMobileTab(id as any)}
          tabs={[
            { id: 'home', icon: 'home', label: 'Home' },
            { id: 'hotels', icon: 'domain', label: 'Hotels' },
            { id: 'reminders', icon: 'notifications', label: 'Reminders' },
            { id: 'transport', icon: 'directions_car', label: 'Transport' },
            { id: 'alerts', icon: 'warning', label: 'Alerts' },
          ]}
        />
      </div>

      <ModalShell
        open={hotelModalOpen}
        title={hotelEditTarget ? 'Edit Hotel' : 'Add Hotel'}
        kicker="Hotel Directory"
        description="Manage pickup-ready hotel addresses and contact information without leaving the workspace."
        isSubmitting={createHotelMutation.isPending || updateHotelMutation.isPending}
        onClose={closeHotelModal}
        primaryLabel={hotelEditTarget ? 'Update Hotel' : 'Create Hotel'}
        onSubmit={handleHotelSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Hotel Name"><ModalTextInput value={hotelForm.hotelName} onChange={value => setHotelForm(current => ({ ...current, hotelName: value }))} placeholder="Grand Regency" /></ModalField>
          <ModalField label="City"><ModalTextInput value={hotelForm.city} onChange={value => setHotelForm(current => ({ ...current, city: value }))} placeholder="Chennai" /></ModalField>
          <div className="sm:col-span-2"><ModalField label="Address"><ModalTextInput value={hotelForm.address} onChange={value => setHotelForm(current => ({ ...current, address: value }))} placeholder="No. 12, Anna Salai" /></ModalField></div>
          <ModalField label="Contact Person"><ModalTextInput value={hotelForm.contactPerson} onChange={value => setHotelForm(current => ({ ...current, contactPerson: value }))} placeholder="Front Desk Manager" /></ModalField>
          <ModalField label="Contact Number"><ModalTextInput value={hotelForm.contactNumber} onChange={value => setHotelForm(current => ({ ...current, contactNumber: value }))} placeholder="+91 90000 00000" type="tel" /></ModalField>
        </div>
      </ModalShell>

      <ModalShell
        open={allocationModalOpen}
        title={allocationEditTarget ? 'Update Allocation' : 'Add Allocation'}
        kicker="Room Allocation Matrix"
        description="Assign rooms, track stays, and prevent duplicate bookings directly from the operations dashboard."
        isSubmitting={createAllocationMutation.isPending || updateAllocationMutation.isPending}
        onClose={closeAllocationModal}
        primaryLabel={allocationEditTarget ? 'Update Allocation' : 'Create Allocation'}
        onSubmit={handleAllocationSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Person Name"><ModalTextInput value={allocationForm.personName} onChange={value => setAllocationForm(current => ({ ...current, personName: value }))} placeholder="Actor / HOD name" /></ModalField>
          <ModalField label="Role Title"><ModalTextInput value={allocationForm.roleTitle} onChange={value => setAllocationForm(current => ({ ...current, roleTitle: value }))} placeholder="Lead Actor / HOD" /></ModalField>
          <ModalField label="Department"><ModalSelect value={allocationForm.department} onChange={value => setAllocationForm(current => ({ ...current, department: value }))} options={departmentOptions} /></ModalField>
          <ModalField label="Hotel">{hotelOptions.length > 0 ? <ModalSelect value={allocationForm.hotelName} onChange={value => setAllocationForm(current => ({ ...current, hotelName: value }))} options={hotelOptions} placeholder="Choose hotel" /> : <ModalTextInput value={allocationForm.hotelName} onChange={value => setAllocationForm(current => ({ ...current, hotelName: value }))} placeholder="Enter hotel name" />}</ModalField>
          <ModalField label="Room Number"><ModalTextInput value={allocationForm.roomNumber} onChange={value => setAllocationForm(current => ({ ...current, roomNumber: value }))} placeholder="305" /></ModalField>
          <ModalField label="Booking Status"><ModalSelect value={allocationForm.bookingStatus} onChange={value => setAllocationForm(current => ({ ...current, bookingStatus: value }))} options={allocationStatusOptions.map(option => ({ value: option.value, label: option.label }))} /></ModalField>
          <ModalField label="Check-In Date"><ModalTextInput value={allocationForm.checkInDate} onChange={value => setAllocationForm(current => ({ ...current, checkInDate: value }))} placeholder="" type="date" /></ModalField>
          <ModalField label="Check-Out Date"><ModalTextInput value={allocationForm.checkOutDate} onChange={value => setAllocationForm(current => ({ ...current, checkOutDate: value }))} placeholder="" type="date" /></ModalField>
          <div className="sm:col-span-2"><ModalField label="Notes"><ModalTextarea value={allocationForm.notes} onChange={value => setAllocationForm(current => ({ ...current, notes: value }))} placeholder="Pickup notes, late arrival handling, or room-sharing instructions." /></ModalField></div>
        </div>
        {allocationConflict ? (
          <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {allocationConflict}
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={Boolean(extendTarget)}
        title="Extend Stay"
        kicker="Stay Tracking"
        description="Adjust the checkout date and mark the stay extension so reminders and alerts stay in sync."
        isSubmitting={updateAllocationMutation.isPending}
        onClose={closeExtendModal}
        primaryLabel="Extend Stay"
        onSubmit={handleExtendSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Person Name"><ModalTextInput value={extendTarget?.personName ?? ''} onChange={() => undefined} placeholder="" readOnly /></ModalField>
          <ModalField label="Current Hotel"><ModalTextInput value={extendTarget?.hotelName ?? ''} onChange={() => undefined} placeholder="" readOnly /></ModalField>
          <ModalField label="New Check-Out Date"><ModalTextInput value={extendCheckoutDate} onChange={setExtendCheckoutDate} placeholder="" type="date" /></ModalField>
          <ModalField label="Current Status"><ModalTextInput value={extendTarget?.bookingStatus ?? ''} onChange={() => undefined} placeholder="" readOnly /></ModalField>
          <div className="sm:col-span-2"><ModalField label="Extension Notes"><ModalTextarea value={extendNotes} onChange={setExtendNotes} placeholder="Reason for extension, revised departure timing, or travel impact." /></ModalField></div>
        </div>
      </ModalShell>

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title ?? 'Confirm action'}
        message={confirmState?.message ?? ''}
        actionLabel={confirmState?.actionLabel ?? 'Confirm'}
        isSubmitting={confirmBusy}
        onClose={() => setConfirmState(null)}
        onConfirm={() => { void runConfirmAction() }}
      />
    </>
  )
}
