import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ActionFeedbackToast } from '@/components/shared/ActionFeedbackToast'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import {
  canApproveArtExpense,
  canCreateArtExpense,
  canDeleteArtExpense,
  canDeleteArtProps,
  canManageArtProps,
  canManageArtSets,
  canViewArtBudget,
  isArtDirector,
} from '@/features/auth/role-capabilities'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useArtData } from '@/modules/expenses/hooks/useArtData'
import type {
  ArtExpense,
  ArtExpenseApprovalStatus,
  ArtExpenseCategory,
  ArtProp,
  ArtPropSourcingType,
  ArtPropStatus,
  ArtSet,
  ArtSetStatus,
} from '@/modules/expenses/types'
import { artService } from '@/services/art.service'
import { approvalsService } from '@/services/approvals.service'
import { formatCurrency, formatDate, formatTime, timeAgo } from '@/utils'

const emptyExpenseForm = {
  description: '',
  category: 'construction' as ArtExpenseCategory,
  quantity: '1',
  amount: '',
  receipt: null as File | null,
}

const emptyPropForm = {
  propName: '',
  category: '',
  sourcingType: 'sourced' as ArtPropSourcingType,
  status: 'in_storage' as ArtPropStatus,
  vendorName: '',
  returnDueDate: '',
}

const emptySetForm = {
  setName: '',
  estimatedCost: '',
  actualCost: '',
  status: 'planned' as ArtSetStatus,
  progressPercentage: '0',
}

function formatDateTime(value: string) {
  return `${formatDate(value)} | ${formatTime(value)}`
}

function parseNonNegativeNumber(value: string, fieldLabel: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number.`)
  }

  return parsed
}

function parsePositiveInteger(value: string, fieldLabel: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldLabel} must be a whole number greater than 0.`)
  }

  return parsed
}

function parseProgress(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('Progress must be a whole number between 0 and 100.')
  }

  return parsed
}

function panelEmpty(title: string, description: string) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  )
}

function expenseCategoryLabel(category: ArtExpenseCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function expenseValidationBadge(expense: ArtExpense) {
  if (expense.status === 'anomaly') {
    return <StatusBadge variant="mismatch" label={String(expense.ocrData.mismatchLabel ?? 'Amount Not Matching')} />
  }

  if (expense.status === 'verified') {
    return <StatusBadge variant="active" label="Receipt Verified" />
  }

  return <StatusBadge variant="warning" label={expense.hasReceipt ? 'Receipt Pending Review' : 'Missing Receipt'} />
}

function expenseApprovalBadge(status: ArtExpenseApprovalStatus) {
  if (status === 'approved') {
    return <StatusBadge variant="approved" label="Approved" />
  }

  if (status === 'denied') {
    return <StatusBadge variant="rejected" label="Denied" />
  }

  if (status === 'pending_art_director') {
    return <StatusBadge variant="pending" label="Pending Art Director" />
  }

  return <StatusBadge variant="pending" label="Pending Producer" />
}

function expenseApprovalText(status: ArtExpenseApprovalStatus) {
  if (status === 'approved') return 'Producer approved'
  if (status === 'denied') return 'Denied'
  if (status === 'pending_art_director') return 'Waiting for Art Director'
  return 'Art Director approved | Waiting for Producer'
}

function propStatusBadge(status: ArtPropStatus) {
  if (status === 'missing') return <StatusBadge variant="rejected" label="Missing" />
  if (status === 'returned') return <StatusBadge variant="completed" label="Returned" />
  if (status === 'in_use') return <StatusBadge variant="active" label="In Use" />
  return <StatusBadge variant="stable" label="In Storage" />
}

function setStatusBadge(status: ArtSetStatus) {
  if (status === 'completed') return <StatusBadge variant="completed" label="Completed" />
  if (status === 'in_progress') return <StatusBadge variant="active" label="In Progress" />
  return <StatusBadge variant="pending" label="Planned" />
}

type StatCard = {
  label: string
  value: string
  subLabel: string
  subType?: 'warning' | 'critical' | 'default' | 'success'
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
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  type?: InputHTMLAttributes<HTMLInputElement>['type']
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
        type={type}
      />
    </div>
  )
}

