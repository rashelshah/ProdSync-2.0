import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ActionFeedbackToast } from '@/components/shared/ActionFeedbackToast'
import { ModuleBudgetBadge } from '@/components/project/ModuleBudgetBadge'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import {
  canLogCameraMovement,
  canManageCameraWishlist,
  canReportCameraDamage,
  canReviewCameraRequestAtDopStage,
  canReviewCameraRequestAtProducerStage,
  canSubmitCameraRequest,
} from '@/features/auth/role-capabilities'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useCameraData } from '@/modules/camera/hooks/useCameraData'
import type {
  CameraIssueType,
  CameraRequest,
  CameraRequestStatus,
  CameraWishlistItem,
} from '@/modules/camera/types'
import { cameraService } from '@/services/camera.service'
import { formatCurrency, formatDate, formatTime, timeAgo } from '@/utils'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'

const emptyWishlistForm = {
  itemName: '',
  category: 'camera' as 'camera' | 'lighting' | 'grip',
  vendorName: '',
  quantity: '1',
  estimatedRate: '',
}

const emptyRequestForm = {
  itemName: '',
  quantity: '1',
  notes: '',
}

const emptyScanForm = {
  mode: 'in' as 'in' | 'out',
  assetName: '',
  assetId: '',
  notes: '',
}

const emptyDamageForm = {
  assetName: '',
  assetId: '',
  issueType: 'damaged' as CameraIssueType,
  imageUrl: '',
  notes: '',
}

function formatDateTime(value: string) {
  return `${formatDate(value)} | ${formatTime(value)}`
}

function panelEmpty(title: string, description: string) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  )
}

function issueLabel(issueType: CameraIssueType) {
  if (issueType === 'received_damaged') {
    return 'Received Damaged'
  }

  return issueType.charAt(0).toUpperCase() + issueType.slice(1)
}

function requestStatusBadge(status: CameraRequestStatus) {
  if (status === 'approved') return <StatusBadge variant="approved" label="Approved" />
  if (status === 'rejected') return <StatusBadge variant="rejected" label="Rejected" />
  if (status === 'pending_producer') return <StatusBadge variant="pending" label="Pending Producer" />
  return <StatusBadge variant="pending" label="Pending DOP" />
}

function parsePositiveInteger(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Please enter a whole number greater than 0.')
  }

  return parsed
}

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Please enter a valid non-negative number.')
  }

  return parsed
}

function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
      <div>
        <p className="section-kicker">{kicker}</p>
        <p className="section-title">{title}</p>
      </div>
      {action}
    </div>
  )
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
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm pt-safe">
      <Surface variant="table" padding="lg" className="w-full max-w-xl border border-zinc-200 shadow-2xl dark:border-zinc-800 flex flex-col max-h-[85vh] sm:max-h-[85vh]">
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h2 className="section-title">{title}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost px-3 py-2 text-[10px]">
            Close
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-2 break-words custom-scrollbar">{children}</div>

        <div className="mt-6 flex justify-end gap-3 shrink-0">
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

function ModalField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={className}>
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
  disabled,
  inputMode,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div className="project-modal-input-shell">
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="project-modal-input"
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
      />
    </div>
  )
}

