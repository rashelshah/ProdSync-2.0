import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ActionFeedbackToast, type ActionFeedbackState } from '@/components/shared/ActionFeedbackToast'
import { ModuleBudgetBadge } from '@/components/project/ModuleBudgetBadge'
import { DataTable } from '@/components/shared/DataTable'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { canAccessWardrobeWorkspace, canDeleteWardrobeContinuity, canManageWardrobeOperations } from '@/features/auth/role-capabilities'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useWardrobeData } from '@/modules/wardrobe/hooks/useWardrobeData'
import type {
  CreateWardrobeAccessoryInput,
  CreateWardrobeContinuityInput,
  CreateWardrobeInventoryInput,
  CreateWardrobeLaundryInput,
  UpdateWardrobeAccessoryInput,
  UpdateWardrobeInventoryInput,
  UpdateWardrobeLaundryInput,
  WardrobeAccessoryItem,
  WardrobeAccessoryStatus,
  WardrobeInventoryItem,
  WardrobeInventoryStatus,
  WardrobeLaundryBatch,
  WardrobeLaundryStatus,
} from '@/modules/wardrobe/types'
import { wardrobeService } from '@/services/wardrobe.service'
import { formatDate, formatTime, timeAgo } from '@/utils'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'

const todayDate = new Date().toISOString().slice(0, 10)

const emptyContinuityForm = {
  sceneNumber: '',
  characterName: '',
  actorName: '',
  notes: '',
  image: null as File | null,
}

const emptyInventoryForm = {
  costumeName: '',
  characterName: '',
  actorName: '',
  status: 'in_storage' as WardrobeInventoryStatus,
  lastUsedScene: '',
}

const emptyLaundryForm = {
  items: '',
  vendorName: '',
  sentDate: todayDate,
  expectedReturnDate: todayDate,
  status: 'sent' as WardrobeLaundryStatus,
}

const emptyAccessoryForm = {
  itemName: '',
  category: 'jewellery' as 'jewellery' | 'accessory',
  assignedCharacter: '',
  status: 'in_safe' as WardrobeAccessoryStatus,
}

function inventoryBadge(status: WardrobeInventoryStatus) {
  if (status === 'on_set') return <StatusBadge variant="active" label="On Set" />
  if (status === 'in_laundry') return <StatusBadge variant="pending" label="In Laundry" />
  if (status === 'missing') return <StatusBadge variant="flagged" label="Missing" />
  return <StatusBadge variant="completed" label="In Storage" />
}

function laundryBadge(status: WardrobeLaundryStatus) {
  if (status === 'returned') return <StatusBadge variant="completed" label="Returned" />
  if (status === 'delayed') return <StatusBadge variant="flagged" label="Delayed" />
  if (status === 'in_cleaning') return <StatusBadge variant="warning" label="In Cleaning" />
  return <StatusBadge variant="pending" label="Sent" />
}

function accessoryBadge(status: WardrobeAccessoryStatus) {
  if (status === 'in_safe') return <StatusBadge variant="completed" label="In Safe" />
  if (status === 'missing') return <StatusBadge variant="flagged" label="Missing" />
  if (status === 'on_set') return <StatusBadge variant="active" label="On Set" />
  return <StatusBadge variant="pending" label="In Use" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm">
      <Surface variant="table" padding="lg" className="flex max-h-[85vh] w-full max-w-xl flex-col border border-zinc-200 shadow-2xl dark:border-zinc-800">
        <div className="shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">{kicker}</p>
              <h2 className="section-title">{title}</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
            </div>
            <button onClick={onClose} disabled={isSubmitting} className="btn-ghost px-3 py-2 text-[10px]">
              Close
            </button>
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">{children}</div>

        <div className="mt-6 flex shrink-0 justify-end gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={isSubmitting} className="btn-primary disabled:opacity-60">
            {isSubmitting ? 'Saving...' : primaryLabel}
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
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: 'text' | 'date'
}) {
  return (
    <div className="project-modal-input-shell">
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} type={type} className="project-modal-input" />
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
      <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="project-modal-input min-h-[112px] resize-none bg-transparent" />
    </div>
  )
}

function ModalSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find(option => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) {
      return undefined
    }

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
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="project-modal-input-shell w-full text-left"
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span className="project-modal-input text-zinc-900 dark:text-white">{selectedOption?.label ?? value}</span>
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
                  {isSelected && <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Selected</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function splitLaundryItems(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)
}