function ExpenseModal({
  open,
  form,
  isSubmitting,
  onClose,
  onSubmit,
  onTextChange,
  onReceiptChange,
  onPreviewReceipt,
}: {
  open: boolean
  form: typeof emptyExpenseForm
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onTextChange: (field: 'description' | 'category' | 'quantity' | 'amount', value: string) => void
  onReceiptChange: (file: File | null) => void
  onPreviewReceipt: () => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Petty Cash"
      title="Add Expense"
      description="Capture a petty cash expense, upload the receipt, and store OCR validation output."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel="Save Expense"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ModalField label="Description" className="sm:col-span-2">
          <ModalTextInput
            value={form.description}
            onChange={value => onTextChange('description', value)}
            placeholder="Vendor or item name"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Category">
          <select
            value={form.category}
            onChange={event => onTextChange('category', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="construction">Construction</option>
            <option value="props">Props</option>
            <option value="materials">Materials</option>
            <option value="misc">Misc</option>
          </select>
        </ModalField>

        <ModalField label="Amount">
          <ModalTextInput
            value={form.amount}
            onChange={value => onTextChange('amount', value)}
            placeholder="0"
            disabled={isSubmitting}
            inputMode="decimal"
          />
        </ModalField>

        <ModalField label="Quantity">
          <ModalTextInput
            value={form.quantity}
            onChange={value => onTextChange('quantity', value)}
            placeholder="1"
            disabled={isSubmitting}
            inputMode="numeric"
          />
        </ModalField>

        <ModalField label="Receipt" className="sm:col-span-2">
          <div className="project-modal-input-shell">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={event => onReceiptChange(event.target.files?.[0] ?? null)}
              className="project-modal-input file:mr-3 file:border-0 file:bg-transparent file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.14em]"
              disabled={isSubmitting}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {form.receipt ? `Selected: ${form.receipt.name}` : 'Optional, but missing receipts will appear in alerts.'}
            </p>
            {form.receipt && (
              <button type="button" onClick={onPreviewReceipt} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                Preview
              </button>
            )}
          </div>
        </ModalField>
      </div>
    </ModalShell>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <Surface variant="table" padding="lg" className="w-full max-w-md border border-zinc-200 shadow-2xl dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Confirmation</p>
            <h2 className="section-title">{title}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost px-3 py-2 text-[10px]">
            Close
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="rounded-full bg-red-500 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-red-400 disabled:opacity-60">
            {isSubmitting ? 'Removing...' : confirmLabel}
          </button>
        </div>
      </Surface>
    </div>
  )
}

function ReceiptPreviewModal({
  open,
  title,
  previewUrl,
  fileName,
  onClose,
}: {
  open: boolean
  title: string
  previewUrl: string | null
  fileName: string | null
  onClose: () => void
}) {
  if (!open || !previewUrl) {
    return null
  }

  const isPdf = (fileName ?? previewUrl).toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <Surface variant="table" padding="lg" className="w-full max-w-4xl border border-zinc-200 shadow-2xl dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Receipt Preview</p>
            <h2 className="section-title">{title}</h2>
            {fileName && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{fileName}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost px-3 py-2 text-[10px]">
            Close
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          {isPdf ? (
            <iframe src={previewUrl} title={title} className="h-[70vh] w-full" />
          ) : (
            <img src={previewUrl} alt={title} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>
      </Surface>
    </div>
  )
}

function PropModal({
  open,
  mode,
  form,
  selectedProp,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  mode: 'create' | 'edit'
  form: typeof emptyPropForm
  selectedProp: ArtProp | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptyPropForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Props"
      title={mode === 'edit' ? 'Update Prop' : 'Add Prop'}
      description="Track sourced and hired props through storage, on-set use, return, or missing status."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel={mode === 'edit' ? 'Save Changes' : 'Add Prop'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'edit' && selectedProp ? (
          <div className="sm:col-span-2 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedProp.propName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {selectedProp.category} | {selectedProp.sourcingType}
            </p>
          </div>
        ) : (
          <>
            <ModalField label="Prop Name" className="sm:col-span-2">
              <ModalTextInput
                value={form.propName}
                onChange={value => onChange('propName', value)}
                placeholder="Dining table hero prop"
                disabled={isSubmitting}
              />
            </ModalField>

            <ModalField label="Category">
              <ModalTextInput
                value={form.category}
                onChange={value => onChange('category', value)}
                placeholder="Furniture"
                disabled={isSubmitting}
              />
            </ModalField>

            <ModalField label="Sourcing Type">
              <select
                value={form.sourcingType}
                onChange={event => onChange('sourcingType', event.target.value)}
                className="project-modal-select"
                disabled={isSubmitting}
              >
                <option value="sourced">Sourced</option>
                <option value="hired">Hired</option>
              </select>
            </ModalField>
          </>
        )}

        <ModalField label="Status">
          <select
            value={form.status}
            onChange={event => onChange('status', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="in_storage">In Storage</option>
            <option value="in_use">In Use</option>
            <option value="returned">Returned</option>
            <option value="missing">Missing</option>
          </select>
        </ModalField>

        <ModalField label="Vendor">
          <ModalTextInput
            value={form.vendorName}
            onChange={value => onChange('vendorName', value)}
            placeholder="Optional vendor"
            disabled={isSubmitting}
          />
        </ModalField>

        <ModalField label="Return Due Date" className="sm:col-span-2">
          <ModalTextInput
            value={form.returnDueDate}
            onChange={value => onChange('returnDueDate', value)}
            placeholder=""
            disabled={isSubmitting}
            type="date"
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

function SetModal({
  open,
  mode,
  form,
  selectedSet,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean
  mode: 'create' | 'edit'
  form: typeof emptySetForm
  selectedSet: ArtSet | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (field: keyof typeof emptySetForm, value: string) => void
}) {
  return (
    <ModalShell
      open={open}
      kicker="Set Builds"
      title={mode === 'edit' ? 'Update Set Construction' : 'Create Set Entry'}
      description="Track estimated cost, actual spend, and build progress for the art department."
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      primaryLabel={mode === 'edit' ? 'Save Changes' : 'Create Set'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'edit' && selectedSet ? (
          <div className="sm:col-span-2 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedSet.setName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Current progress {selectedSet.progressPercentage}%
            </p>
          </div>
        ) : (
          <ModalField label="Set Name" className="sm:col-span-2">
            <ModalTextInput
              value={form.setName}
              onChange={value => onChange('setName', value)}
              placeholder="Living room build"
              disabled={isSubmitting}
            />
          </ModalField>
        )}

        <ModalField label="Estimated Cost">
          <ModalTextInput
            value={form.estimatedCost}
            onChange={value => onChange('estimatedCost', value)}
            placeholder="0"
            disabled={isSubmitting}
            inputMode="decimal"
          />
        </ModalField>

        <ModalField label="Actual Cost">
          <ModalTextInput
            value={form.actualCost}
            onChange={value => onChange('actualCost', value)}
            placeholder="0"
            disabled={isSubmitting}
            inputMode="decimal"
          />
        </ModalField>

        <ModalField label="Status">
          <select
            value={form.status}
            onChange={event => onChange('status', event.target.value)}
            className="project-modal-select"
            disabled={isSubmitting}
          >
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </ModalField>

        <ModalField label="Progress %">
          <ModalTextInput
            value={form.progressPercentage}
            onChange={value => onChange('progressPercentage', value)}
            placeholder="0"
            disabled={isSubmitting}
            inputMode="numeric"
          />
        </ModalField>
      </div>
    </ModalShell>
  )
}

export function ExpensesView() {
  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'expenses' | 'props' | 'sets'>('home')
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext } = useResolvedProjectContext()
  const canCreateExpenses = canCreateArtExpense(user)
  const canRemoveExpenses = canDeleteArtExpense(user)
  const canManagePropsAccess = canManageArtProps(user)
  const canRemoveProps = canDeleteArtProps(user)
  const canManageSetsAccess = canManageArtSets(user)
  const canViewBudgetAccess = canViewArtBudget(user)
  const canApproveExpenseAsProducer = canApproveArtExpense(user)
  const canApproveExpenseAsArtDirector = isArtDirector(user)
  const { expenses, props, sets, budget, alerts, isLoading, isError } = useArtData(activeProjectId, { includeBudget: canViewBudgetAccess })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm)
  const [propModalOpen, setPropModalOpen] = useState(false)
  const [propModalMode, setPropModalMode] = useState<'create' | 'edit'>('create')
  const [selectedProp, setSelectedProp] = useState<ArtProp | null>(null)
  const [propForm, setPropForm] = useState(emptyPropForm)
  const [setModalOpen, setSetModalOpen] = useState(false)
  const [setModalMode, setSetModalMode] = useState<'create' | 'edit'>('create')
  const [selectedSet, setSelectedSet] = useState<ArtSet | null>(null)
  const [setForm, setSetForm] = useState(emptySetForm)
  const [receiptPreview, setReceiptPreview] = useState<{
    title: string
    previewUrl: string | null
    fileName: string | null
    objectUrl?: string | null
  } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    action: (() => Promise<void>) | null
  } | null>(null)

  const createExpenseMutation = useMutation({ mutationFn: artService.createExpense })
  const approveExpenseMutation = useMutation({
    mutationFn: ({ projectId, approvalId }: { projectId: string; approvalId: string }) => approvalsService.approveItem(projectId, approvalId),
  })
  const denyExpenseMutation = useMutation({
    mutationFn: ({ projectId, approvalId }: { projectId: string; approvalId: string }) => approvalsService.rejectItem(projectId, approvalId),
  })
  const deleteExpenseMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => artService.deleteExpense(projectId, id),
  })
  const createPropMutation = useMutation({ mutationFn: artService.createProp })
  const updatePropMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof artService.updateProp>[1] }) => artService.updateProp(id, input),
  })
  const deletePropMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => artService.deleteProp(projectId, id),
  })
  const createSetMutation = useMutation({ mutationFn: artService.createSet })
  const updateSetMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof artService.updateSet>[1] }) => artService.updateSet(id, input),
  })

  const activeSets = sets.filter(set => set.status === 'in_progress').length
  const missingReceipts = expenses.filter(expense => !expense.hasReceipt).length
  const overdueProps = props.filter(prop => prop.isOverdue || prop.status === 'missing').length
  const criticalAlerts = alerts.filter(alert => alert.type === 'critical')
  const desktopStatCards: StatCard[] = canViewBudgetAccess && budget
    ? [
        {
          label: 'Art Spend',
          value: formatCurrency(budget.usedBudget),
          subLabel: `${expenses.length} logged expenses`,
          subType: missingReceipts > 0 ? 'warning' : 'default',
        },
        {
          label: 'Remaining Budget',
          value: formatCurrency(budget.remainingBudget),
          subLabel: budget.isExceeded ? 'Budget exceeded' : 'Current buffer',
          subType: budget.isExceeded ? 'critical' : 'success',
        },
      ]
    : [
        {
          label: 'Expenses Logged',
          value: String(expenses.length),
          subLabel: `${missingReceipts} missing receipts`,
          subType: missingReceipts > 0 ? 'warning' : 'default',
        },
      ]
  const desktopStats: StatCard[] = [
    ...desktopStatCards,
    {
      label: 'Props Tracked',
      value: String(props.length),
      subLabel: `${overdueProps} flagged returns or missing`,
      subType: overdueProps > 0 ? 'warning' : 'default',
    },
    {
      label: 'Set Builds',
      value: String(sets.length),
      subLabel: `${activeSets} active construction lines`,
      subType: activeSets > 0 ? 'warning' : 'default',
    },
  ]
  const mobileStats = [
    ...(canViewBudgetAccess && budget
      ? [
          { label: 'Art Spend', value: formatCurrency(budget.usedBudget), icon: 'payments', tone: 'text-orange-500' },
          {
            label: 'Remaining',
            value: formatCurrency(budget.remainingBudget),
            icon: 'account_balance_wallet',
            tone: budget.isExceeded ? 'text-red-500' : 'text-emerald-500',
          },
        ]
      : []),
    { label: 'Expenses', value: String(expenses.length), icon: 'receipt_long', tone: missingReceipts > 0 ? 'text-amber-500' : 'text-orange-500' },
    { label: 'Props', value: String(props.length), icon: 'category', tone: overdueProps > 0 ? 'text-red-500' : 'text-sky-500' },
    { label: 'Set Builds', value: String(sets.length), icon: 'foundation', tone: 'text-orange-500' },
  ]

  async function refreshArtQueries() {
    if (!activeProjectId) {
      return
    }

    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['art-expenses', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['art-props', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['art-sets', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['art-budget', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['art-alerts', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['alerts', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['pending-approvals', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['approval-history', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['approvals-kpis', activeProjectId] }),
      queryClient.invalidateQueries({ queryKey: ['activity', activeProjectId] }),
    ])
  }

  async function runArtAction(action: () => Promise<unknown>, successMessage: string) {
    setFeedback(null)

    try {
      await action()
      await refreshArtQueries()
      setFeedback({ type: 'success', message: successMessage })
      return true
    } catch (error) {
      await refreshArtQueries()
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Art module action failed.',
      })
      return false
    }
  }

  function resetExpenseModal() {
    setExpenseForm(emptyExpenseForm)
    setExpenseModalOpen(false)
  }

  function openExpenseModal() {
    if (!canCreateExpenses) {
      setFeedback({ type: 'error', message: 'This role cannot log art expenses.' })
      return
    }

    setFeedback(null)
    setExpenseForm(emptyExpenseForm)
    setExpenseModalOpen(true)
  }

  function closeReceiptPreview() {
    if (receiptPreview?.objectUrl) {
      URL.revokeObjectURL(receiptPreview.objectUrl)
    }

    setReceiptPreview(null)
  }

  function openDraftReceiptPreview() {
    if (!expenseForm.receipt) {
      return
    }

    const objectUrl = URL.createObjectURL(expenseForm.receipt)
    setReceiptPreview({
      title: 'Draft Receipt Preview',
      previewUrl: objectUrl,
      fileName: expenseForm.receipt.name,
      objectUrl,
    })
  }

  function openUploadedReceiptPreview(expense: ArtExpense) {
    if (!expense.receiptUrl) {
      return
    }

    setReceiptPreview({
      title: `${expense.description} Receipt`,
      previewUrl: expense.receiptUrl,
      fileName: expense.receiptFileName,
    })
  }

  function updateExpenseForm(field: 'description' | 'category' | 'quantity' | 'amount', value: string) {
    setExpenseForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateExpense() {
    if (!activeProjectId) {
      return
    }

    if (!canCreateExpenses) {
      setFeedback({ type: 'error', message: 'This role cannot log art expenses.' })
      return
    }

    try {
      const description = expenseForm.description.trim()
      if (!description) {
        setFeedback({ type: 'error', message: 'Expense description is required.' })
        return
      }

      const manualAmount = parseNonNegativeNumber(expenseForm.amount, 'Amount')
      const quantity = parsePositiveInteger(expenseForm.quantity, 'Quantity')
      setFeedback(null)

      const result = await createExpenseMutation.mutateAsync({
        projectId: activeProjectId,
        description,
        category: expenseForm.category,
        quantity,
        manualAmount,
        receipt: expenseForm.receipt,
      })

      await refreshArtQueries()
      resetExpenseModal()
      setFeedback({
        type: result.anomaly ? 'error' : 'success',
        message: result.message,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Please check the expense values.',
      })
    }
  }

  async function handleDeleteExpense(expense: ArtExpense) {
    if (!activeProjectId) {
      return
    }

    if (!canRemoveExpenses) {
      setFeedback({ type: 'error', message: 'Only the Art Director can remove expenses.' })
      return
    }

    setConfirmDialog({
      title: 'Remove Expense',
      message: `Remove "${expense.description}" from art expenses?`,
      confirmLabel: 'Remove Expense',
      action: async () => {
        const removed = await runArtAction(
          () => deleteExpenseMutation.mutateAsync({ projectId: activeProjectId, id: expense.id }),
          'Expense removed.',
        )

        if (removed) {
          setConfirmDialog(null)
        }
      },
    })
  }

  async function handleExpenseApproval(expense: ArtExpense, decision: 'approved' | 'denied') {
    const canApproveCurrentExpense = (
      (canApproveExpenseAsArtDirector && expense.approvalStatus === 'pending_art_director')
      || (canApproveExpenseAsProducer && expense.approvalStatus === 'pending_producer')
    )

    if (!canApproveCurrentExpense) {
      setFeedback({
        type: 'error',
        message: expense.approvalStatus === 'pending_art_director'
          ? 'Only the Art Director can approve or deny this expense at this stage.'
          : 'Only production leadership can approve or deny this expense at this stage.',
      })
      return
    }

    if (!activeProjectId || !expense.approvalId) {
      setFeedback({ type: 'error', message: 'This expense is missing an approval record.' })
      return
    }

    const mutation = decision === 'approved' ? approveExpenseMutation : denyExpenseMutation
    const message = decision === 'approved' ? 'Expense approved.' : 'Expense denied.'

    await runArtAction(
      () => mutation.mutateAsync({ projectId: activeProjectId, approvalId: expense.approvalId! }),
      message,
    )
  }

  function resetPropModal() {
    setPropModalMode('create')
    setSelectedProp(null)
    setPropForm(emptyPropForm)
    setPropModalOpen(false)
  }

  function openCreatePropModal() {
    if (!canManagePropsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage props.' })
      return
    }

    setFeedback(null)
    setPropModalMode('create')
    setSelectedProp(null)
    setPropForm(emptyPropForm)
    setPropModalOpen(true)
  }

  function openEditPropModal(prop: ArtProp) {
    if (!canManagePropsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage props.' })
      return
    }

    setFeedback(null)
    setPropModalMode('edit')
    setSelectedProp(prop)
    setPropForm({
      propName: prop.propName,
      category: prop.category,
      sourcingType: prop.sourcingType,
      status: prop.status,
      vendorName: prop.vendorName ?? '',
      returnDueDate: prop.returnDueDate ?? '',
    })
    setPropModalOpen(true)
  }

  function updatePropForm(field: keyof typeof emptyPropForm, value: string) {
    setPropForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSaveProp() {
    if (!activeProjectId) {
      return
    }

    if (!canManagePropsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage props.' })
      return
    }

    const isEdit = propModalMode === 'edit' && selectedProp
    try {
      if (!isEdit) {
        const propName = propForm.propName.trim()
        const category = propForm.category.trim()
        if (!propName || !category) {
          setFeedback({ type: 'error', message: 'Prop name and category are required.' })
          return
        }

        const created = await runArtAction(
          () =>
            createPropMutation.mutateAsync({
              projectId: activeProjectId,
              propName,
              category,
              sourcingType: propForm.sourcingType,
              status: propForm.status,
              vendorName: propForm.vendorName.trim() || undefined,
              returnDueDate: propForm.returnDueDate || undefined,
            }),
          'Prop added to inventory.',
        )

        if (created) {
          resetPropModal()
        }

        return
      }

      const updated = await runArtAction(
        () =>
          updatePropMutation.mutateAsync({
            id: selectedProp.id,
            input: {
              projectId: activeProjectId,
              status: propForm.status,
              vendorName: propForm.vendorName.trim() || undefined,
              returnDueDate: propForm.returnDueDate || undefined,
            },
          }),
        'Prop status updated.',
      )

      if (updated) {
        resetPropModal()
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save the prop record.',
      })
    }
  }

  async function handleDeleteProp(prop: ArtProp) {
    if (!activeProjectId) {
      return
    }

    if (!canRemoveProps) {
      setFeedback({ type: 'error', message: 'Only the Art Director can remove props.' })
      return
    }

    setConfirmDialog({
      title: 'Remove Prop',
      message: `Remove "${prop.propName}" from props inventory?`,
      confirmLabel: 'Remove Prop',
      action: async () => {
        const removed = await runArtAction(
          () => deletePropMutation.mutateAsync({ projectId: activeProjectId, id: prop.id }),
          'Prop removed from inventory.',
        )

        if (removed) {
          setConfirmDialog(null)
        }
      },
    })
  }

  function resetSetModal() {
    setSetModalMode('create')
    setSelectedSet(null)
    setSetForm(emptySetForm)
    setSetModalOpen(false)
  }

  function openCreateSetModal() {
    if (!canManageSetsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage set builds.' })
      return
    }

    setFeedback(null)
    setSetModalMode('create')
    setSelectedSet(null)
    setSetForm(emptySetForm)
    setSetModalOpen(true)
  }

  function openEditSetModal(set: ArtSet) {
    if (!canManageSetsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage set builds.' })
      return
    }

    setFeedback(null)
    setSetModalMode('edit')
    setSelectedSet(set)
    setSetForm({
      setName: set.setName,
      estimatedCost: String(set.estimatedCost),
      actualCost: String(set.actualCost),
      status: set.status,
      progressPercentage: String(set.progressPercentage),
    })
    setSetModalOpen(true)
  }

  function updateSetForm(field: keyof typeof emptySetForm, value: string) {
    setSetForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSaveSet() {
    if (!activeProjectId) {
      return
    }

    if (!canManageSetsAccess) {
      setFeedback({ type: 'error', message: 'This role cannot manage set builds.' })
      return
    }

    try {
      const estimatedCost = parseNonNegativeNumber(setForm.estimatedCost || '0', 'Estimated cost')
      const actualCost = parseNonNegativeNumber(setForm.actualCost || '0', 'Actual cost')
      const progressPercentage = parseProgress(setForm.progressPercentage || '0')

      if (setModalMode === 'create') {
        const setName = setForm.setName.trim()
        if (!setName) {
          setFeedback({ type: 'error', message: 'Set name is required.' })
          return
        }

        const created = await runArtAction(
          () =>
            createSetMutation.mutateAsync({
              projectId: activeProjectId,
              setName,
              estimatedCost,
              actualCost,
              status: setForm.status,
              progressPercentage,
            }),
          'Set construction entry created.',
        )

        if (created) {
          resetSetModal()
        }

        return
      }

      if (!selectedSet) {
        return
      }

      const updated = await runArtAction(
        () =>
          updateSetMutation.mutateAsync({
            id: selectedSet.id,
            input: {
              projectId: activeProjectId,
              estimatedCost,
              actualCost,
              status: setForm.status,
              progressPercentage,
            },
          }),
        'Set construction updated.',
      )

      if (updated) {
        resetSetModal()
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save the set record.',
      })
    }
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
            description="Art operations are project-scoped. Choose an active project before tracking expenses, props, or set builds."
          />
        </Surface>
      </div>
    )
  }

  if (isLoading) return <LoadingState message="Loading art operations..." />
  if (isError || (canViewBudgetAccess && !budget)) return <ErrorState message="Failed to load art module data" />

  return (
    <div className="page-shell space-y-6">
      <ActionFeedbackToast feedback={feedback} onDismiss={() => setFeedback(null)} />

      <ExpenseModal
        open={expenseModalOpen}
        form={expenseForm}
        isSubmitting={createExpenseMutation.isPending}
        onClose={resetExpenseModal}
        onSubmit={handleCreateExpense}
        onTextChange={updateExpenseForm}
        onReceiptChange={file => setExpenseForm(current => ({ ...current, receipt: file }))}
        onPreviewReceipt={openDraftReceiptPreview}
      />

      <PropModal
        open={propModalOpen}
        mode={propModalMode}
        form={propForm}
        selectedProp={selectedProp}
        isSubmitting={createPropMutation.isPending || updatePropMutation.isPending}
        onClose={resetPropModal}
        onSubmit={handleSaveProp}
        onChange={updatePropForm}
      />

      <SetModal
        open={setModalOpen}
        mode={setModalMode}
        form={setForm}
        selectedSet={selectedSet}
        isSubmitting={createSetMutation.isPending || updateSetMutation.isPending}
        onClose={resetSetModal}
        onSubmit={handleSaveSet}
        onChange={updateSetForm}
      />

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title ?? 'Confirm Action'}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel ?? 'Confirm'}
        isSubmitting={deleteExpenseMutation.isPending || deletePropMutation.isPending}
        onClose={() => {
          if (!deleteExpenseMutation.isPending && !deletePropMutation.isPending) {
            setConfirmDialog(null)
          }
        }}
        onConfirm={() => {
          void confirmDialog?.action?.()
        }}
      />

      <ReceiptPreviewModal
        open={Boolean(receiptPreview?.previewUrl)}
        title={receiptPreview?.title ?? 'Receipt Preview'}
        previewUrl={receiptPreview?.previewUrl ?? null}
        fileName={receiptPreview?.fileName ?? null}
        onClose={closeReceiptPreview}
      />

      <div className="hidden md:block space-y-6">
        <header className="page-header">
        <div>
          <span className="page-kicker">{canViewBudgetAccess ? 'Budget Tracking' : 'Art Operations'}</span>
          <h1 className="page-title page-title-compact">Art & Expenses</h1>
          <p className="page-subtitle">
            {canViewBudgetAccess
              ? `Live petty cash, props, set builds, and budget visibility for ${activeProject.name}.`
              : `Track petty cash, props, and set builds for ${activeProject.name}.`}
          </p>
        </div>

        <div className="page-toolbar">
          {canCreateExpenses && (
            <button onClick={openExpenseModal} className="btn-soft">
              Add Expense
            </button>
          )}
          {canManagePropsAccess && (
            <button onClick={openCreatePropModal} className="btn-soft">
              Add Prop
            </button>
          )}
          {canManageSetsAccess && (
            <button onClick={openCreateSetModal} className="btn-primary">
              Add Set
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {desktopStats.map(card => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            subLabel={card.subLabel}
            subType={card.subType}
          />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader
              kicker="Finance"
              title="Petty Cash & Receipts"
              action={canCreateExpenses ? (
                <button onClick={openExpenseModal} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                  Add Expense
                </button>
              ) : undefined}
            />

            {expenses.length === 0 ? (
              panelEmpty('No expenses logged yet', 'Start recording art department spend with receipts and OCR-ready previews.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {expenses.map(expense => (
                  <div key={expense.id} className="px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{expense.description}</p>
                          {expenseValidationBadge(expense)}
                          {expenseApprovalBadge(expense.approvalStatus)}
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          {expenseCategoryLabel(expense.category)} | Qty {expense.quantity} | Logged by {expense.createdByName ?? 'ProdSync User'} | {formatDateTime(expense.createdAt)}
                        </p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          Approval status: {expenseApprovalText(expense.approvalStatus)}
                          {expense.reviewedAt ? ` | ${formatDateTime(expense.reviewedAt)}` : ''}
                          {expense.reviewedByName ? ` | ${expense.reviewedByName}` : ''}
                        </p>
                        {expense.approvalNote && (
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{expense.approvalNote}</p>
                        )}
                        {(((canApproveExpenseAsArtDirector && expense.approvalStatus === 'pending_art_director')
                          || (canApproveExpenseAsProducer && expense.approvalStatus === 'pending_producer'))
                          && expense.approvalId) && (
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button
                              onClick={() => void handleExpenseApproval(expense, 'approved')}
                              disabled={approveExpenseMutation.isPending || denyExpenseMutation.isPending}
                              className="btn-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] disabled:opacity-60"
                            >
                              {approveExpenseMutation.isPending ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => void handleExpenseApproval(expense, 'denied')}
                              disabled={approveExpenseMutation.isPending || denyExpenseMutation.isPending}
                              className="btn-ghost px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-500 dark:text-red-400 disabled:opacity-60"
                            >
                              {denyExpenseMutation.isPending ? 'Denying...' : 'Deny'}
                            </button>
                          </div>
                        )}
                        <p className="mt-3 text-lg font-semibold text-zinc-900 dark:text-white">{formatCurrency(expense.manualAmount)}</p>
                        {expense.receiptUrl && (
                          <button onClick={() => openUploadedReceiptPreview(expense)} className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                            Preview Receipt
                          </button>
                        )}
                      </div>

                      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">OCR Snapshot</p>
                        <p className="mt-3 text-sm text-zinc-900 dark:text-white">
                          Entered amount: {formatCurrency(expense.manualAmount)}
                        </p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          Receipt amount: {formatCurrency(expense.extractedAmount)}
                        </p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          Entered quantity: {expense.quantity}
                        </p>
                        {typeof expense.ocrData.extractedQuantity === 'number' && (
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Receipt quantity: {Number(expense.ocrData.extractedQuantity)}
                          </p>
                        )}
                        {expense.status === 'anomaly' && (
                          <p className="mt-2 text-sm font-medium text-red-500 dark:text-red-400">
                            {String(expense.ocrData.mismatchLabel ?? expense.ocrData.anomalyMessage ?? 'Amount Not Matching')}
                          </p>
                        )}
                        {canRemoveExpenses && (
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => handleDeleteExpense(expense)} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-500 hover:text-red-400">
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader
              kicker="Construction"
              title="Set Builds"
              action={canManageSetsAccess ? (
                <button onClick={openCreateSetModal} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                  Add Set
                </button>
              ) : undefined}
            />

            {sets.length === 0 ? (
              panelEmpty('No set construction entries', 'Create a set line to track build progress and estimated versus actual spend.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sets.map(set => (
                  <div key={set.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{set.setName}</p>
                        {setStatusBadge(set.status)}
                        {set.isOverBudget && <StatusBadge variant="over" label="Over Budget" />}
                      </div>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Progress {set.progressPercentage}% | Estimated {formatCurrency(set.estimatedCost)} | Actual {formatCurrency(set.actualCost)}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                        Updated {timeAgo(set.updatedAt)}
                      </p>
                    </div>

                    {canManageSetsAccess && (
                      <button onClick={() => openEditSetModal(set)} className="btn-ghost px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Update
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>

        <div className="space-y-6">
          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader
              kicker="Inventory"
              title="Props Lifecycle"
              action={canManagePropsAccess ? (
                <button onClick={openCreatePropModal} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600 hover:text-orange-500 dark:text-orange-400">
                  Add Prop
                </button>
              ) : undefined}
            />

            {props.length === 0 ? (
              panelEmpty('No props added yet', 'Track sourced and hired props here to keep returns and storage visible.')
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {props.map(prop => (
                  <div key={prop.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{prop.propName}</p>
                      {propStatusBadge(prop.status)}
                      {prop.isOverdue && <StatusBadge variant="warning" label="Overdue Return" />}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {prop.category} | {prop.sourcingType} {prop.vendorName ? `| ${prop.vendorName}` : ''}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                      {prop.returnDueDate ? `Return due ${formatDate(prop.returnDueDate)}` : 'No return due date'} | Added {timeAgo(prop.createdAt)}
                    </p>
                    {(canManagePropsAccess || canRemoveProps) && (
                      <div className="mt-4 flex gap-3">
                        {canManagePropsAccess && (
                          <button onClick={() => openEditPropModal(prop)} className="btn-ghost px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                            Update
                          </button>
                        )}
                        {canRemoveProps && (
                          <button onClick={() => handleDeleteProp(prop)} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-500 hover:text-red-400">
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Surface>

          {canViewBudgetAccess && budget && (
            <Surface variant="table" padding="none" className="overflow-hidden">
              <SectionHeader kicker="Budget" title="Budget vs Actual" />

              <div className="grid gap-4 px-6 py-5 sm:grid-cols-3">
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Allocated</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white">
                    {formatCurrency(budget.allocatedBudget)}
                  </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Used</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white">
                    {formatCurrency(budget.usedBudget)}
                  </p>
                </div>
                <div className={`rounded-3xl border px-4 py-4 ${budget.isExceeded ? 'border-red-200 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Remaining</p>
                  <p className="mt-3 text-2xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white">
                    {formatCurrency(budget.remainingBudget)}
                  </p>
                </div>
              </div>
            </Surface>
          )}

          <Surface variant="table" padding="none" className="overflow-hidden">
            <SectionHeader kicker="Alerts" title="Operational Alerts" />

            {alerts.length === 0 ? (
              panelEmpty('No active art alerts', 'Budget overruns, overdue returns, receipt gaps, and set issues will surface here automatically.')
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
            <span className="page-kicker text-orange-500">{canViewBudgetAccess ? 'Budget Tracking' : 'Art Operations'}</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Art & Expenses</h1>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
              {canViewBudgetAccess ? 'Track expenses, props, set builds, and budget' : 'Track expenses, props, and set builds'}
            </p>
          </div>
        </header>

        {activeMobileTab === 'home' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3 pt-6 pb-28">
            {criticalAlerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-orange-500/80 tracking-widest uppercase mb-2 px-1">Critical Alerts</h2>
                {criticalAlerts.map((alert, index) => (
                  <div key={`${alert.timestamp}-${index}`} className="rounded-[22px] border border-red-500/20 bg-red-500/10 p-4 shadow-[0_14px_32px_rgba(239,68,68,0.12)]">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined mt-0.5 text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{alert.message}</p>
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
                {mobileStats.map(card => (
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

            {canViewBudgetAccess && budget && (
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Budget Analytics</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.08)] min-w-0 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Allocated</div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white break-all w-full">{formatCurrency(budget.allocatedBudget)}</div>
                  </div>
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] min-w-0 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Used</div>
                    <div className="mt-2 text-xl font-black tracking-tight text-zinc-900 dark:text-white break-all w-full">{formatCurrency(budget.usedBudget)}</div>
                  </div>
                  <div className={`rounded-[24px] border p-4 min-w-0 shadow-[0_16px_34px_rgba(15,23,42,0.07)] ${budget.isExceeded ? 'border-red-200 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Remaining</div>
                    <div className="mt-2 text-xl font-black tracking-tight text-zinc-900 dark:text-white break-all w-full">{formatCurrency(budget.remainingBudget)}</div>
                  </div>
                </div>
              </section>
            )}

            {(canCreateExpenses || canManagePropsAccess || canManageSetsAccess) && (
              <div className="fixed bottom-[96px] left-3 right-3 z-30">
                <div className="flex flex-col gap-3 bg-white/90 dark:bg-[#0e0e0e]/85 p-4 rounded-[32px] border border-zinc-200/80 dark:border-white/5 shadow-2xl backdrop-blur-2xl">
                  {canCreateExpenses && (
                    <button onClick={openExpenseModal} className="w-full h-[56px] rounded-[16px] bg-orange-500 text-black font-bold flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      <span className="material-symbols-outlined font-bold text-[22px]">receipt_long</span>
                      Add Expense
                    </button>
                  )}
                  {(canManagePropsAccess || canManageSetsAccess) && (
                    <div className="grid grid-cols-2 gap-3">
                      {canManagePropsAccess && (
                        <button onClick={openCreatePropModal} className="h-[64px] bg-zinc-50 dark:bg-[#1c1c1e]/90 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                          <span className="material-symbols-outlined text-orange-500 text-[22px]">category</span>
                          Props
                        </button>
                      )}
                      {canManageSetsAccess && (
                        <button onClick={openCreateSetModal} className="h-[64px] bg-zinc-50 dark:bg-[#1c1c1e]/90 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white font-bold text-[10px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 active:scale-95 duration-200 uppercase shadow-sm">
                          <span className="material-symbols-outlined text-orange-500 text-[22px]">foundation</span>
                          Sets
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
        )}

        {activeMobileTab === 'expenses' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-28">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Petty Cash & Receipts</h2>
                {canCreateExpenses && (
                  <button onClick={openExpenseModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Add +
                  </button>
                )}
              </div>
              {expenses.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No expenses yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map(expense => (
                    <div key={expense.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl flex flex-col gap-3 shadow-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                             <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-400">receipt_long</span>
                          </div>
                          <div className="flex-1 min-w-0">
                             <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{expense.description}</h3>
                             <div className="flex items-center gap-2 mt-1">
                               <div className="scale-90 origin-left">
                                 {expenseValidationBadge(expense)}
                               </div>
                               <div className="scale-90 origin-left">
                                 {expenseApprovalBadge(expense.approvalStatus)}
                               </div>
                             </div>
                             <p className="text-[10px] text-zinc-500 mt-1">{expenseApprovalText(expense.approvalStatus)}</p>
                              {expense.approvalNote && (
                                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{expense.approvalNote}</p>
                              )}
                              {(((canApproveExpenseAsArtDirector && expense.approvalStatus === 'pending_art_director')
                                || (canApproveExpenseAsProducer && expense.approvalStatus === 'pending_producer'))
                                && expense.approvalId) && (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    onClick={() => void handleExpenseApproval(expense, 'approved')}
                                    disabled={approveExpenseMutation.isPending || denyExpenseMutation.isPending}
                                    className="rounded-lg bg-orange-500 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black disabled:opacity-60"
                                  >
                                    {approveExpenseMutation.isPending ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => void handleExpenseApproval(expense, 'denied')}
                                    disabled={approveExpenseMutation.isPending || denyExpenseMutation.isPending}
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500 dark:border-zinc-700 disabled:opacity-60"
                                  >
                                    {denyExpenseMutation.isPending ? 'Denying...' : 'Deny'}
                                  </button>
                                </div>
                              )}
                             <p className="text-[10px] text-zinc-500 mt-1 capitalize">{expenseCategoryLabel(expense.category)} • Qty: {expense.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                           <div className="text-lg font-black text-zinc-900 dark:text-white">{formatCurrency(expense.manualAmount)}</div>
                           <div className="text-[10px] text-zinc-500 mt-1">{formatDate(expense.createdAt)}</div>
                        </div>
                      </div>
                      {(expense.status === 'anomaly' || expense.receiptUrl) && (
                         <div className="mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col gap-2">
                           {expense.status === 'anomaly' && (
                             <div className="bg-red-500/10 p-2 text-xs text-red-400 rounded border border-red-500/20 leading-relaxed font-medium">
                               <span className="font-bold">OCR Mismatch:</span> Receipt shows {formatCurrency(expense.extractedAmount)} with quantity {typeof expense.ocrData.extractedQuantity === 'number' ? Number(expense.ocrData.extractedQuantity) : 'unknown'}
                             </div>
                           )}
                           <div className="flex justify-between items-center mt-1">
                              {expense.receiptUrl && (
                                 <button onClick={() => openUploadedReceiptPreview(expense)} className="text-[10px] uppercase font-bold tracking-widest text-orange-500 flex items-center gap-1">
                                    Preview Receipt <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                 </button>
                              )}
                              {canRemoveExpenses && (
                                <button onClick={() => handleDeleteExpense(expense)} className="text-[10px] font-bold tracking-widest text-red-500 uppercase flex items-center gap-1 ml-auto">
                                   <span className="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                              )}
                           </div>
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {canCreateExpenses && (
              <div className="pt-6">
                <button onClick={openExpenseModal} className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-[22px] bg-gradient-to-r from-orange-500 to-orange-400 py-4 text-black shadow-[0_16px_28px_rgba(249,115,22,0.28)] transition-all active:scale-95">
                  <span className="material-symbols-outlined mb-0.5 text-2xl">payments</span>
                  <span className="font-label text-[11px] font-black uppercase tracking-wider">Add Expense</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeMobileTab === 'props' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-28">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Props Lifecycle</h2>
                {canManagePropsAccess && (
                  <button onClick={openCreatePropModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Add +
                  </button>
                )}
              </div>
              {props.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl text-center border border-zinc-200 dark:border-zinc-800">
                   <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No props tracked.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {props.map(prop => (
                    <div key={prop.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl flex flex-col gap-3 shadow-lg border border-zinc-200 dark:border-zinc-800">
                       <div className="flex justify-between items-start">
                         <div className="flex items-start gap-4">
                           <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                             <span className="material-symbols-outlined text-orange-500">inventory_2</span>
                           </div>
                           <div>
                             <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{prop.propName}</h3>
                             <div className="flex items-center gap-2 mt-1 scale-90 origin-left">
                               {propStatusBadge(prop.status)}
                               {prop.isOverdue && <StatusBadge variant="warning" label="Overdue" />}
                             </div>
                             <p className="text-[10px] text-zinc-500 mt-1 capitalize">{prop.category} • {prop.sourcingType}</p>
                           </div>
                         </div>
                       </div>
                       <div className="flex justify-between items-end mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/50">
                         <p className="text-[10px] text-zinc-500 min-h-3">{prop.returnDueDate ? `Due: ${formatDate(prop.returnDueDate)}` : ''}</p>
                         {(canRemoveProps || canManagePropsAccess) && (
                           <div className="flex gap-4 items-center">
                              {canRemoveProps && <button onClick={() => handleDeleteProp(prop)} className="material-symbols-outlined text-[16px] text-red-500">delete</button>}
                              {canManagePropsAccess && <button onClick={() => openEditPropModal(prop)} className="material-symbols-outlined text-[16px] text-zinc-500 dark:text-zinc-400">edit</button>}
                           </div>
                         )}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {canManagePropsAccess && (
              <div className="pt-6">
                <button onClick={openCreatePropModal} className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-[22px] border border-zinc-200 bg-white py-4 text-zinc-900 shadow-[0_14px_24px_rgba(15,23,42,0.08)] transition-all active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                  <span className="material-symbols-outlined mb-0.5 text-2xl text-orange-500">category</span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-wider text-orange-500">Add Prop</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeMobileTab === 'sets' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 pb-28">
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Set Construction</h2>
                {canManageSetsAccess && (
                  <button onClick={openCreateSetModal} className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Add +
                  </button>
                )}
              </div>
              {sets.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center text-center shadow-lg">
                  <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-600 text-3xl mb-3">architecture</span>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No set construction entries.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sets.map(set => (
                    <div key={set.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                       <div className="flex justify-between items-start">
                         <div>
                           <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{set.setName}</h3>
                           <p className="text-[10px] text-zinc-500 mt-1">Est: {formatCurrency(set.estimatedCost)} • Act: <span className={set.isOverBudget ? 'text-red-400 font-bold' : ''}>{formatCurrency(set.actualCost)}</span></p>
                         </div>
                         <div className="scale-90 origin-top-right flex flex-col items-end gap-1">
                           {setStatusBadge(set.status)}
                           {set.isOverBudget && <StatusBadge variant="over" label="Over Budget" />}
                         </div>
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                           <div className="h-full bg-orange-500 rounded-full" style={{ width: `${set.progressPercentage}%` }}></div>
                         </div>
                         <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{set.progressPercentage}%</span>
                       </div>
                       {canManageSetsAccess && (
                         <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                            <button onClick={() => openEditSetModal(set)} className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                               Update <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {canManageSetsAccess && (
              <div className="pt-6">
                <button onClick={openCreateSetModal} className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-[22px] border border-zinc-200 bg-white py-4 text-zinc-900 shadow-[0_14px_24px_rgba(15,23,42,0.08)] transition-all active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                  <span className="material-symbols-outlined mb-0.5 text-2xl text-orange-500">foundation</span>
                  <span className="font-label text-[11px] font-bold uppercase tracking-wider text-orange-500">Add Set</span>
                </button>
              </div>
            )}
          </div>
        )}
        <nav className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex h-[80px] max-w-md items-center justify-around rounded-[30px] border border-zinc-200/80 bg-white/88 px-2 pb-safe shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/8 dark:bg-zinc-950/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
          {[
            { id: 'home', icon: 'home', label: 'Home' },
            { id: 'expenses', icon: 'payments', label: 'Expenses' },
            { id: 'props', icon: 'category', label: 'Props' },
            { id: 'sets', icon: 'foundation', label: 'Sets' },
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