function ModalTextarea({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
}) {
  return (
    <div className="project-modal-input-shell">
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        className="project-modal-input min-h-[112px] resize-none bg-transparent"
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function WishlistItemModal({
  open,
  mode,
  form,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  mode: 'create' | 'edit'
  form: typeof emptyWishlistForm
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptyWishlistForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Pre-Production"
      title={mode === 'edit' ? 'Edit Wishlist Item' : 'Add Wishlist Item'}
      description="Add a planned camera, lighting, or grip requirement without leaving the page."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel={mode === 'edit' ? 'Save Changes' : 'Add Item'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ModalField label="Item Name" className="sm:col-span-2">
          <ModalTextInput
            value={form.itemName}
            onChange={value => onChange('itemName', value)}
            placeholder="ARRI Alexa Mini LF body"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Category">
          <select
            value={form.category}
            onChange={event => onChange('category', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="camera">Camera</option>
            <option value="lighting">Lighting</option>
            <option value="grip">Grip</option>
          </select>
        </ModalField>

        <ModalField label="Quantity">
          <ModalTextInput
            value={form.quantity}
            onChange={value => onChange('quantity', value)}
            placeholder="1"
            disabled={isSubmitting}
            inputMode="numeric"
          />
        </ModalField>

        <ModalField label="Vendor">
          <ModalTextInput
            value={form.vendorName}
            onChange={value => onChange('vendorName', value)}
            placeholder="Vendor name"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Estimated Rate">
          <ModalTextInput
            value={form.estimatedRate}
            onChange={value => onChange('estimatedRate', value)}
            placeholder="Optional"
            disabled={isSubmitting}
            inputMode="decimal"
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

function RequestGearModal({
  open,
  form,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  form: typeof emptyRequestForm
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptyRequestForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="On-Set"
      title="Request Gear"
      description="Capture an ad-hoc camera department request and route it into the approval flow."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel="Create Request"
    >
      <div className="grid gap-4">
        <ModalField label="Item Name">
          <ModalTextInput
            value={form.itemName}
            onChange={value => onChange('itemName', value)}
            placeholder="Additional V-mount batteries"
            disabled={isSubmitting}
          />
        </ModalField>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModalField label="Quantity">
            <ModalTextInput
              value={form.quantity}
              onChange={value => onChange('quantity', value)}
              placeholder="1"
              disabled={isSubmitting}
              inputMode="numeric"
            />
          </ModalField>
        </div>

        <ModalField label="Notes">
          <ModalTextarea
            value={form.notes}
            onChange={value => onChange('notes', value)}
            placeholder="Optional context for DOP or producer approval"
            disabled={isSubmitting}
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

function ScanAssetModal({
  open,
  form,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  form: typeof emptyScanForm
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptyScanForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Movement"
      title="Scan Asset"
      description="Log a check-in or check-out event without leaving the camera operations screen."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel={form.mode === 'out' ? 'Check Out Asset' : 'Check In Asset'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ModalField label="Scan Type">
          <select
            value={form.mode}
            onChange={event => onChange('mode', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="in">Check In</option>
            <option value="out">Check Out</option>
          </select>
        </ModalField>

        <ModalField label="Asset Reference">
          <ModalTextInput
            value={form.assetId}
            onChange={value => onChange('assetId', value)}
            placeholder="Optional QR / asset code"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Asset Name" className="sm:col-span-2">
          <ModalTextInput
            value={form.assetName}
            onChange={value => onChange('assetName', value)}
            placeholder="ARRI Alexa Mini LF body"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Notes" className="sm:col-span-2">
          <ModalTextarea
            value={form.notes}
            onChange={value => onChange('notes', value)}
            placeholder="Optional movement notes"
            disabled={isSubmitting}
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

function DamageReportModal({
  open,
  form,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  form: typeof emptyDamageForm
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptyDamageForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Incidents"
      title="Report Damage or Loss"
      description="Log a damaged, lost, or received-damaged asset with optional evidence and notes."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel="Save Report"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ModalField label="Asset Name" className="sm:col-span-2">
          <ModalTextInput
            value={form.assetName}
            onChange={value => onChange('assetName', value)}
            placeholder="Tilta Nucleus-M hand unit"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Issue Type">
          <select
            value={form.issueType}
            onChange={event => onChange('issueType', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
            <option value="received_damaged">Received Damaged</option>
          </select>
        </ModalField>

        <ModalField label="Asset Reference">
          <ModalTextInput
            value={form.assetId}
            onChange={value => onChange('assetId', value)}
            placeholder="Optional asset code"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Image URL" className="sm:col-span-2">
          <ModalTextInput
            value={form.imageUrl}
            onChange={value => onChange('imageUrl', value)}
            placeholder="Optional evidence link"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Notes" className="sm:col-span-2">
          <ModalTextarea
            value={form.notes}
            onChange={value => onChange('notes', value)}
            placeholder="Describe what happened"
            disabled={isSubmitting}
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

function RequestApprovalModal({
  open,
  request,
  nextStatus,
  notes,
  isSubmitting,
  onClose,
  onSubmit,
  onNotesChange,
}: {
  open: boolean
  request: CameraRequest | null
  nextStatus: CameraRequestStatus | null
  notes: string
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onNotesChange: (value: string) => void
}) {
  if (!request || !nextStatus) {
    return null
  }

  const title = nextStatus === 'rejected'
    ? 'Reject Request'
    : nextStatus === 'approved'
      ? 'Approve Request'
      : 'Forward to Producer'

  const description = nextStatus === 'rejected'
    ? 'Add an optional note explaining why this request is being rejected.'
    : 'Add an optional note for the next approval stage or final approval.'

  const primaryLabel = nextStatus === 'rejected'
    ? 'Reject Request'
    : nextStatus === 'approved'
      ? 'Approve Request'
      : 'Send to Producer'

  return (
    <ModalShell
      open={open}
      kicker="Approvals"
      title={title}
      description={description}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel={primaryLabel}
    >
      <div className="grid gap-4">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{request.itemName}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Qty {request.quantity} | Current status: {request.status.replace('_', ' ')}
          </p>
        </div>

        <ModalField label="Notes">
          <ModalTextarea
            value={notes}
            onChange={onNotesChange}
            placeholder="Optional approval or rejection note"
            disabled={isSubmitting}
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

export function CameraView() {
  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'activity' | 'reports' | 'alerts' | 'wishlist'>('home')
  const { navRef: bottomNavRef, companionRef: floatingActionsRef } = useMobileScrollHide()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext } = useResolvedProjectContext()
  const { wishlist, requests, logs, damageReports, alerts, isLoading, isError } = useCameraData(activeProjectId)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false)
  const [wishlistModalMode, setWishlistModalMode] = useState<'create' | 'edit'>('create')
  const [editingWishlistItem, setEditingWishlistItem] = useState<CameraWishlistItem | null>(null)
  const [wishlistForm, setWishlistForm] = useState(emptyWishlistForm)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestForm, setRequestForm] = useState(emptyRequestForm)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanForm, setScanForm] = useState(emptyScanForm)
  const [damageModalOpen, setDamageModalOpen] = useState(false)
  const [damageForm, setDamageForm] = useState(emptyDamageForm)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvalRequest, setApprovalRequest] = useState<CameraRequest | null>(null)
  const [approvalNextStatus, setApprovalNextStatus] = useState<CameraRequestStatus | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')

  const createWishlistMutation = useMutation({ mutationFn: cameraService.createWishlistItem })
  const updateWishlistMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof cameraService.updateWishlistItem>[1] }) =>
      cameraService.updateWishlistItem(id, input),
  })
  const deleteWishlistMutation = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      cameraService.deleteWishlistItem(id, projectId),
  })
  const createRequestMutation = useMutation({ mutationFn: cameraService.createRequest })
  const updateRequestMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof cameraService.updateRequest>[1] }) =>
      cameraService.updateRequest(id, input),
  })
  const checkInMutation = useMutation({ mutationFn: cameraService.checkIn })
  const checkOutMutation = useMutation({ mutationFn: cameraService.checkOut })
  const createDamageMutation = useMutation({ mutationFn: cameraService.createDamageReport })

  const canManageWishlist = canManageCameraWishlist(user)
  const canCreateCameraRequests = canSubmitCameraRequest(user)
  const canCreateMovementLogs = canLogCameraMovement(user)
  const canCreateDamageReports = canReportCameraDamage(user)
  const canReviewDopStage = canReviewCameraRequestAtDopStage(user)
  const canReviewProducerStage = canReviewCameraRequestAtProducerStage(user)

  const pendingRequests = requests.filter(request => request.status === 'pending_dop' || request.status === 'pending_producer')
  const checkedInAssets = logs.filter(log => log.status === 'checked_in')
  const checkedOutAssets = logs.filter(log => log.status === 'checked_out')
  const criticalAlerts = alerts.filter(alert => alert.type === 'critical')

  async function refreshCameraQueries() {
    if (!activeProjectId) {
      return
    }

    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['camera-wishlist', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['camera-requests', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['camera-logs', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['camera-damage', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['camera-alerts', activeProjectId] }),
    ])
  }

  async function runCameraAction(action: () => Promise<unknown>, successMessage: string) {
    setFeedback(null)

    try {
      await action()
      await refreshCameraQueries()
      setFeedback({ type: 'success', message: successMessage })
      return true
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Camera module action failed.',
      })
      return false
    }
  }

  function resetWishlistModal() {
    setWishlistModalMode('create')
    setEditingWishlistItem(null)
    setWishlistForm(emptyWishlistForm)
    setWishlistModalOpen(false)
  }

  function openWishlistModal() {
    if (!canManageWishlist) {
      setFeedback({ type: 'error', message: 'Only the DOP can manage the camera wishlist.' })
      return
    }

    setFeedback(null)
    setWishlistModalMode('create')
    setEditingWishlistItem(null)
    setWishlistForm(emptyWishlistForm)
    setWishlistModalOpen(true)
  }

  function openEditWishlistModal(item: CameraWishlistItem) {
    if (!canManageWishlist) {
      setFeedback({ type: 'error', message: 'Only the DOP can manage the camera wishlist.' })
      return
    }

    setFeedback(null)
    setWishlistModalMode('edit')
    setEditingWishlistItem(item)
    setWishlistForm({
      itemName: item.itemName,
      category: item.category,
      vendorName: item.vendorName ?? '',
      quantity: String(item.quantity),
      estimatedRate: item.estimatedRate != null ? String(item.estimatedRate) : '',
    })
    setWishlistModalOpen(true)
  }

  function updateWishlistForm(field: keyof typeof emptyWishlistForm, value: string) {
    setWishlistForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateWishlistFromModal() {
    const projectId = editingWishlistItem?.projectId ?? activeProjectId
    if (!projectId) {
      return
    }

    try {
      const itemName = wishlistForm.itemName.trim()
      if (!itemName) {
        setFeedback({ type: 'error', message: 'Wishlist item name is required.' })
        return
      }

      const quantity = parsePositiveInteger(wishlistForm.quantity)
      if (!quantity) {
        setFeedback({ type: 'error', message: 'Quantity is required.' })
        return
      }

      const estimatedRate = parseOptionalNumber(wishlistForm.estimatedRate)

      const submitAction = wishlistModalMode === 'edit' && editingWishlistItem
        ? () =>
            updateWishlistMutation.mutateAsync({
              id: editingWishlistItem.id,
              input: {
                projectId,
                itemName,
                category: wishlistForm.category,
                vendorName: wishlistForm.vendorName.trim() || undefined,
                estimatedRate,
                quantity,
              },
            })
        : () =>
            createWishlistMutation.mutateAsync({
              projectId,
              itemName,
              category: wishlistForm.category,
              vendorName: wishlistForm.vendorName.trim() || undefined,
              estimatedRate,
              quantity,
            })

      const created = await runCameraAction(
        submitAction,
        wishlistModalMode === 'edit' ? 'Wishlist item updated.' : 'Wishlist item added.',
      )

      if (created) {
        resetWishlistModal()
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Please check the wishlist form values.',
      })
      return
    }
  }

  async function handleEditWishlistItem(item: CameraWishlistItem) {
    if (!canManageWishlist) {
      setFeedback({ type: 'error', message: 'Only the DOP can manage the camera wishlist.' })
      return
    }

    openEditWishlistModal(item)
  }

  async function handleDeleteWishlistItem(item: CameraWishlistItem) {
    if (!canManageWishlist) {
      setFeedback({ type: 'error', message: 'Only the DOP can manage the camera wishlist.' })
      return
    }

    if (!window.confirm(`Remove "${item.itemName}" from the wishlist?`)) {
      return
    }

    await runCameraAction(
      () => deleteWishlistMutation.mutateAsync({ id: item.id, projectId: item.projectId }),
      'Wishlist item removed.',
    )
  }

  function resetRequestModal() {
    setRequestForm(emptyRequestForm)
    setRequestModalOpen(false)
  }

  function openRequestModal() {
    if (!canCreateCameraRequests) {
      setFeedback({ type: 'error', message: 'This role cannot submit camera requests.' })
      return
    }

    setFeedback(null)
    setRequestForm(emptyRequestForm)
    setRequestModalOpen(true)
  }

  function updateRequestForm(field: keyof typeof emptyRequestForm, value: string) {
    setRequestForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateRequest() {
    if (!activeProjectId) {
      return
    }

    try {
      const itemName = requestForm.itemName.trim()
      if (!itemName) {
        setFeedback({ type: 'error', message: 'Requested item name is required.' })
        return
      }

      const quantity = parsePositiveInteger(requestForm.quantity)
      if (!quantity) {
        setFeedback({ type: 'error', message: 'Quantity is required.' })
        return
      }

      const created = await runCameraAction(
        () =>
          createRequestMutation.mutateAsync({
            projectId: activeProjectId,
            itemName,
            quantity,
            notes: requestForm.notes.trim() || undefined,
          }),
        'On-set request created.',
      )

      if (created) {
        resetRequestModal()
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Please check the request form values.',
      })
    }
  }

  function resetApprovalModal() {
    setApprovalModalOpen(false)
    setApprovalRequest(null)
    setApprovalNextStatus(null)
    setApprovalNotes('')
  }

  function openApprovalModal(request: CameraRequest, nextStatus: CameraRequestStatus) {
    if (!canApproveRequest(request)) {
      setFeedback({ type: 'error', message: 'This role cannot review that camera request.' })
      return
    }

    setFeedback(null)
    setApprovalRequest(request)
    setApprovalNextStatus(nextStatus)
    setApprovalNotes(request.notes ?? '')
    setApprovalModalOpen(true)
  }

  async function handleUpdateRequest() {
    if (!approvalRequest || !approvalNextStatus) {
      return
    }

    const successMessage = approvalNextStatus === 'rejected'
      ? 'Request rejected.'
      : approvalNextStatus === 'approved'
        ? 'Request approved.'
        : 'Request forwarded to producer.'

    const updated = await runCameraAction(
      () =>
        updateRequestMutation.mutateAsync({
          id: approvalRequest.id,
          input: {
            projectId: approvalRequest.projectId,
            status: approvalNextStatus,
            notes: approvalNotes.trim() || undefined,
          },
        }),
      successMessage,
    )

    if (updated) {
      resetApprovalModal()
    }
  }

  function resetScanModal() {
    setScanForm(emptyScanForm)
    setScanModalOpen(false)
  }

  function openScanModal() {
    if (!canCreateMovementLogs) {
      setFeedback({ type: 'error', message: 'This role cannot log camera movement.' })
      return
    }

    setFeedback(null)
    setScanForm(emptyScanForm)
    setScanModalOpen(true)
  }

  function updateScanForm(field: keyof typeof emptyScanForm, value: string) {
    setScanForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleScanAsset() {
    if (!activeProjectId) {
      return
    }

    const assetName = scanForm.assetName.trim()
    if (!assetName) {
      setFeedback({ type: 'error', message: 'Asset name is required for a scan.' })
      return
    }

    const mutation = scanForm.mode === 'out' ? checkOutMutation : checkInMutation
    const successMessage = scanForm.mode === 'out' ? 'Asset checked out.' : 'Asset checked in.'

    const scanned = await runCameraAction(
      () =>
        mutation.mutateAsync({
          projectId: activeProjectId,
          assetName,
          assetId: scanForm.assetId.trim() || undefined,
          notes: scanForm.notes.trim() || undefined,
        }),
      successMessage,
    )

    if (scanned) {
      resetScanModal()
    }
  }

  function resetDamageModal() {
    setDamageForm(emptyDamageForm)
    setDamageModalOpen(false)
  }

  function openDamageModal() {
    if (!canCreateDamageReports) {
      setFeedback({ type: 'error', message: 'This role cannot report camera issues.' })
      return
    }

    setFeedback(null)
    setDamageForm(emptyDamageForm)
    setDamageModalOpen(true)
  }

  function updateDamageForm(field: keyof typeof emptyDamageForm, value: string) {
    setDamageForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateDamageReport() {
    if (!activeProjectId) {
      return
    }

    const assetName = damageForm.assetName.trim()
    if (!assetName) {
      setFeedback({ type: 'error', message: 'Asset name is required to report an issue.' })
      return
    }

    const created = await runCameraAction(
      () =>
        createDamageMutation.mutateAsync({
          projectId: activeProjectId,
          assetName,
          assetId: damageForm.assetId.trim() || undefined,
          issueType: damageForm.issueType,
          imageUrl: damageForm.imageUrl.trim() || undefined,
          notes: damageForm.notes.trim() || undefined,
        }),
      'Damage report logged.',
    )

    if (created) {
      resetDamageModal()
    }
  }

  function canApproveRequest(request: CameraRequest) {
    return (request.status === 'pending_dop' && canReviewDopStage)
      || (request.status === 'pending_producer' && canReviewProducerStage)
  }

  function nextApprovalStatus(request: CameraRequest): CameraRequestStatus | null {
    if (request.status === 'pending_dop') {
      return 'pending_producer'
    }

    if (request.status === 'pending_producer') {
      return 'approved'
    }

    return null
  }

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
            description="Camera operations are project-scoped. Choose an active project before managing wishlist items, movement logs, or on-set approvals."
          />
        </Surface>
      </div>
    )
  }

  if (isLoading) return <LoadingState message="Loading camera operations..." />
  if (isError) return <ErrorState message="Failed to load camera module data" />

  return (
    <div className="page-shell space-y-6">
      <ActionFeedbackToast feedback={feedback} onDismiss={() => setFeedback(null)} />

      <WishlistItemModal
        open={wishlistModalOpen}
        mode={wishlistModalMode}
        form={wishlistForm}
        isSubmitting={createWishlistMutation.isPending || updateWishlistMutation.isPending}
        onClose={resetWishlistModal}
        onSubmit={handleCreateWishlistFromModal}
        onChange={updateWishlistForm}
      />
      <RequestGearModal
        open={requestModalOpen}
        form={requestForm}
        isSubmitting={createRequestMutation.isPending}
        onClose={resetRequestModal}
        onSubmit={handleCreateRequest}
        onChange={updateRequestForm}
      />
      <ScanAssetModal
        open={scanModalOpen}
        form={scanForm}
        isSubmitting={checkInMutation.isPending || checkOutMutation.isPending}
        onClose={resetScanModal}
        onSubmit={handleScanAsset}
        onChange={updateScanForm}
      />
      <DamageReportModal
        open={damageModalOpen}
        form={damageForm}
        isSubmitting={createDamageMutation.isPending}
        onClose={resetDamageModal}
        onSubmit={handleCreateDamageReport}
        onChange={updateDamageForm}
      />
      <RequestApprovalModal
        open={approvalModalOpen}
        request={approvalRequest}
        nextStatus={approvalNextStatus}
        notes={approvalNotes}
        isSubmitting={updateRequestMutation.isPending}
        onClose={resetApprovalModal}
        onSubmit={handleUpdateRequest}
        onNotesChange={setApprovalNotes}
      />

      <div className="hidden md:block space-y-6">
        <header className="page-header">
        <div>
          <span className="page-kicker">Asset Operations</span>
          <h1 className="page-title page-title-compact">Camera & Assets</h1>
          <p className="page-subtitle">
            Live wishlist planning, approval flow, movement logs, and damage reporting for {activeProject.name}.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <ModuleBudgetBadge
            projectId={activeProjectId}
            department="camera"
            currency={activeProject.currency}
          />
          <div className="flex items-center gap-3">
            {canManageWishlist && (
              <button onClick={openWishlistModal} className="btn-soft">
                Add Wishlist Item
              </button>
            )}
            {canCreateCameraRequests && (
              <button onClick={openRequestModal} className="btn-soft">
                Request Gear
              </button>
            )}
            {canCreateMovementLogs && (
              <button onClick={openScanModal} className="btn-soft">
                Scan QR
              </button>
            )}
            {canCreateDamageReports && (
              <button onClick={openDamageModal} className="btn-primary">
                Report Issue
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Wishlist Items" value={String(wishlist.length)} subLabel="Pre-production plan" />
        <KpiCard
          label="Pending Requests"
          value={String(pendingRequests.length)}
          subLabel="Awaiting approvals"
          subType={pendingRequests.length > 0 ? 'warning' : 'default'}
        />
        <KpiCard label="Checked In" value={String(checkedInAssets.length)} subLabel={`${checkedOutAssets.length} completed movement logs`} />
        <KpiCard
          label="Damage & Loss"
          value={String(damageReports.length)}
          subLabel={`${alerts.length} active alerts`}
          subType={damageReports.some(report => report.issueType === 'lost') ? 'critical' : 'warning'}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader
              kicker="Pre-Production"
              title="Wishlist"
              action={
                canManageWishlist ? (
                  <button onClick={openWishlistModal} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                    Add Item
                  </button>
                ) : undefined
              }
            />

            {wishlist.length === 0 ? (
              panelEmpty('No wishlist items yet', 'Add planned camera, lighting, or grip needs to turn this into a live prep list.')
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-950">
                    <tr className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Vendor</th>
                      <th className="px-6 py-4">Qty</th>
                      <th className="px-6 py-4">Estimated</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {wishlist.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.itemName}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Added by {item.createdByName ?? 'ProdSync User'} | {formatDateTime(item.createdAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm capitalize text-zinc-600 dark:text-zinc-300">{item.category}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{item.vendorName ?? 'TBD'}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                          {item.estimatedRate != null ? formatCurrency(item.estimatedRate) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canManageWishlist && (
                            <div className="flex justify-end gap-3 text-[11px] font-semibold uppercase tracking-[0.12em]">
                              <button onClick={() => handleEditWishlistItem(item)} className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                                Edit
                              </button>
                              <button onClick={() => handleDeleteWishlistItem(item)} className="text-red-500 hover:text-red-400">
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader kicker="On-Set" title="Requests & Approval Flow" />

            {requests.length === 0 ? (
              panelEmpty('No on-set requests yet', 'New camera requests will appear here and move through DOP and producer approval states.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {requests.map(request => {
                  const approvalStatus = nextApprovalStatus(request)
                  const approvalLabel = request.status === 'pending_dop' ? 'Send to Producer' : 'Approve'
                  const canReview = canApproveRequest(request)

                  return (
                    <div key={request.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{request.itemName}</p>
                          {requestStatusBadge(request.status)}
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                            Qty {request.quantity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          Requested by {request.requestedByName ?? 'ProdSync User'} | {timeAgo(request.createdAt)}
                        </p>
                        {request.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{request.notes}</p>}
                      </div>

                      {canReview ? (
                        <div className="flex gap-3">
                          {approvalStatus && (
                            <button
                              onClick={() => openApprovalModal(request, approvalStatus)}
                              className="btn-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            >
                              {approvalLabel}
                            </button>
                          )}
                          <button
                            onClick={() => openApprovalModal(request, 'rejected')}
                            className="btn-ghost px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-500 dark:text-red-400"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                          {request.status === 'pending_dop'
                            ? 'Awaiting DOP review'
                            : request.status === 'pending_producer'
                              ? 'Awaiting producer review'
                              : 'Closed'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Surface>

          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader kicker="Movement" title="QR Activity Log" />

            {logs.length === 0 ? (
              panelEmpty('No QR scans yet', 'Check-in and check-out scans will build a live movement trail for the camera department.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {logs.map(log => (
                  <div key={log.id} className="flex flex-col gap-2 px-6 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{log.assetName}</p>
                      <StatusBadge
                        variant={log.status === 'checked_in' ? 'active' : 'completed'}
                        label={log.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                      />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {log.status === 'checked_in'
                        ? `Checked in ${log.checkInTime ? timeAgo(log.checkInTime) : timeAgo(log.createdAt)}`
                        : `Checked out ${log.checkOutTime ? timeAgo(log.checkOutTime) : timeAgo(log.createdAt)}`} by {log.scannedByName ?? 'ProdSync User'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      In: {log.checkInTime ? formatDateTime(log.checkInTime) : 'N/A'} | Out: {log.checkOutTime ? formatDateTime(log.checkOutTime) : 'Open'}
                    </p>
                    {log.notes && <p className="text-sm text-zinc-600 dark:text-zinc-300">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>

        <div className="space-y-6">
          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader kicker="Incidents" title="Damage & Loss Reports" />

            {damageReports.length === 0 ? (
              panelEmpty('No damage or loss reports', 'Issues reported against camera assets will show here with timestamps and notes.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {damageReports.map(report => (
                  <div key={report.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{report.assetName}</p>
                      <StatusBadge variant={report.issueType === 'lost' ? 'rejected' : 'warning'} label={issueLabel(report.issueType)} />
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Reported by {report.reportedByName ?? 'ProdSync User'} | {formatDateTime(report.createdAt)}
                    </p>
                    {report.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{report.notes}</p>}
                    {report.imageUrl && (
                      <a href={report.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                        Open Image
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader kicker="Visibility" title="Operational Alerts" />

            {alerts.length === 0 ? (
              panelEmpty('No active alerts', 'Pending approvals, open movement logs, and damage events will raise alerts here automatically.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {alerts.map((alert, index) => (
                  <div key={`${alert.timestamp}-${index}`} className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <StatusBadge variant={alert.type === 'critical' ? 'rejected' : 'warning'} label={alert.type} />
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.message}</p>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{formatDateTime(alert.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </div>
      </div>

      <div className="md:hidden mt-2 px-1 pb-44">
        <header className="px-3">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
            <span className="page-kicker text-orange-500">Asset Operations</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Camera & Assets</h1>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">Manage gear, requests, and movement logs</p>
          </div>
        </header>

        {activeMobileTab === 'home' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3 pt-6">
            {criticalAlerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-orange-500/80 tracking-widest uppercase mb-2 px-1">Critical Alerts</h2>
                {criticalAlerts.map((alert, index) => (
                  <div key={`${alert.timestamp}-${index}`} className="rounded-[22px] border border-red-500/20 bg-red-500/10 p-4 shadow-[0_14px_32px_rgba(239,68,68,0.12)]">
                    <div className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-red-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{alert.message}</p>
                      <p className="mt-1 text-xs text-red-500/80 dark:text-red-300">{formatDateTime(alert.timestamp)}</p>
                    </div>
                  </div>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Statistics</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Wishlist', value: wishlist.length },
                  { label: 'Pending', value: pendingRequests.length },
                  { label: 'Checked In', value: checkedInAssets.length },
                  { label: 'Checked Out', value: checkedOutAssets.length },
                  { label: 'Damage/Loss', value: damageReports.length },
                ].map(card => (
                  <div
                    key={card.label}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between"
                  >
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{card.label}</span>
                    <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: String(card.value).length > 10 ? '1.35rem' : String(card.value).length > 6 ? '1.7rem' : '2rem' }}>{card.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Pending Requests</h2>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-center shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No pending requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(request => {
                    const approvalStatus = nextApprovalStatus(request)
                    const approvalLabel = request.status === 'pending_dop' ? 'Send to Producer' : 'Approve'
                    const canReview = canApproveRequest(request)

                    return (
                      <div key={request.id} className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{request.itemName}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Requested by {request.requestedByName ?? 'User'} • Qty: {request.quantity}</p>
                          </div>
                          <div className="flex-shrink-0 scale-90 origin-top-right">
                            {requestStatusBadge(request.status)}
                          </div>
                        </div>
                        {canReview && (
                          <div className="mt-3 flex gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800/60">
                            {approvalStatus && (
                              <button onClick={() => openApprovalModal(request, approvalStatus)} className="flex-1 rounded-xl bg-orange-500 py-2 text-[10px] font-bold uppercase tracking-widest text-black active:scale-95 transition-transform">
                                {approvalLabel}
                              </button>
                            )}
                            <button onClick={() => openApprovalModal(request, 'rejected')} className="flex-1 rounded-xl border border-zinc-200 bg-zinc-100 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500 active:scale-95 transition-transform dark:border-zinc-700 dark:bg-zinc-800">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Movement Log</h2>
                {canCreateMovementLogs && (
                  <button onClick={openScanModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Log +
                  </button>
                )}
              </div>
              
              {logs.length === 0 ? (
                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-center shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No movement logs.</p>
                </div>
              ) : (
                <div className="relative ml-4 pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6 py-2">
                  {logs.map(log => (
                     <div key={log.id} className="relative">
                        <div className={`absolute -left-[32px] top-1 h-3.5 w-3.5 rounded-full border-4 border-white dark:border-zinc-950 ${log.status === 'checked_in' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] dark:border-zinc-800/80 dark:bg-zinc-900">
                          <div className="flex justify-between items-start">
                             <div>
                               <p className="text-sm font-bold text-zinc-900 dark:text-white">{log.assetName}</p>
                               <p className="text-[10px] text-zinc-500 font-mono mt-1">
                                 {log.status === 'checked_in' ? 'In: ' + (log.checkInTime ? formatTime(log.checkInTime) : formatTime(log.createdAt)) : 'Out: ' + (log.checkOutTime ? formatTime(log.checkOutTime) : formatTime(log.createdAt))}
                               </p>
                             </div>
                             <div className="flex flex-col items-end gap-1 scale-90 origin-top-right">
                               <StatusBadge variant={log.status === 'checked_in' ? 'active' : 'completed'} label={log.status === 'checked_in' ? 'Checked In' : 'Checked Out'} />
                             </div>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">{log.scannedByName ?? 'ProdSync User'}{log.notes ? ` • ${log.notes}` : ''}</p>
                        </div>
                     </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Wishlist Items</h2>
                {canManageWishlist && (
                  <button onClick={openWishlistModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Add +
                  </button>
                )}
              </div>
              
              {wishlist.length === 0 ? (
                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-center shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No wishlist items.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {wishlist.map(item => (
                    <div key={item.id} className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.07)] dark:border-zinc-800 dark:bg-zinc-900">
                       <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-sm text-zinc-900 dark:text-white">{item.itemName}</p>
                              <span className="text-orange-500 text-xs font-bold italic">Qty: {item.quantity}</span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 capitalize">Category: {item.category}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Est: {item.estimatedRate != null ? formatCurrency(item.estimatedRate) : 'N/A'}</p>
                          </div>
                          <div className="flex justify-between items-end border-t border-zinc-200 dark:border-zinc-800 pt-3">
                             <p className="text-[10px] text-zinc-500">Added by: {item.createdByName ?? 'User'}</p>
                             {canManageWishlist && (
                               <div className="flex gap-4 items-center">
                                  <button onClick={() => handleDeleteWishlistItem(item)} className="material-symbols-outlined text-[16px] text-red-500">delete</button>
                                  <button onClick={() => handleEditWishlistItem(item)} className="material-symbols-outlined text-[16px] text-zinc-500 dark:text-zinc-400">edit</button>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Damage & Loss Reports</h2>
                {canCreateDamageReports && (
                  <button onClick={openDamageModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Report +
                  </button>
                )}
              </div>
              {damageReports.length === 0 ? (
                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-center shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No issues reported.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {damageReports.map(report => (
                     <div key={report.id} className="flex flex-col gap-3 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-red-500/10 rounded-lg flex-shrink-0">
                             <span className="material-symbols-outlined text-red-500 font-bold">{report.issueType === 'damaged' ? 'broken_image' : 'inventory_2'}</span>
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between items-start">
                               <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{report.assetName}</p>
                               <span className={`font-black text-[9px] uppercase px-2 py-0.5 rounded ml-2 whitespace-nowrap ${report.issueType === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/10 text-orange-400'}`}>{issueLabel(report.issueType)}</span>
                             </div>
                             <p className="text-[10px] text-zinc-500 mt-1">Reported: {formatDate(report.createdAt)}</p>
                          </div>
                        </div>
                        {(report.notes || report.imageUrl) && (
                           <div className="mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col gap-2">
                             {report.notes && <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-h-20 overflow-y-auto">{report.notes}</p>}
                             {report.imageUrl && (
                               <a href={report.imageUrl} target="_blank" rel="noreferrer" className="text-[10px] uppercase font-bold tracking-widest text-orange-500 flex items-center gap-1 w-max">
                                  View Image <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                               </a>
                             )}
                           </div>
                        )}
                      </div>
                   ))}
                 </div>
               )}
            </section>
        </div>
        
        )}

        {activeMobileTab === 'activity' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Movement Log</h2>
                {canCreateMovementLogs && (
                  <button onClick={openScanModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Log +
                  </button>
                )}
              </div>
              {logs.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No movement logs.</p>
                </div>
              ) : (
                <div className="relative ml-4 pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6 py-2">
                  {logs.map(log => (
                     <div key={log.id} className="relative">
                        <div className={`absolute -left-[32px] top-1 h-3.5 w-3.5 rounded-full border-4 border-white dark:border-zinc-950 ${log.status === 'checked_in' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-lg border border-zinc-200 dark:border-zinc-800/80">
                          <div className="flex justify-between items-start">
                             <div>
                               <p className="text-sm font-bold text-zinc-900 dark:text-white">{log.assetName}</p>
                               <p className="text-[10px] text-zinc-500 font-mono mt-1">
                                 {log.status === 'checked_in' ? 'In: ' + (log.checkInTime ? formatTime(log.checkInTime) : formatTime(log.createdAt)) : 'Out: ' + (log.checkOutTime ? formatTime(log.checkOutTime) : formatTime(log.createdAt))}
                               </p>
                             </div>
                             <div className="flex flex-col items-end gap-1 scale-90 origin-top-right">
                               <StatusBadge variant={log.status === 'checked_in' ? 'active' : 'completed'} label={log.status === 'checked_in' ? 'Checked In' : 'Checked Out'} />
                             </div>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">{log.scannedByName ?? 'ProdSync User'}{log.notes ? ` • ${log.notes}` : ''}</p>
                        </div>
                     </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeMobileTab === 'reports' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Damage & Loss Reports</h2>
                {canCreateDamageReports && (
                  <button onClick={openDamageModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Report +
                  </button>
                )}
              </div>
              {damageReports.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No issues reported.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {damageReports.map(report => (
                     <div key={report.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl flex flex-col gap-3 border border-zinc-200 dark:border-zinc-800 shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-red-500/10 rounded-lg flex-shrink-0">
                             <span className="material-symbols-outlined text-red-500 font-bold">{report.issueType === 'damaged' ? 'broken_image' : 'inventory_2'}</span>
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between items-start">
                               <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{report.assetName}</p>
                               <span className={`font-black text-[9px] uppercase px-2 py-0.5 rounded ml-2 whitespace-nowrap ${report.issueType === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/10 text-orange-400'}`}>{issueLabel(report.issueType)}</span>
                             </div>
                             <p className="text-[10px] text-zinc-500 mt-1">Reported: {formatDate(report.createdAt)}</p>
                          </div>
                        </div>
                        {(report.notes || report.imageUrl) && (
                           <div className="mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col gap-2">
                             {report.notes && <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-h-20 overflow-y-auto">{report.notes}</p>}
                             {report.imageUrl && (
                               <a href={report.imageUrl} target="_blank" rel="noreferrer" className="text-[10px] uppercase font-bold tracking-widest text-orange-500 flex items-center gap-1 w-max">
                                  View Image <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                               </a>
                             )}
                           </div>
                        )}
                     </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeMobileTab === 'alerts' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 space-y-8">
            {criticalAlerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-orange-500/80 tracking-widest uppercase mb-2 px-1">Critical Alerts</h2>
                {criticalAlerts.map((alert, index) => (
                  <div key={`${alert.timestamp}-${index}`} className="rounded-[22px] border border-red-500/20 bg-red-500/10 p-4 shadow-[0_14px_32px_rgba(239,68,68,0.12)]">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined mt-0.5 text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">{alert.message}</p>
                        <p className="mt-1 text-xs text-red-500/80 dark:text-red-300">{formatDateTime(alert.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Pending Requests</h2>
              </div>
              
              {requests.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map(request => {
                    const approvalStatus = nextApprovalStatus(request)
                    const approvalLabel = request.status === 'pending_dop' ? 'Send to Producer' : 'Approve'
                    const canReview = canApproveRequest(request)
                    
                    return (
                      <div key={request.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 shadow-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-zinc-900 dark:text-white font-bold text-sm">{request.itemName}</p>
                            <p className="text-zinc-500 text-xs mt-1">Requested by {request.requestedByName ?? 'User'} • Qty: {request.quantity}</p>
                          </div>
                          <div className="flex-shrink-0 scale-90 origin-top-right">
                            {requestStatusBadge(request.status)}
                          </div>
                        </div>
                        {canReview && (
                           <div className="flex gap-2 mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/50">
                              {approvalStatus && (
                                <button onClick={() => openApprovalModal(request, approvalStatus)} className="flex-1 bg-orange-500 text-black py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform">
                                  {approvalLabel}
                                </button>
                              )}
                              <button onClick={() => openApprovalModal(request, 'rejected')} className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-red-400 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform">
                                Reject
                              </button>
                           </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {activeMobileTab === 'wishlist' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Wishlist Items</h2>
                {canManageWishlist && (
                  <button onClick={openWishlistModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Add +
                  </button>
                )}
              </div>
              {wishlist.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No wishlist items.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {wishlist.map(item => (
                    <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden flex flex-col shadow-lg border border-zinc-200 dark:border-zinc-800">
                       <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-sm text-zinc-900 dark:text-white">{item.itemName}</p>
                              <span className="text-orange-500 text-xs font-bold italic">Qty: {item.quantity}</span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 capitalize">Category: {item.category}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Est: {item.estimatedRate != null ? formatCurrency(item.estimatedRate) : 'N/A'}</p>
                          </div>
                          <div className="flex justify-between items-end border-t border-zinc-200 dark:border-zinc-800 pt-3">
                             <p className="text-[10px] text-zinc-500">Added by: {item.createdByName ?? 'User'}</p>
                             {canManageWishlist && (
                               <div className="flex gap-4 items-center">
                                  <button onClick={() => handleDeleteWishlistItem(item)} className="material-symbols-outlined text-[16px] text-red-500">delete</button>
                                  <button onClick={() => handleEditWishlistItem(item)} className="material-symbols-outlined text-[16px] text-zinc-500 dark:text-zinc-400">edit</button>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeMobileTab === 'home' && (
          <div ref={floatingActionsRef} className="fixed bottom-[96px] left-0 right-0 z-40 mx-auto w-full max-w-md px-4 pointer-events-none">
            <div className="grid grid-cols-2 gap-3 rounded-[28px] border border-zinc-200/80 bg-white/88 p-3 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/8 dark:bg-zinc-900/84 dark:shadow-[0_22px_52px_rgba(0,0,0,0.34)] pointer-events-auto">
              {canCreateMovementLogs && (
                <button onClick={openScanModal} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[22px] bg-gradient-to-r from-orange-500 to-orange-400 py-4 text-black shadow-[0_16px_28px_rgba(249,115,22,0.28)] transition-all active:scale-95">
                  <span className="material-symbols-outlined mb-0.5 text-2xl">qr_code_scanner</span>
                  <span className="font-label text-[11px] font-black uppercase tracking-wider">Scan QR</span>
                </button>
              )}
              {canCreateCameraRequests && (
                <button onClick={openRequestModal} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[22px] border border-zinc-200 bg-white py-4 text-zinc-900 shadow-[0_14px_24px_rgba(15,23,42,0.08)] transition-all active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                  <span className="material-symbols-outlined mb-0.5 text-2xl text-orange-500">shopping_cart_checkout</span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-wider text-orange-500">Request</span>
                </button>
              )}
            </div>
          </div>
        )}

        <nav ref={bottomNavRef} className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex h-[80px] max-w-md items-center justify-around rounded-[30px] border border-zinc-200/80 bg-white/88 px-2 pb-safe shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/8 dark:bg-zinc-950/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
          {[
            { id: 'home', icon: 'home', label: 'Home' },
            { id: 'activity', icon: 'history', label: 'Activity' },
            { id: 'reports', icon: 'report_problem', label: 'Reports' },
            { id: 'alerts', icon: 'notifications_active', label: 'Alerts' },
            { id: 'wishlist', icon: 'favorite', label: 'Wishlist' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as any)}
              className={`flex w-16 flex-col items-center justify-center gap-1 rounded-[20px] py-2 transition-all duration-200 ${activeMobileTab === tab.id ? 'bg-orange-500/12 text-orange-500 dark:bg-orange-500/16' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
            >
               <span className={`material-symbols-outlined text-2xl transition-transform duration-300 ${activeMobileTab === tab.id ? 'scale-110' : ''}`} style={activeMobileTab === tab.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
               <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