export function WardrobeView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const canAccess = canAccessWardrobeWorkspace(user)
  const canManage = canManageWardrobeOperations(user)
  const canDeleteLogs = canDeleteWardrobeContinuity(user)

  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'inventory' | 'continuity' | 'laundry' | 'accessories'>('dashboard')
  const { navRef: bottomNavRef, companionRef: floatingActionsRef } = useMobileScrollHide()
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null)
  const [sceneFilter, setSceneFilter] = useState('')
  const [characterFilter, setCharacterFilter] = useState('')
  const [continuityModalOpen, setContinuityModalOpen] = useState(false)
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false)
  const [laundryModalOpen, setLaundryModalOpen] = useState(false)
  const [accessoryModalOpen, setAccessoryModalOpen] = useState(false)
  const [inventoryEditTarget, setInventoryEditTarget] = useState<WardrobeInventoryItem | null>(null)
  const [laundryEditTarget, setLaundryEditTarget] = useState<WardrobeLaundryBatch | null>(null)
  const [accessoryEditTarget, setAccessoryEditTarget] = useState<WardrobeAccessoryItem | null>(null)
  const [continuityForm, setContinuityForm] = useState(emptyContinuityForm)
  const [inventoryForm, setInventoryForm] = useState(emptyInventoryForm)
  const [laundryForm, setLaundryForm] = useState(emptyLaundryForm)
  const [accessoryForm, setAccessoryForm] = useState(emptyAccessoryForm)

  const { continuityLogs, inventory, laundry, accessories, alerts, isLoading, isError, refetch } = useWardrobeData(activeProjectId, {
    scene: sceneFilter.trim() || undefined,
    character: characterFilter.trim() || undefined,
  })

  const invalidateWardrobe = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wardrobe-continuity'] }),
      queryClient.invalidateQueries({ queryKey: ['wardrobe-inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['wardrobe-laundry'] }),
      queryClient.invalidateQueries({ queryKey: ['wardrobe-accessories'] }),
      queryClient.invalidateQueries({ queryKey: ['wardrobe-alerts'] }),
    ])
  }

  const continuityMutation = useMutation({
    mutationFn: (input: CreateWardrobeContinuityInput) => wardrobeService.createContinuity(input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setContinuityModalOpen(false)
      setContinuityForm(emptyContinuityForm)
      setFeedback({ type: 'success', message: 'Continuity log uploaded.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Continuity log could not be uploaded.' }),
  })

  const deleteContinuityMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => wardrobeService.deleteContinuity(projectId, id),
    onSuccess: async () => {
      await invalidateWardrobe()
      setFeedback({ type: 'success', message: 'Continuity log removed.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Continuity log could not be removed.' }),
  })

  const inventoryCreateMutation = useMutation({
    mutationFn: (input: CreateWardrobeInventoryInput) => wardrobeService.createInventory(input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setInventoryModalOpen(false)
      setInventoryForm(emptyInventoryForm)
      setFeedback({ type: 'success', message: 'Wardrobe item added.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Wardrobe item could not be created.' }),
  })

  const inventoryUpdateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWardrobeInventoryInput }) => wardrobeService.updateInventory(id, input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setInventoryEditTarget(null)
      setFeedback({ type: 'success', message: 'Wardrobe item updated.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Wardrobe item could not be updated.' }),
  })

  const laundryCreateMutation = useMutation({
    mutationFn: (input: CreateWardrobeLaundryInput) => wardrobeService.createLaundry(input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setLaundryModalOpen(false)
      setLaundryForm(emptyLaundryForm)
      setFeedback({ type: 'success', message: 'Laundry batch created.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Laundry batch could not be created.' }),
  })

  const laundryUpdateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWardrobeLaundryInput }) => wardrobeService.updateLaundry(id, input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setLaundryEditTarget(null)
      setFeedback({ type: 'success', message: 'Laundry batch updated.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Laundry batch could not be updated.' }),
  })

  const accessoryCreateMutation = useMutation({
    mutationFn: (input: CreateWardrobeAccessoryInput) => wardrobeService.createAccessory(input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setAccessoryModalOpen(false)
      setAccessoryForm(emptyAccessoryForm)
      setFeedback({ type: 'success', message: 'Accessory added.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Accessory could not be created.' }),
  })

  const accessoryUpdateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWardrobeAccessoryInput }) => wardrobeService.updateAccessory(id, input),
    onSuccess: async () => {
      await invalidateWardrobe()
      setAccessoryEditTarget(null)
      setFeedback({ type: 'success', message: 'Accessory updated.' })
    },
    onError: error => setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Accessory could not be updated.' }),
  })

  const submitContinuity = async () => {
    if (!activeProjectId) return
    if (!continuityForm.image) {
      setFeedback({ type: 'error', message: 'A continuity image is required.' })
      return
    }

    await continuityMutation.mutateAsync({
      projectId: activeProjectId,
      sceneNumber: continuityForm.sceneNumber.trim(),
      characterName: continuityForm.characterName.trim(),
      actorName: continuityForm.actorName.trim() || undefined,
      notes: continuityForm.notes.trim() || undefined,
      image: continuityForm.image,
    })
  }

  const submitInventory = async () => {
    if (!activeProjectId) return

    await inventoryCreateMutation.mutateAsync({
      projectId: activeProjectId,
      costumeName: inventoryForm.costumeName.trim(),
      characterName: inventoryForm.characterName.trim() || undefined,
      actorName: inventoryForm.actorName.trim() || undefined,
      status: inventoryForm.status,
      lastUsedScene: inventoryForm.lastUsedScene.trim() || undefined,
    })
  }

  const submitLaundry = async () => {
    if (!activeProjectId) return

    const items = splitLaundryItems(laundryForm.items)
    if (items.length === 0) {
      setFeedback({ type: 'error', message: 'Add at least one costume name.' })
      return
    }

    await laundryCreateMutation.mutateAsync({
      projectId: activeProjectId,
      items,
      vendorName: laundryForm.vendorName.trim(),
      sentDate: laundryForm.sentDate,
      expectedReturnDate: laundryForm.expectedReturnDate,
      status: laundryForm.status,
    })
  }

  const submitAccessory = async () => {
    if (!activeProjectId) return

    await accessoryCreateMutation.mutateAsync({
      projectId: activeProjectId,
      itemName: accessoryForm.itemName.trim(),
      category: accessoryForm.category,
      assignedCharacter: accessoryForm.assignedCharacter.trim() || undefined,
      status: accessoryForm.status,
    })
  }

  const sceneReadiness = useMemo(
    () =>
      Array.from(new Set(inventory.map(item => item.lastUsedScene).filter(Boolean)))
        .slice(0, 4)
        .map(scene => {
          const sceneId = scene as string
          const sceneItems = inventory.filter(item => item.lastUsedScene === sceneId)
          const hasMissing = sceneItems.some(item => item.status === 'missing')
          const hasLaundry = sceneItems.some(item => item.status === 'in_laundry')
          const hasContinuity = continuityLogs.some(log => log.sceneNumber === sceneId)
          return {
            scene: sceneId,
            count: sceneItems.length,
            state: hasMissing ? 'blocked' : !hasContinuity || hasLaundry ? 'pending' : 'ready',
          }
        }),
    [continuityLogs, inventory],
  )

  const recentActivity = useMemo(
    () =>
      [
        ...continuityLogs.map(log => ({
          id: `c-${log.id}`,
          title: `Continuity updated: Scene ${log.sceneNumber}`,
          subtitle: log.characterName,
          timestamp: log.createdAt,
        })),
        ...laundry
          .filter(batch => batch.status === 'returned')
          .map(batch => ({
            id: `l-${batch.id}`,
            title: `Laundry batch ${batch.batchId} returned`,
            subtitle: batch.vendorName ?? 'Laundry vendor',
            timestamp: batch.createdAt,
          })),
        ...accessories
          .filter(item => item.lastCheckinTime)
          .map(item => ({
            id: `a-${item.id}`,
            title: `${item.itemName} checked into safe`,
            subtitle: item.assignedCharacter ?? item.category,
            timestamp: item.lastCheckinTime ?? item.createdAt,
          })),
      ]
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 5),
    [accessories, continuityLogs, laundry],
  )

  const inUseCount = inventory.filter(item => item.status === 'on_set').length
  const readyCount = inventory.filter(item => item.status === 'on_set' || item.status === 'in_storage').length
  const returnedLaundry = laundry.filter(batch => batch.status === 'returned')
  const onTimeLaundry = returnedLaundry.filter(
    batch => !batch.expectedReturnDate || !batch.actualReturnDate || batch.actualReturnDate <= batch.expectedReturnDate,
  )
  const turnaround = returnedLaundry.length > 0 ? Math.round((onTimeLaundry.length / returnedLaundry.length) * 100) : 100

  if (isLoadingProjectContext) {
    return <div className="page-shell"><LoadingState message="Loading wardrobe workspace..." /></div>
  }

  if (isErrorProjectContext) {
    return <div className="page-shell"><ErrorState message="The wardrobe project context could not be resolved." /></div>
  }

  if (!activeProjectId || !activeProject) {
    return (
      <div className="page-shell">
        <Surface variant="table" padding="lg">
          <EmptyState title="No active project selected" description="Join or switch to a project to access wardrobe tracking." icon="checkroom" />
        </Surface>
      </div>
    )
  }

  if (!canAccess) {
    return <div className="page-shell"><ErrorState message="Your role does not have wardrobe workspace access for this project." /></div>
  }

  if (isLoading && continuityLogs.length === 0 && inventory.length === 0 && laundry.length === 0 && accessories.length === 0) {
    return <div className="page-shell"><LoadingState message="Loading wardrobe records..." /></div>
  }

  if (isError) {
    return <div className="page-shell"><ErrorState message="Wardrobe records could not be loaded." retry={() => void refetch()} /></div>
  }

  return (
    <div className="page-shell">
      <ActionFeedbackToast feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="max-md:hidden space-y-6">
        <header className="page-header">
        <div>
          <span className="page-kicker">Continuity Control</span>
          <h1 className="page-title page-title-compact">Wardrobe & Makeup</h1>
          <p className="page-subtitle">Live continuity, laundry, inventory, and high-value accessory tracking for {activeProject.name}.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ModuleBudgetBadge
            projectId={activeProjectId}
            department="wardrobe"
            currency={activeProject.currency}
          />
          <div className="flex items-center gap-3">
            {canManage && (
              <button onClick={() => setLaundryModalOpen(true)} className="btn-soft">Send to Laundry</button>
            )}
            {canManage && (
              <button onClick={() => setAccessoryModalOpen(true)} className="btn-soft">Add Accessory</button>
            )}
            {canManage && (
              <button onClick={() => setInventoryModalOpen(true)} className="btn-soft">Add Costume</button>
            )}
            {canManage && (
              <button onClick={() => setContinuityModalOpen(true)} className="btn-primary">Upload Continuity</button>
            )}
          </div>
        </div>
      </header>

      <div className="grid items-start gap-4 sm:grid-cols-3">
        <div className="grid items-start gap-4 sm:grid-cols-3 sm:col-span-3">
          <KpiCard label="In Use" value={String(inUseCount)} subLabel="Costumes active on set" accentColor="#f97316" className="min-h-0 self-start" />
          <KpiCard label="Ready" value={String(readyCount)} subLabel="Shoot-ready wardrobe units" accentColor="#22c55e" className="min-h-0 self-start" />
          <KpiCard
            label="Alerts"
            value={String(alerts.length).padStart(2, '0')}
            subLabel={alerts.length > 0 ? 'Action required' : 'All clear'}
            subType={alerts.length > 0 ? 'critical' : 'success'}
            accentColor={alerts.length > 0 ? '#ef4444' : '#22c55e'}
            className="min-h-0 self-start"
          />
        </div>
      </div>

      <WardrobeAlertsPanel alerts={alerts} />

      <Surface variant="table" padding="md">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Continuity</p>
            <h2 className="section-title">Photo Logs</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
            <div className="project-modal-input-shell"><input value={sceneFilter} onChange={event => setSceneFilter(event.target.value)} placeholder="Filter by scene" className="project-modal-input" /></div>
            <div className="project-modal-input-shell"><input value={characterFilter} onChange={event => setCharacterFilter(event.target.value)} placeholder="Filter by character" className="project-modal-input" /></div>
          </div>
        </div>

        {continuityLogs.length === 0 ? (
          <div className="py-8">
            <EmptyState title="No continuity logs yet" description="Upload scene photos to keep costume and makeup continuity aligned across the shoot." icon="add_a_photo" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {continuityLogs.map(log => (
              <div key={log.id} className="overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-900">
                  {log.imageUrl ? (
                    <img src={log.imageUrl} alt={`${log.characterName} continuity reference`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                      <span className="material-symbols-outlined text-5xl">image</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    Scene {log.sceneNumber}
                  </div>
                  {canDeleteLogs && (
                    <button
                      onClick={() => {
                        if (window.confirm('Remove this continuity log?')) {
                          void deleteContinuityMutation.mutateAsync({ projectId: activeProjectId, id: log.id })
                        }
                      }}
                      className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white transition hover:bg-red-500"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-900 dark:text-white">{log.characterName}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{log.actorName ?? 'Actor not specified'}</p>
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{log.notes ?? 'No continuity notes added.'}</p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{formatDate(log.createdAt)} at {formatTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface variant="table" padding="md">
          <div className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <p className="section-kicker">Inventory</p>
            <h2 className="section-title">Costume Tracker</h2>
          </div>
          {inventory.length === 0 ? (
            <div className="py-8">
              <EmptyState title="No costumes tracked yet" description="Add wardrobe inventory to start monitoring on-set movement, continuity scenes, and laundry flow." icon="checkroom" />
            </div>
          ) : (
            <div className="mt-5">
              <DataTable
                data={inventory}
                getKey={item => item.id}
                columns={[
                  {
                    key: 'assetCode',
                    label: 'Asset ID',
                    render: item => (
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{item.assetCode ?? 'WM-UNASSIGNED'}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.costumeName}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'characterName',
                    label: 'Character',
                    render: item => (
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">{item.characterName ?? 'Unassigned'}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.actorName ?? 'Actor TBD'}</p>
                      </div>
                    ),
                  },
                  { key: 'status', label: 'Status', render: item => inventoryBadge(item.status) },
                  { key: 'lastUsedScene', label: 'Last Scene', render: item => item.lastUsedScene ?? 'Not logged' },
                  {
                    key: 'action',
                    label: 'Action',
                    align: 'right',
                    render: item => (
                      <button onClick={() => setInventoryEditTarget(item)} className="btn-ghost px-4 py-2 text-[10px]">
                        Update
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Surface>

        <div className="space-y-6">
          <Surface variant="table" padding="md">
            <div className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
              <p className="section-kicker">Readiness</p>
              <h2 className="section-title">Scene Checks</h2>
            </div>
            <div className="mt-5 space-y-3">
              {sceneReadiness.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">No scene readiness data yet</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Add `last used scene` values to wardrobe inventory to surface continuity readiness.</p>
                </div>
              ) : sceneReadiness.map(item => (
                <div key={item.scene} className={`rounded-[22px] border px-4 py-4 ${item.state === 'ready' ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10' : item.state === 'blocked' ? 'border-red-200 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10' : 'border-orange-200 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Scene {item.scene}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{item.count} wardrobe records</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface
            variant="inverse"
            padding="md"
            className="border-zinc-900 bg-[radial-gradient(circle_at_top_left,rgba(255,120,80,0.2),transparent_44%),linear-gradient(180deg,#151515_0%,#09090b_100%)] text-white dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,120,80,0.2),transparent_44%),linear-gradient(180deg,#151515_0%,#09090b_100%)] dark:text-white"
          >
            <p className="section-kicker text-white/60">Laundry Cycle</p>
            <h2 className="mt-2 text-4xl font-bold tracking-[-0.05em]">{turnaround}%</h2>
            <p className="mt-3 text-sm text-white/70">On-time turnaround rate for completed wardrobe laundry batches.</p>
          </Surface>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Surface variant="table" padding="md">
          <div className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <p className="section-kicker">Laundry</p>
            <h2 className="section-title">Batch Tracker</h2>
          </div>
          <div className="mt-5 space-y-4">
            {laundry.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No laundry batches yet</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Create a batch to monitor vendor turnaround and delay risk.</p>
              </div>
            ) : laundry.map(batch => (
              <div key={batch.id} className="rounded-[24px] border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{batch.batchId}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{batch.vendorName ?? 'Vendor not specified'}</p>
                  </div>
                  {laundryBadge(batch.status)}
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{batch.items.join(', ')}</p>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Expected back: {batch.expectedReturnDate ? formatDate(batch.expectedReturnDate) : 'Pending'}</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setLaundryEditTarget(batch)} className="btn-ghost px-4 py-2 text-[10px]">
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface variant="table" padding="md">
          <div className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <p className="section-kicker">High Value</p>
            <h2 className="section-title">Accessories</h2>
          </div>
          <div className="mt-5 space-y-4">
            {accessories.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No accessories tracked yet</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Log jewellery and accessories to track safe check-ins.</p>
              </div>
            ) : accessories.map(item => (
              <div key={item.id} className="rounded-[24px] border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.itemName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{item.category}</p>
                  </div>
                  {accessoryBadge(item.status)}
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{item.assignedCharacter ?? 'No character assignment yet.'}</p>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Last check-in: {item.lastCheckinTime ? `${formatDate(item.lastCheckinTime)} at ${formatTime(item.lastCheckinTime)}` : 'Not checked in yet'}</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setAccessoryEditTarget(item)} className="btn-ghost px-4 py-2 text-[10px]">
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface variant="table" padding="md">
          <div className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <p className="section-kicker">Activity</p>
            <h2 className="section-title">Recent Updates</h2>
          </div>
          <div className="mt-5 space-y-4">
            {recentActivity.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No recent activity yet</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Wardrobe actions will appear here once records are created.</p>
              </div>
            ) : recentActivity.map(item => (
              <div key={item.id} className="flex gap-3">
                <div className="w-1 rounded-full bg-orange-500/80" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.subtitle}</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
      </div>

      <div className="md:hidden mt-2 px-1 pb-[100px]">
        <header className="px-3 mb-6">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
            <span className="page-kicker text-orange-500">Costume Department</span>
            <h1 className="page-title page-title-compact mt-2 mb-1 text-zinc-900 dark:text-white leading-tight">Wardrobe & Makeup</h1>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
              Manage inventory, continuity, and laundry
            </p>
          </div>
        </header>

        {activeMobileTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3 pb-[240px]">
             <section className="grid grid-cols-2 gap-3 px-1 pb-2">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">In Use</span>
                  <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-all w-full">{inUseCount}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Ready</span>
                  <div className="text-4xl font-headline font-extrabold text-emerald-400 mt-1 break-all w-full">{readyCount}</div>
                </div>
                <div className="col-span-2 bg-surface-container border border-red-500/20 bg-red-500/5 p-4 rounded-xl relative overflow-hidden shadow-md min-w-0">
                   <div className="absolute top-0 right-0 p-2 opacity-20">
                     <span className="material-symbols-outlined text-red-500 text-3xl">warning</span>
                   </div>
                   <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Alerts</span>
                   <div className="text-4xl font-headline font-extrabold text-red-500 mt-1 break-all w-full">{alerts.length.toString().padStart(2, '0')}</div>
                </div>
             </section>

             {alerts.length > 0 && (
               <section className="space-y-3 pt-6 pb-2">
                 <h2 className="text-orange-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4 mt-2 px-1">Critical Alerts</h2>
                 {alerts.map((alert, index) => {
                   const splitMsg = alert.message.split('. ')
                   const title = splitMsg[0]
                   
                   return (
                     <div key={`${alert.timestamp}-${index}`} className="bg-red-500/5 dark:bg-red-950/20 border border-red-500/20 dark:border-red-900/50 p-5 rounded-[24px] flex gap-4 items-start shadow-sm">
                       <span className="material-symbols-outlined text-red-500 shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                       <div className="space-y-1.5">
                         <p className="text-zinc-900 dark:text-white font-bold text-[15px] leading-tight pr-2">{title}</p>
                         <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{splitMsg.slice(1).join('. ') || 'Action required.'}</p>
                       </div>
                     </div>
                   )
                 })}
               </section>
             )}

             {continuityLogs.length > 0 && (
               <section>
                 <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Active Continuity</h2>
                 <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
                   <div className="relative h-64 bg-zinc-100 dark:bg-zinc-900">
                     {continuityLogs[0].imageUrl ? (
                       <img src={continuityLogs[0].imageUrl} alt="Continuity" className="w-full h-full object-cover" />
                     ) : (
                       <div className="flex h-full items-center justify-center text-zinc-600"><span className="material-symbols-outlined text-5xl">image</span></div>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5">
                       <div className="flex justify-between items-end">
                         <div>
                           <span className="bg-orange-500 text-black px-2 py-1 rounded text-[10px] font-bold uppercase mb-2 inline-block shadow-sm">Scene {continuityLogs[0].sceneNumber}</span>
                           <h3 className="text-2xl font-headline font-extrabold text-zinc-900 dark:text-white truncate max-w-[200px]">{continuityLogs[0].characterName}</h3>
                         </div>
                         <span className="material-symbols-outlined text-white p-2.5 bg-zinc-800/80 backdrop-blur-md rounded-full shadow-lg">photo_camera</span>
                       </div>
                     </div>
                   </div>
                 </div>
               </section>
             )}

             <section className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em]">Inventory Tracker</h2>
                 <button onClick={() => setActiveMobileTab('inventory')} className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">View All</button>
               </div>
               <div className="space-y-2">
                 {inventory.slice(0, 3).map(item => (
                   <div key={item.id} onClick={() => setInventoryEditTarget(item)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-4 rounded-[16px] flex items-center justify-between active:bg-zinc-800 transition-colors overflow-hidden">
                     <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                       <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-[12px] flex items-center justify-center">
                         <span className="material-symbols-outlined text-zinc-600 dark:text-zinc-400">checkroom</span>
                       </div>
                       <div className="min-w-0 flex-1">
                         <p className="font-bold text-zinc-900 dark:text-white truncate text-sm">{item.costumeName}</p>
                         <p className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide truncate">{item.characterName ?? 'Unassigned'}</p>
                       </div>
                     </div>
                     <div className="shrink-0">{inventoryBadge(item.status)}</div>
                   </div>
                 ))}
               </div>
             </section>

             {laundry.length > 0 && (
               <section className="space-y-4">
                 <div className="flex justify-between items-center px-1">
                   <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em]">Laundry Log</h2>
                   <button onClick={() => setActiveMobileTab('laundry')} className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">View All</button>
                 </div>
                 <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-5 rounded-[16px]">
                   <div className="flex justify-between items-start mb-4">
                     <div className="space-y-1">
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Batch ID</span>
                       <p className="text-sm font-mono tracking-tight text-zinc-900 dark:text-white">{laundry[0].batchId}</p>
                     </div>
                     <div>{laundryBadge(laundry[0].status)}</div>
                   </div>
                   <div className="flex items-center gap-2 pt-2 mb-4">
                     <div className="h-1 flex-1 bg-orange-500 rounded-full"></div>
                     <div className="h-1 flex-1 bg-orange-500 rounded-full"></div>
                     <div className="h-1 flex-1 bg-orange-500 rounded-full"></div>
                     <div className="h-1 flex-1 bg-orange-500 rounded-full"></div>
                   </div>
                   <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
                     <span>Sent: {laundry[0].sentDate ? formatTime(laundry[0].sentDate) : ''}</span>
                     <span>Expected: {laundry[0].expectedReturnDate ? formatTime(laundry[0].expectedReturnDate) : 'TBD'}</span>
                   </div>
                 </div>
               </section>
             )}

             <section className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em]">Accessories Tracker</h2>
                 <button onClick={() => setActiveMobileTab('accessories')} className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">View All</button>
               </div>
               <div className="space-y-2">
                 {accessories.slice(0, 3).map(item => (
                   <div key={item.id} onClick={() => setAccessoryEditTarget(item)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-4 rounded-[16px] flex items-center justify-between active:bg-zinc-800 transition-colors overflow-hidden">
                     <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                       <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-[12px] flex items-center justify-center">
                         <span className="material-symbols-outlined text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
                       </div>
                       <div className="min-w-0 flex-1">
                         <p className="font-bold text-zinc-900 dark:text-white truncate text-sm">{item.itemName}</p>
                         <p className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide truncate">{item.category}</p>
                       </div>
                     </div>
                     <div className="shrink-0">{accessoryBadge(item.status)}</div>
                   </div>
                 ))}
               </div>
             </section>

             <section className="pb-8">
               <h2 className="text-zinc-500 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">Recent Activity</h2>
               <div className="space-y-6 pl-4 border-l-2 border-zinc-800">
                 {recentActivity.slice(0, 3).map((item, index) => (
                   <div key={item.id} className="relative">
                     <div className={`absolute -left-[22px] top-0 w-3 h-3 rounded-full ${index === 0 ? 'bg-orange-500' : 'bg-zinc-700'} ring-4 ring-zinc-950`}></div>
                     <p className="text-xs text-zinc-500">{timeAgo(item.timestamp)}</p>
                     <p className="text-sm font-medium mt-1 text-zinc-900 dark:text-white opacity-90">{item.title} <span className="text-orange-400 font-bold ml-1">{item.subtitle}</span></p>
                   </div>
                 ))}
               </div>
             </section>

             {canManage && (
               <div ref={floatingActionsRef} className="fixed bottom-[96px] left-3 right-3 z-30">
                 <div className="flex flex-col gap-3 bg-white/90 dark:bg-[#0e0e0e]/85 p-4 rounded-[32px] border border-zinc-200/80 dark:border-white/5 shadow-2xl backdrop-blur-2xl">
                   <button onClick={() => setContinuityModalOpen(true)} className="w-full h-[56px] rounded-[16px] bg-orange-500 text-black font-bold flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                     <span className="material-symbols-outlined font-bold">upload_file</span>
                     Upload Continuity
                   </button>
                   <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => setLaundryModalOpen(true)} className="h-[64px] bg-zinc-50 dark:bg-[#1c1c1e]/90 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">local_laundry_service</span>
                       Laundry
                     </button>
                     <button onClick={() => setAccessoryModalOpen(true)} className="h-[64px] bg-zinc-50 dark:bg-[#1c1c1e]/90 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">diamond</span>
                       Accessory
                     </button>
                     <button onClick={() => setInventoryModalOpen(true)} className="h-[64px] bg-zinc-50 dark:bg-[#1c1c1e]/90 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                       <span className="material-symbols-outlined text-orange-500 text-[22px]">checkroom</span>
                       Costume
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>
        )}

        {/* Inventory Page */}
        {activeMobileTab === 'inventory' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6 px-3">
             <div className="space-y-3">
               {inventory.length === 0 ? (
                 <div className="pt-8 text-center"><p className="text-sm text-zinc-400">No inventory tracked yet.</p></div>
               ) : inventory.map(item => (
                 <div key={item.id} onClick={() => setInventoryEditTarget(item)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-4 rounded-[16px] flex items-center justify-between active:bg-zinc-800 transition-colors overflow-hidden">
                   <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                     <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-[12px] flex items-center justify-center">
                       <span className="material-symbols-outlined text-zinc-600 dark:text-zinc-400">checkroom</span>
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="font-bold text-zinc-900 dark:text-white truncate text-sm">{item.costumeName}</p>
                       <p className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide truncate">{item.characterName ?? 'Unassigned'}</p>
                     </div>
                   </div>
                   <div className="shrink-0">{inventoryBadge(item.status)}</div>
                 </div>
               ))}
             </div>
             {canManage && (
               <div className="pb-8">
                 <button onClick={() => setInventoryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">
                   <span className="material-symbols-outlined text-orange-500">add</span>
                   Add Costume
                 </button>
               </div>
             )}
          </div>
        )}

        {/* Continuity Page */}
        {activeMobileTab === 'continuity' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6 px-3">
             <div className="flex gap-2">
               <div className="flex-1 project-modal-input-shell"><input value={sceneFilter} onChange={event => setSceneFilter(event.target.value)} placeholder="Filter by scene..." className="project-modal-input h-[48px] bg-zinc-100 dark:bg-zinc-900/50" /></div>
               <button className="h-[48px] w-[48px] flex shrink-0 items-center justify-center rounded-[12px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors text-zinc-800 dark:text-zinc-300"><span className="material-symbols-outlined">filter_list</span></button>
             </div>
             <div className="space-y-4">
               {continuityLogs.length === 0 ? (
                 <div className="pt-8 text-center"><p className="text-sm text-zinc-400">No continuity logs yet.</p></div>
               ) : continuityLogs.map(log => (
                  <div key={log.id} className="bg-white dark:bg-zinc-900 rounded-[16px] overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="relative h-[320px] bg-zinc-100 dark:bg-zinc-900">
                      {log.imageUrl ? (
                        <img src={log.imageUrl} alt="Continuity" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-600"><span className="material-symbols-outlined text-5xl">image</span></div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="bg-orange-500 text-black px-2 py-1 rounded text-[10px] font-bold uppercase mb-2 inline-block shadow-sm">Scene {log.sceneNumber}</span>
                            <h3 className="text-2xl font-headline font-extrabold text-zinc-900 dark:text-white truncate max-w-[200px]">{log.characterName}</h3>
                          </div>
                          {canDeleteLogs && (
                            <button onClick={() => {
                              if (window.confirm('Remove this continuity log?')) {
                                void deleteContinuityMutation.mutateAsync({ projectId: activeProjectId, id: log.id })
                              }
                            }} className="material-symbols-outlined text-white p-2.5 bg-red-500/80 backdrop-blur-md rounded-full shadow-lg active:scale-90 transition-transform">delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
               ))}
             </div>
             {canManage && (
               <div className="pb-8">
                 <button onClick={() => setContinuityModalOpen(true)} className="w-full h-[56px] rounded-[16px] bg-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-lg">
                   <span className="material-symbols-outlined font-bold">upload_file</span>
                   Upload Continuity
                 </button>
               </div>
             )}
          </div>
        )}

        {/* Laundry Page */}
        {activeMobileTab === 'laundry' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6 px-3">
             <div className="space-y-4">
               {laundry.length === 0 ? (
                 <div className="pt-8 text-center"><p className="text-sm text-zinc-400">No laundry batches tracked yet.</p></div>
               ) : laundry.map(batch => (
                 <div key={batch.id} onClick={() => setLaundryEditTarget(batch)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-5 rounded-[16px] active:bg-zinc-800 transition-colors">
                   <div className="flex justify-between items-start mb-4">
                     <div className="space-y-1 pr-4">
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Batch ID</span>
                       <p className="text-sm font-mono tracking-tight text-zinc-900 dark:text-white truncate max-w-full">{batch.batchId}</p>
                     </div>
                     <div className="shrink-0">{laundryBadge(batch.status)}</div>
                   </div>
                   <p className="text-zinc-400 text-xs mb-4 line-clamp-2">{batch.items.join(', ')}</p>
                   <div className="flex flex-col gap-2">
                     <div className="w-full h-1.5 flex gap-1 rounded-full">
                        <div className={`h-full flex-1 rounded-full ${batch.status === 'sent' || batch.status === 'in_cleaning' || batch.status === 'returned' || batch.status === 'delayed' ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${batch.status === 'in_cleaning' || batch.status === 'returned' ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${batch.status === 'returned' ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>
                     </div>
                   </div>
                   <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4">
                     <span>Sent: {batch.sentDate ? formatTime(batch.sentDate) : ''}</span>
                     <span>Expected: {batch.expectedReturnDate ? formatTime(batch.expectedReturnDate) : 'TBD'}</span>
                   </div>
                 </div>
               ))}
             </div>
             {canManage && (
               <div className="pb-8">
                 <button onClick={() => setLaundryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">
                   <span className="material-symbols-outlined text-orange-500">add</span>
                   New Laundry Batch
                 </button>
               </div>
             )}
          </div>
        )}

        {/* Accessories Page */}
        {activeMobileTab === 'accessories' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6 px-3">
             <div className="space-y-3">
               {accessories.length === 0 ? (
                 <div className="pt-8 text-center"><p className="text-sm text-zinc-400">No accessories tracked yet.</p></div>
               ) : accessories.map(item => (
                 <div key={item.id} onClick={() => setAccessoryEditTarget(item)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-4 rounded-[16px] flex items-center justify-between active:bg-zinc-800 transition-colors overflow-hidden">
                   <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                     <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-[12px] flex items-center justify-center">
                       <span className="material-symbols-outlined text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="font-bold text-zinc-900 dark:text-white truncate text-sm">{item.itemName}</p>
                       <p className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide truncate">{item.category}</p>
                     </div>
                   </div>
                   <div className="shrink-0">{accessoryBadge(item.status)}</div>
                 </div>
               ))}
             </div>
             {canManage && (
               <div className="pb-8">
                 <button onClick={() => setAccessoryModalOpen(true)} className="w-full h-[56px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 font-bold text-sm rounded-[16px] flex items-center justify-center gap-2 active:scale-95 duration-200 uppercase tracking-wide shadow-sm">
                   <span className="material-symbols-outlined text-orange-500">add</span>
                   Add Accessory
                 </button>
               </div>
             )}
          </div>
        )}

        {/* Bottom Navigation */}
        <nav ref={bottomNavRef} className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex h-[80px] max-w-md items-center justify-around rounded-[30px] border border-zinc-200/80 bg-white/88 px-2 pb-safe shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/8 dark:bg-zinc-950/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
          {[
            { id: 'dashboard', icon: 'dashboard', label: 'Home' },
            { id: 'inventory', icon: 'inventory_2', label: 'Inventory' },
            { id: 'continuity', icon: 'camera_roll', label: 'Continuity' },
            { id: 'laundry', icon: 'local_laundry_service', label: 'Laundry' },
            { id: 'accessories', icon: 'diamond', label: 'Accessories' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as any)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-1.5 transition-all duration-200 ${activeMobileTab === tab.id ? 'bg-orange-500/12 text-orange-500 dark:bg-orange-500/16' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
            >
               <span className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${activeMobileTab === tab.id ? 'scale-110' : ''}`} style={activeMobileTab === tab.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
               <span className="text-[9px] font-bold uppercase tracking-tight mt-0.5">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <ModalShell
        open={continuityModalOpen}
        title="Upload Continuity"
        kicker="Continuity"
        description="Add continuity details and image inside the wardrobe workspace."
        isSubmitting={continuityMutation.isPending}
        onClose={() => setContinuityModalOpen(false)}
        primaryLabel="Upload Log"
        onSubmit={() => void submitContinuity()}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Scene Number">
              <ModalTextInput value={continuityForm.sceneNumber} onChange={value => setContinuityForm(current => ({ ...current, sceneNumber: value }))} placeholder="42A" />
            </ModalField>
            <ModalField label="Character Name">
              <ModalTextInput value={continuityForm.characterName} onChange={value => setContinuityForm(current => ({ ...current, characterName: value }))} placeholder="Detective John" />
            </ModalField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Actor Name">
              <ModalTextInput value={continuityForm.actorName} onChange={value => setContinuityForm(current => ({ ...current, actorName: value }))} placeholder="Actor name" />
            </ModalField>
            <ModalField label="Continuity Image">
              <div className="project-modal-input-shell">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                  onChange={event => setContinuityForm(current => ({ ...current, image: event.target.files?.[0] ?? null }))}
                  className="project-modal-input file:mr-3 file:border-0 file:bg-transparent file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.14em]"
                />
              </div>
            </ModalField>
          </div>
          <ModalField label="Notes">
            <ModalTextarea value={continuityForm.notes} onChange={value => setContinuityForm(current => ({ ...current, notes: value }))} placeholder="Continuity notes for wardrobe and makeup." />
          </ModalField>
        </div>
      </ModalShell>

      <ModalShell
        open={inventoryModalOpen}
        title="Add Costume"
        kicker="Inventory"
        description="Create a wardrobe inventory record without leaving the screen."
        isSubmitting={inventoryCreateMutation.isPending}
        onClose={() => setInventoryModalOpen(false)}
        primaryLabel="Add Costume"
        onSubmit={() => void submitInventory()}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Costume Name">
              <ModalTextInput value={inventoryForm.costumeName} onChange={value => setInventoryForm(current => ({ ...current, costumeName: value }))} placeholder="Velvet blazer" />
            </ModalField>
            <ModalField label="Status">
              <ModalSelect
                value={inventoryForm.status}
                onChange={value => setInventoryForm(current => ({ ...current, status: value }))}
                options={[
                  { value: 'in_storage', label: 'In Storage' },
                  { value: 'on_set', label: 'On Set' },
                  { value: 'in_laundry', label: 'In Laundry' },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
            </ModalField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Character Name">
              <ModalTextInput value={inventoryForm.characterName} onChange={value => setInventoryForm(current => ({ ...current, characterName: value }))} placeholder="Character name" />
            </ModalField>
            <ModalField label="Actor Name">
              <ModalTextInput value={inventoryForm.actorName} onChange={value => setInventoryForm(current => ({ ...current, actorName: value }))} placeholder="Actor name" />
            </ModalField>
          </div>
          <ModalField label="Last Used Scene">
            <ModalTextInput value={inventoryForm.lastUsedScene} onChange={value => setInventoryForm(current => ({ ...current, lastUsedScene: value }))} placeholder="Scene 12" />
          </ModalField>
        </div>
      </ModalShell>

      <ModalShell
        open={laundryModalOpen}
        title="Create Laundry Batch"
        kicker="Laundry"
        description="Track costumes sent out for cleaning using the wardrobe UI."
        isSubmitting={laundryCreateMutation.isPending}
        onClose={() => setLaundryModalOpen(false)}
        primaryLabel="Create Batch"
        onSubmit={() => void submitLaundry()}
      >
        <div className="grid gap-4">
          <ModalField label="Items">
            <ModalTextarea value={laundryForm.items} onChange={value => setLaundryForm(current => ({ ...current, items: value }))} placeholder="Costume names, one per line or comma separated" />
          </ModalField>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Vendor Name">
              <ModalTextInput value={laundryForm.vendorName} onChange={value => setLaundryForm(current => ({ ...current, vendorName: value }))} placeholder="Vendor name" />
            </ModalField>
            <ModalField label="Status">
              <ModalSelect
                value={laundryForm.status}
                onChange={value => setLaundryForm(current => ({ ...current, status: value }))}
                options={[
                  { value: 'sent', label: 'Sent' },
                  { value: 'in_cleaning', label: 'In Cleaning' },
                  { value: 'returned', label: 'Returned' },
                  { value: 'delayed', label: 'Delayed' },
                ]}
              />
            </ModalField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Sent Date">
              <ModalTextInput type="date" value={laundryForm.sentDate} onChange={value => setLaundryForm(current => ({ ...current, sentDate: value }))} placeholder="Sent date" />
            </ModalField>
            <ModalField label="Expected Return Date">
              <ModalTextInput type="date" value={laundryForm.expectedReturnDate} onChange={value => setLaundryForm(current => ({ ...current, expectedReturnDate: value }))} placeholder="Expected return date" />
            </ModalField>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={accessoryModalOpen}
        title="Add Accessory"
        kicker="High Value"
        description="Track jewellery and accessories with an in-app form instead of popup prompts."
        isSubmitting={accessoryCreateMutation.isPending}
        onClose={() => setAccessoryModalOpen(false)}
        primaryLabel="Add Accessory"
        onSubmit={() => void submitAccessory()}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Item Name">
              <ModalTextInput value={accessoryForm.itemName} onChange={value => setAccessoryForm(current => ({ ...current, itemName: value }))} placeholder="Vintage Watch #82" />
            </ModalField>
            <ModalField label="Category">
              <ModalSelect
                value={accessoryForm.category}
                onChange={value => setAccessoryForm(current => ({ ...current, category: value }))}
                options={[
                  { value: 'jewellery', label: 'Jewellery' },
                  { value: 'accessory', label: 'Accessory' },
                ]}
              />
            </ModalField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Assigned Character">
              <ModalTextInput value={accessoryForm.assignedCharacter} onChange={value => setAccessoryForm(current => ({ ...current, assignedCharacter: value }))} placeholder="Assigned character" />
            </ModalField>
            <ModalField label="Status">
              <ModalSelect
                value={accessoryForm.status}
                onChange={value => setAccessoryForm(current => ({ ...current, status: value }))}
                options={[
                  { value: 'in_safe', label: 'In Safe' },
                  { value: 'on_set', label: 'On Set' },
                  { value: 'in_use', label: 'In Use' },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
            </ModalField>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(inventoryEditTarget)}
        title="Update Costume"
        kicker="Inventory"
        description="Update wardrobe status from an on-screen form."
        isSubmitting={inventoryUpdateMutation.isPending}
        onClose={() => setInventoryEditTarget(null)}
        primaryLabel="Save Update"
        onSubmit={() => {
          if (!inventoryEditTarget) return
          void inventoryUpdateMutation.mutateAsync({
            id: inventoryEditTarget.id,
            input: {
              projectId: activeProjectId,
              status: inventoryEditTarget.status,
              lastUsedScene: inventoryEditTarget.lastUsedScene ?? undefined,
            },
          })
        }}
      >
        {inventoryEditTarget && (
          <div className="grid gap-4">
            <ModalField label="Status">
              <ModalSelect
                value={inventoryEditTarget.status}
                onChange={value => setInventoryEditTarget(current => (current ? { ...current, status: value } : current))}
                options={[
                  { value: 'in_storage', label: 'In Storage' },
                  { value: 'on_set', label: 'On Set' },
                  { value: 'in_laundry', label: 'In Laundry' },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
            </ModalField>
            <ModalField label="Last Used Scene">
              <ModalTextInput value={inventoryEditTarget.lastUsedScene ?? ''} onChange={value => setInventoryEditTarget(current => (current ? { ...current, lastUsedScene: value || null } : current))} placeholder="Scene 12" />
            </ModalField>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(laundryEditTarget)}
        title="Update Laundry Batch"
        kicker="Laundry"
        description="Adjust status and return date without leaving the wardrobe screen."
        isSubmitting={laundryUpdateMutation.isPending}
        onClose={() => setLaundryEditTarget(null)}
        primaryLabel="Save Update"
        onSubmit={() => {
          if (!laundryEditTarget) return
          void laundryUpdateMutation.mutateAsync({
            id: laundryEditTarget.batchId,
            input: {
              projectId: activeProjectId,
              status: laundryEditTarget.status,
              actualReturnDate: laundryEditTarget.actualReturnDate ?? undefined,
            },
          })
        }}
      >
        {laundryEditTarget && (
          <div className="grid gap-4">
            <ModalField label="Status">
              <ModalSelect
                value={laundryEditTarget.status}
                onChange={value => setLaundryEditTarget(current => (current ? { ...current, status: value } : current))}
                options={[
                  { value: 'sent', label: 'Sent' },
                  { value: 'in_cleaning', label: 'In Cleaning' },
                  { value: 'returned', label: 'Returned' },
                  { value: 'delayed', label: 'Delayed' },
                ]}
              />
            </ModalField>
            <ModalField label="Actual Return Date">
              <ModalTextInput type="date" value={laundryEditTarget.actualReturnDate ?? todayDate} onChange={value => setLaundryEditTarget(current => (current ? { ...current, actualReturnDate: value } : current))} placeholder="Actual return date" />
            </ModalField>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(accessoryEditTarget)}
        title="Update Accessory"
        kicker="High Value"
        description="Update accessory status with a matching in-app input box."
        isSubmitting={accessoryUpdateMutation.isPending}
        onClose={() => setAccessoryEditTarget(null)}
        primaryLabel="Save Update"
        onSubmit={() => {
          if (!accessoryEditTarget) return
          void accessoryUpdateMutation.mutateAsync({
            id: accessoryEditTarget.id,
            input: {
              projectId: activeProjectId,
              status: accessoryEditTarget.status,
              assignedCharacter: accessoryEditTarget.assignedCharacter ?? undefined,
            },
          })
        }}
      >
        {accessoryEditTarget && (
          <div className="grid gap-4">
            <ModalField label="Status">
              <ModalSelect
                value={accessoryEditTarget.status}
                onChange={value => setAccessoryEditTarget(current => (current ? { ...current, status: value } : current))}
                options={[
                  { value: 'in_safe', label: 'In Safe' },
                  { value: 'on_set', label: 'On Set' },
                  { value: 'in_use', label: 'In Use' },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
            </ModalField>
            <ModalField label="Assigned Character">
              <ModalTextInput value={accessoryEditTarget.assignedCharacter ?? ''} onChange={value => setAccessoryEditTarget(current => (current ? { ...current, assignedCharacter: value || null } : current))} placeholder="Assigned character" />
            </ModalField>
          </div>
        )}
      </ModalShell>
    </div>
  )
}

function WardrobeAlertsPanel({
  alerts,
}: {
  alerts: Array<{ message: string; timestamp: string; type: 'critical' | 'warning' }>
}) {
  return (
    <Surface variant="table" padding="md">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Alerts</p>
          <h2 className="section-title">Critical Signals</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Continuity, laundry, and accessory exceptions that need attention now.</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {alerts.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-[24px] border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">No wardrobe alerts right now</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Continuity, laundry, and accessory checks are currently on track.</p>
            </div>
          </div>
        ) : alerts.map((alert, index) => (
          <div
            key={`${alert.timestamp}-${index}`}
            className={`rounded-[24px] border px-4 py-4 ${alert.type === 'critical' ? 'border-red-200 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10' : 'border-orange-200 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10'}`}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.message}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{timeAgo(alert.timestamp)}</p>
          </div>
        ))}
      </div>
    </Surface>
  )
}
