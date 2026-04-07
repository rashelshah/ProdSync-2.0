import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { HttpError } from '../../utils/httpError'
import type {
  ArtExpenseCreateInput,
  ArtPropCreateInput,
  ArtPropUpdateInput,
  ArtSetCreateInput,
  ArtSetUpdateInput,
} from './art.schemas'
import type {
  ArtAlertRecord,
  ArtBudgetRecord,
  ArtExpenseCategory,
  ArtExpenseApprovalStatus,
  ArtExpenseRecord,
  ArtPropRecord,
  ArtPropSourcingType,
  ArtPropStatus,
  ArtSetRecord,
  ArtSetStatus,
} from './art.types'
import { runReceiptOcr } from './services/ocrService'

const ART_RECEIPT_BUCKET = 'art-receipts'
const ART_PROP_MARKER = 'art_prop'
const ART_SET_SNAPSHOT_TYPE = 'art_set_construction'
const RECEIPT_ANOMALY_TOLERANCE = 2

type DbRow = Record<string, unknown>
type ApprovalDecision = 'approved' | 'rejected'
type ApprovalActionType = 'submitted' | 'approved' | 'rejected' | 'cancelled'

interface ApprovalRecord {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  metadata: DbRow
}

let bucketReadyPromise: Promise<void> | null = null

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : value != null ? Number(value) : null
}

function asObject(value: unknown): DbRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as DbRow : {}
}

function isMissingTableError(error: unknown) {
  return asObject(error).code === 'PGRST205'
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function todayIsoDate() {
  return formatDateOnly(new Date())
}

function snapshot(row: DbRow) {
  return asObject(row.snapshot)
}

function buildMismatchLabel(amountMismatch: boolean, quantityMismatch: boolean) {
  if (amountMismatch && quantityMismatch) {
    return 'Amount & Quantity Not Matching'
  }

  if (quantityMismatch) {
    return 'Quantity Not Matching'
  }

  return 'Amount Not Matching'
}

function receiptAnomalyMessage(description: string, mismatchLabel: string) {
  return `${description}: ${mismatchLabel.toLowerCase()}.`
}

function generateAssetCode(seed: string) {
  const slug = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'PROP'

  return `${slug}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function mapPropLifecycleToAssetStatus(status: ArtPropStatus): 'available' | 'checked_out' | 'lost' {
  if (status === 'in_use') {
    return 'checked_out'
  }

  if (status === 'missing') {
    return 'lost'
  }

  return 'available'
}

function isOverdueReturn(returnDueDate: string | null, status: ArtPropStatus) {
  if (!returnDueDate || status === 'returned') {
    return false
  }

  return returnDueDate < todayIsoDate()
}

async function ensureArtReceiptBucket() {
  if (bucketReadyPromise) {
    return bucketReadyPromise
  }

  bucketReadyPromise = (async () => {
    const created = await adminClient.storage.createBucket(ART_RECEIPT_BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
    })

    if (created.error) {
      const message = created.error.message?.toLowerCase() ?? ''
      if (!message.includes('already exists') && !message.includes('duplicate')) {
        throw created.error
      }
    }
  })()

  return bucketReadyPromise
}

function buildReceiptUrl(storagePath: string | null) {
  if (!storagePath) {
    return null
  }

  const { data } = adminClient.storage.from(ART_RECEIPT_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl || null
}

function buildValidationStatus(hasReceipt: boolean, anomaly: boolean): ArtExpenseRecord['status'] {
  if (!hasReceipt) {
    return 'pending_review'
  }

  return anomaly ? 'anomaly' : 'verified'
}

function formatCategoryLabel(category: ArtExpenseCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function mapApprovalStatus(
  expenseStatus: string | null | undefined,
  approvalStatus: string | null | undefined,
  approvalMetadata?: DbRow,
): ArtExpenseApprovalStatus {
  const workflowStatus = asString(approvalMetadata?.workflowStatus)

  if (workflowStatus === 'pending_art_director' || workflowStatus === 'pending_producer') {
    return workflowStatus
  }

  if (workflowStatus === 'approved' || approvalMetadata?.decision === 'approved') {
    return 'approved'
  }

  if (workflowStatus === 'rejected' || approvalMetadata?.decision === 'rejected') {
    return 'denied'
  }

  if (approvalStatus === 'approved' || expenseStatus === 'approved') {
    return 'approved'
  }

  if (approvalStatus === 'rejected' || expenseStatus === 'rejected') {
    return 'denied'
  }

  return 'pending_producer'
}

function buildArtExpenseApprovalDescription(params: {
  category: ArtExpenseCategory
  quantity: number
  hasReceipt: boolean
  validationStatus: ArtExpenseRecord['status']
  mismatchLabel: string | null
}) {
  const parts = [
    `${formatCategoryLabel(params.category)} expense`,
    `Qty ${params.quantity}`,
    params.hasReceipt ? 'Receipt attached' : 'Receipt missing',
  ]

  if (params.validationStatus === 'anomaly' && params.mismatchLabel) {
    parts.push(params.mismatchLabel)
  } else if (params.validationStatus === 'pending_review' && params.hasReceipt) {
    parts.push('Receipt pending review')
  }

  return parts.join(' | ')
}

async function syncExpenseAnomalyAlert(params: {
  projectId: string
  expenseId: string
  description: string
  mismatchLabel: string
  expectedAmount: number
  detectedAmount: number
  manualQuantity: number
  extractedQuantity: number | null
  shouldExist: boolean
}) {
  const existing = await adminClient
    .from('alerts')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('source', 'expenses')
    .eq('entity_table', 'expenses')
    .eq('entity_id', params.expenseId)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (params.shouldExist) {
    const payload = {
      project_id: params.projectId,
      source: 'expenses',
      severity: 'warning',
      title: 'Anomaly Detected',
      message: receiptAnomalyMessage(params.description, params.mismatchLabel),
      status: 'open',
      entity_table: 'expenses',
      entity_id: params.expenseId,
      metadata: {
        alertType: 'art_receipt_anomaly',
        mismatchLabel: params.mismatchLabel,
        expectedAmount: params.expectedAmount,
        detectedAmount: params.detectedAmount,
        manualQuantity: params.manualQuantity,
        extractedQuantity: params.extractedQuantity,
      },
    }

    if (existing.data?.id) {
      const updateResult = await adminClient
        .from('alerts')
        .update({
          ...payload,
          resolved_at: null,
          resolved_by: null,
          acknowledged_at: null,
          acknowledged_by: null,
        })
        .eq('id', String(existing.data.id))
        .eq('project_id', params.projectId)

      if (updateResult.error) {
        throw updateResult.error
      }

      return
    }

    const insertResult = await adminClient.from('alerts').insert(payload)
    if (insertResult.error) {
      throw insertResult.error
    }

    return
  }

  if (!existing.data?.id) {
    return
  }

  const resolveResult = await adminClient
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', String(existing.data.id))
    .eq('project_id', params.projectId)

  if (resolveResult.error) {
    throw resolveResult.error
  }
}

async function syncArtExpenseMirror(params: {
  id: string
  projectId: string
  description: string
  category: ArtExpenseCategory
  quantity: number
  manualAmount: number
  extractedAmount: number
  anomaly: boolean
  ocrText: string | null
  receiptUrl: string | null
  status: ArtExpenseRecord['status']
  createdBy: string
  createdAt: string
}) {
  const result = await adminClient
    .from('art_expenses')
    .upsert({
      id: params.id,
      project_id: params.projectId,
      description: params.description,
      category: params.category,
      quantity: params.quantity,
      manual_amount: params.manualAmount,
      extracted_amount: params.extractedAmount,
      anomaly: params.anomaly,
      ocr_text: params.ocrText,
      receipt_url: params.receiptUrl,
      status: params.status,
      created_by: params.createdBy,
      created_at: params.createdAt,
    }, {
      onConflict: 'id',
    })

  if (result.error && !isMissingTableError(result.error)) {
    throw result.error
  }
}

async function deleteArtExpenseMirror(projectId: string, expenseId: string) {
  const result = await adminClient
    .from('art_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('project_id', projectId)

  if (result.error && !isMissingTableError(result.error)) {
    throw result.error
  }
}

async function createApprovalAction(params: {
  approvalId: string
  projectId: string
  action: ApprovalActionType
  actorId: string | null
  note?: string | null
}) {
  const result = await adminClient
    .from('approval_actions')
    .insert({
      approval_id: params.approvalId,
      project_id: params.projectId,
      action: params.action,
      actor_id: params.actorId,
      note: params.note ?? null,
    })

  if (result.error && !isMissingTableError(result.error)) {
    throw result.error
  }
}

async function listApprovalRecords(projectId: string, approvalIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(approvalIds.filter((approvalId): approvalId is string => Boolean(approvalId)))]
  if (uniqueIds.length === 0) {
    return new Map<string, ApprovalRecord>()
  }

  const { data, error } = await adminClient
    .from('approvals')
    .select('id, status, approved_by, approved_at, rejected_at, rejection_reason, metadata')
    .eq('project_id', projectId)
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [
      String(row.id),
      {
        id: String(row.id),
        status: (asString(row.status) ?? 'pending') as ApprovalRecord['status'],
        approved_by: asString(row.approved_by),
        approved_at: asString(row.approved_at),
        rejected_at: asString(row.rejected_at),
        rejection_reason: asString(row.rejection_reason),
        metadata: asObject(row.metadata),
      },
    ]),
  )
}

async function createArtExpenseApproval(params: {
  expenseId: string
  projectId: string
  description: string
  category: ArtExpenseCategory
  quantity: number
  amount: number
  requestedBy: string
  hasReceipt: boolean
  validationStatus: ArtExpenseRecord['status']
  mismatchLabel: string | null
}) {
  const requestDescription = buildArtExpenseApprovalDescription({
    category: params.category,
    quantity: params.quantity,
    hasReceipt: params.hasReceipt,
    validationStatus: params.validationStatus,
    mismatchLabel: params.mismatchLabel,
  })

  const { data, error } = await adminClient
    .from('approvals')
    .insert({
      project_id: params.projectId,
      type: 'expense',
      department: 'art',
      requested_by: params.requestedBy,
      request_title: params.description,
      request_description: requestDescription,
      amount: params.amount,
      currency_code: 'INR',
      priority: params.amount >= 100000 ? 'high' : 'normal',
      status: 'pending',
      approvable_table: 'expenses',
      approvable_id: params.expenseId,
      metadata: {
        artModuleType: 'expense_approval',
        expenseId: params.expenseId,
        workflowStatus: 'pending_art_director',
        category: params.category,
        quantity: params.quantity,
        hasReceipt: params.hasReceipt,
        validationStatus: params.validationStatus,
        mismatchLabel: params.mismatchLabel,
        notes: requestDescription,
        createdAt: new Date().toISOString(),
      },
    })
    .select('id, status, approved_by, approved_at, rejected_at, rejection_reason, metadata')
    .single()

  if (error) {
    throw error
  }

  const approval = {
    id: String(data.id),
    status: (asString(data.status) ?? 'pending') as ApprovalRecord['status'],
    approved_by: asString(data.approved_by),
    approved_at: asString(data.approved_at),
    rejected_at: asString(data.rejected_at),
    rejection_reason: asString(data.rejection_reason),
    metadata: asObject(data.metadata),
  }

  await createApprovalAction({
    approvalId: approval.id,
    projectId: params.projectId,
    action: 'submitted',
    actorId: params.requestedBy,
    note: requestDescription,
  })

  return approval
}

async function loadUserNames(userIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))]
  if (uniqueIds.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name')
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as DbRow[]).map(row => [String(row.id), asString(row.full_name) ?? 'ProdSync User']),
  )
}

async function listExpenseReceipts(projectId: string, expenseIds: string[]) {
  if (expenseIds.length === 0) {
    return new Map<string, DbRow>()
  }

  const { data, error } = await adminClient
    .from('receipts')
    .select('id, expense_id, storage_path, file_name, extracted_data, total_amount, created_at')
    .eq('project_id', projectId)
    .in('expense_id', expenseIds)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const receiptMap = new Map<string, DbRow>()
  for (const row of (data ?? []) as DbRow[]) {
    const expenseId = asString(row.expense_id)
    if (!expenseId || receiptMap.has(expenseId)) {
      continue
    }

    receiptMap.set(expenseId, row)
  }

  return receiptMap
}

function toArtExpenseRecord(
  row: DbRow,
  receipt: DbRow | undefined,
  userNames: Map<string, string>,
  approval: ApprovalRecord | undefined,
): ArtExpenseRecord {
  const createdById = asString(row.requested_by)
  const extractedData = receipt ? asObject(receipt.extracted_data) : asObject(asObject(row.metadata).ocrData)
  const receiptPath = receipt ? asString(receipt.storage_path) : asString(asObject(row.metadata).receiptPath)
  const metadata = asObject(row.metadata)
  const manualAmount = Number(metadata.manualAmount ?? row.amount ?? 0)
  const extractedAmount = Number(
    metadata.extractedAmount
    ?? extractedData.extractedAmount
    ?? extractedData.detectedAmount
    ?? 0,
  )
  const mismatchFlag = Boolean(
    metadata.anomaly
    ?? extractedData.anomalyDetected
    ?? extractedData.mismatchFlag,
  )
  const status = (
    asString(metadata.validationStatus)
    ?? asString(extractedData.status)
    ?? buildValidationStatus(Boolean(receiptPath), mismatchFlag)
  ) as ArtExpenseRecord['status']
  const ocrText = asString(metadata.ocrText) ?? asString(extractedData.text) ?? asString(extractedData.extractedText)
  const amountMismatch = Boolean(metadata.amountMismatch ?? extractedData.amountMismatch ?? mismatchFlag)
  const quantityMismatch = Boolean(metadata.quantityMismatch ?? extractedData.quantityMismatch ?? false)
  const mismatchLabel = asString(metadata.mismatchLabel) ?? asString(extractedData.mismatchLabel)
  const extractedQuantity = asNumber(metadata.extractedQuantity ?? extractedData.extractedQuantity)
  const previewText = asString(extractedData.previewText) ?? ocrText
  const approvalMetadata = approval?.metadata ?? {}
  const artDirectorReviewedBy = asString(approvalMetadata.artDirectorReviewedBy) ?? asString(metadata.artDirectorReviewedBy)
  const artDirectorReviewedAt = asString(approvalMetadata.artDirectorReviewedAt) ?? asString(metadata.artDirectorReviewedAt)
  const producerReviewedBy = asString(approvalMetadata.producerReviewedBy) ?? asString(metadata.producerReviewedBy)
  const producerReviewedAt = asString(approvalMetadata.producerReviewedAt) ?? asString(metadata.producerReviewedAt)
  const approvalStatus = mapApprovalStatus(asString(row.status), approval?.status ?? asString(metadata.approvalStatus), approval?.metadata)
  const approvalPendingWith = approvalStatus === 'pending_art_director'
    ? 'art_director'
    : approvalStatus === 'pending_producer'
      ? 'producer'
      : null
  const reviewedById = approvalStatus === 'pending_producer'
    ? artDirectorReviewedBy
    : approvalStatus === 'approved'
      ? (producerReviewedBy ?? approval?.approved_by ?? asString(metadata.approvalReviewedBy))
      : approvalStatus === 'denied'
        ? (producerReviewedBy ?? artDirectorReviewedBy ?? approval?.approved_by ?? asString(metadata.approvalReviewedBy))
        : null
  const reviewedAt = approvalStatus === 'pending_producer'
    ? artDirectorReviewedAt
    : approvalStatus === 'approved'
      ? (producerReviewedAt ?? approval?.approved_at ?? asString(metadata.approvalReviewedAt))
    : approvalStatus === 'denied'
      ? (producerReviewedAt ?? artDirectorReviewedAt ?? approval?.rejected_at ?? asString(metadata.approvalReviewedAt))
      : null
  const approvalNote = approvalStatus === 'denied'
    ? (approval?.rejection_reason ?? asString(metadata.approvalNote))
    : asString(metadata.approvalNote)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    description: asString(row.title) ?? 'Art expense',
    category: (asString(row.category) ?? 'misc') as ArtExpenseCategory,
    quantity: Number(metadata.quantity ?? 1),
    amount: manualAmount,
    manualAmount,
    extractedAmount,
    anomaly: mismatchFlag,
    status,
    ocrText,
    receiptUrl: buildReceiptUrl(receiptPath),
    receiptFileName: receipt ? asString(receipt.file_name) : null,
    createdById,
    createdByName: createdById ? userNames.get(createdById) ?? 'ProdSync User' : null,
    createdAt: String(row.created_at),
    hasReceipt: Boolean(receiptPath),
    mismatchFlag,
    approvalId: asString(row.approval_id) ?? asString(metadata.approvalId),
    approvalStatus,
    approvalPendingWith,
    approvalNote,
    reviewedById,
    reviewedByName: reviewedById ? userNames.get(reviewedById) ?? 'ProdSync User' : null,
    reviewedAt,
    ocrData: {
      ...extractedData,
      amountMismatch,
      quantityMismatch,
      mismatchLabel,
      extractedQuantity,
      previewText,
    },
  }
}

function toArtPropRecord(row: DbRow): ArtPropRecord {
  const metadata = asObject(row.metadata)
  const status = (asString(metadata.lifecycleStatus) ?? 'in_storage') as ArtPropStatus
  const returnDueDate = asString(metadata.returnDueDate)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    propName: asString(row.name) ?? 'Unnamed Prop',
    category: asString(row.category) ?? 'misc',
    sourcingType: (asString(metadata.sourcingType) ?? 'sourced') as ArtPropSourcingType,
    status,
    vendorName: asString(row.owner_vendor) ?? asString(metadata.vendorName),
    returnDueDate,
    createdAt: String(row.created_at),
    isOverdue: isOverdueReturn(returnDueDate, status),
  }
}

function toArtSetRecord(row: DbRow): ArtSetRecord {
  const estimatedCost = Number(row.estimated_cost ?? 0)
  const actualCost = Number(row.actual_cost ?? 0)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    setName: asString(row.set_name) ?? 'Unnamed Set',
    estimatedCost,
    actualCost,
    status: (asString(row.status) ?? 'planned') as ArtSetStatus,
    progressPercentage: Number(row.progress_percentage ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    isOverBudget: actualCost > estimatedCost && estimatedCost > 0,
  }
}

function toArtSetRecordFromSnapshot(row: DbRow): ArtSetRecord {
  const item = snapshot(row)
  const estimatedCost = Number(item.estimatedCost ?? 0)
  const actualCost = Number(item.actualCost ?? 0)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    setName: asString(item.setName) ?? asString(row.title) ?? 'Unnamed Set',
    estimatedCost,
    actualCost,
    status: (asString(item.status) ?? 'planned') as ArtSetStatus,
    progressPercentage: Number(item.progressPercentage ?? 0),
    createdAt: String(row.created_at),
    updatedAt: asString(item.updatedAt) ?? String(row.created_at),
    isOverBudget: actualCost > estimatedCost && estimatedCost > 0,
  }
}

async function findArtExpense(projectId: string, expenseId: string) {
  const { data, error } = await adminClient
    .from('expenses')
    .select('id, project_id, department, category, title, amount, requested_by, status, approval_id, metadata, created_at')
    .eq('id', expenseId)
    .eq('project_id', projectId)
    .eq('department', 'art')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Art expense not found.')
  }

  return data as DbRow
}

export async function resolveArtExpenseApprovalDecision(params: {
  projectId: string
  expenseId: string | null
  approvalId: string | null
  reviewerId: string | null
  stage: 'art_director' | 'producer'
  decision: ApprovalDecision
  reason: string | null
}) {
  const expenseId = params.expenseId
  if (!expenseId) {
    return
  }

  const { data, error } = await adminClient
    .from('expenses')
    .select('metadata')
    .eq('project_id', params.projectId)
    .eq('id', expenseId)
    .eq('department', 'art')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return
  }

  const actedAt = new Date().toISOString()
  const currentMetadata = asObject(data.metadata)
  const nextExpenseStatus = params.stage === 'art_director' && params.decision === 'approved'
    ? 'submitted'
    : params.decision
  const nextApprovalStatus = params.stage === 'art_director' && params.decision === 'approved'
    ? 'pending_producer'
    : params.decision === 'approved'
      ? 'approved'
      : 'denied'
  const nextApprovalNote = params.stage === 'art_director' && params.decision === 'approved'
    ? 'Art Director approved. Awaiting producer approval.'
    : params.decision === 'rejected'
      ? (params.reason || (params.stage === 'art_director' ? 'Denied by Art Director.' : 'Denied from producer approvals.'))
      : (params.reason || null)

  const updateResult = await adminClient
    .from('expenses')
    .update({
      status: nextExpenseStatus,
      approval_id: params.approvalId,
      metadata: {
        ...currentMetadata,
        approvalId: params.approvalId,
        approvalStatus: nextApprovalStatus,
        approvalPendingWith: nextApprovalStatus === 'pending_producer' ? 'producer' : null,
        approvalReviewedBy: nextApprovalStatus === 'pending_producer' ? null : params.reviewerId,
        approvalReviewedAt: nextApprovalStatus === 'pending_producer' ? null : actedAt,
        approvalNote: nextApprovalNote,
        artDirectorReviewedBy: params.stage === 'art_director' ? params.reviewerId : asString(currentMetadata.artDirectorReviewedBy),
        artDirectorReviewedAt: params.stage === 'art_director' ? actedAt : asString(currentMetadata.artDirectorReviewedAt),
        producerReviewedBy: params.stage === 'producer' ? params.reviewerId : asString(currentMetadata.producerReviewedBy),
        producerReviewedAt: params.stage === 'producer' ? actedAt : asString(currentMetadata.producerReviewedAt),
      },
    })
    .eq('project_id', params.projectId)
    .eq('id', expenseId)
    .eq('department', 'art')

  if (updateResult.error) {
    throw updateResult.error
  }

  if (params.approvalId) {
    await createApprovalAction({
      approvalId: params.approvalId,
      projectId: params.projectId,
      action: params.decision,
      actorId: params.reviewerId,
      note: nextApprovalNote,
    })
  }
}

async function findArtProp(projectId: string, propId: string) {
  const { data, error } = await adminClient
    .from('assets')
    .select('id, project_id, name, category, owner_vendor, metadata, created_at')
    .eq('id', propId)
    .eq('project_id', projectId)
    .eq('department', 'art')
    .maybeSingle()

  if (error) {
    throw error
  }

  const metadata = data ? asObject((data as DbRow).metadata) : {}
  if (!data || asString(metadata.artModuleType) !== ART_PROP_MARKER) {
    throw new HttpError(404, 'Art prop not found.')
  }

  return data as DbRow
}

async function findSetConstruction(projectId: string, setId: string) {
  const { data, error } = await adminClient
    .from('set_construction')
    .select('*')
    .eq('id', setId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Set construction entry not found.')
  }

  return data as DbRow
}

async function findSetConstructionSnapshot(projectId: string, setId: string) {
  const { data, error } = await adminClient
    .from('report_snapshots')
    .select('id, project_id, title, snapshot, created_at')
    .eq('id', setId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || asString(snapshot(data as DbRow).artModuleType) !== ART_SET_SNAPSHOT_TYPE) {
    throw new HttpError(404, 'Set construction entry not found.')
  }

  return data as DbRow
}

async function loadBudgetSeed(projectId: string) {
  const [{ data: metric }, { data: project }] = await Promise.all([
    adminClient
      .from('financial_metrics')
      .select('budget_amount')
      .eq('project_id', projectId)
      .eq('department', 'art')
      .order('metric_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('projects')
      .select('budget')
      .eq('id', projectId)
      .maybeSingle(),
  ])

  return asNumber(metric?.budget_amount) ?? asNumber(project?.budget) ?? 0
}

async function sumUsedArtBudget(projectId: string) {
  const { data, error } = await adminClient
    .from('expenses')
    .select('amount')
    .eq('project_id', projectId)
    .eq('department', 'art')
    .not('status', 'in', '("rejected","cancelled")')

  if (error) {
    throw error
  }

  const expenseTotal = ((data ?? []) as DbRow[]).reduce((total, row) => total + Number(row.amount ?? 0), 0)
  const completedSetTotal = await sumCompletedSetCosts(projectId)

  return expenseTotal + completedSetTotal
}

async function sumCompletedSetCosts(projectId: string) {
  const directResult = await adminClient
    .from('set_construction')
    .select('actual_cost')
    .eq('project_id', projectId)
    .eq('status', 'completed')

  if (!directResult.error) {
    return ((directResult.data ?? []) as DbRow[]).reduce((total, row) => total + Number(row.actual_cost ?? 0), 0)
  }

  if (!isMissingTableError(directResult.error)) {
    throw directResult.error
  }

  const snapshotResult = await adminClient
    .from('report_snapshots')
    .select('snapshot')
    .eq('project_id', projectId)
    .eq('report_type', 'custom')

  if (snapshotResult.error) {
    throw snapshotResult.error
  }

  return ((snapshotResult.data ?? []) as DbRow[])
    .filter(row => asString(snapshot(row).artModuleType) === ART_SET_SNAPSHOT_TYPE && asString(snapshot(row).status) === 'completed')
    .reduce((total, row) => total + Number(snapshot(row).actualCost ?? 0), 0)
}

export async function listArtExpenses(projectId: string): Promise<ArtExpenseRecord[]> {
  const { data, error } = await adminClient
    .from('expenses')
    .select('id, project_id, category, title, amount, requested_by, status, approval_id, metadata, created_at')
    .eq('project_id', projectId)
    .eq('department', 'art')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as DbRow[]
  const approvalMap = await listApprovalRecords(projectId, rows.map(row => asString(row.approval_id)))
  const reviewerIds = Array.from(
    new Set(
      Array.from(approvalMap.values()).flatMap(row => [
        row.approved_by,
        asString(row.metadata.artDirectorReviewedBy),
        asString(row.metadata.producerReviewedBy),
      ].filter((value): value is string => Boolean(value))),
    ),
  )
  const [receiptMap, userNames] = await Promise.all([
    listExpenseReceipts(projectId, rows.map(row => String(row.id))),
    loadUserNames([...rows.map(row => asString(row.requested_by)), ...reviewerIds]),
  ])

  return rows.map(row => toArtExpenseRecord(
    row,
    receiptMap.get(String(row.id)),
    userNames,
    approvalMap.get(asString(row.approval_id) ?? ''),
  ))
}

export async function getArtExpenseById(projectId: string, expenseId: string): Promise<ArtExpenseRecord> {
  const expense = await findArtExpense(projectId, expenseId)
  const approvalMap = await listApprovalRecords(projectId, [asString(expense.approval_id)])
  const approval = approvalMap.get(asString(expense.approval_id) ?? '')
  const [receiptMap, userNames] = await Promise.all([
    listExpenseReceipts(projectId, [expenseId]),
    loadUserNames([
      asString(expense.requested_by),
      approval?.approved_by,
      asString(approval?.metadata.artDirectorReviewedBy),
      asString(approval?.metadata.producerReviewedBy),
    ]),
  ])

  return toArtExpenseRecord(expense, receiptMap.get(expenseId), userNames, approval)
}

export async function createArtExpense(
  input: ArtExpenseCreateInput,
  createdBy: string,
  receiptFile?: Express.Multer.File,
): Promise<ArtExpenseRecord> {
  const { data: insertedExpense, error } = await adminClient
    .from('expenses')
    .insert({
      project_id: input.projectId,
      department: 'art',
      category: input.category,
      title: input.description,
      description: input.description,
      vendor_name: input.description,
      incurred_on: todayIsoDate(),
      amount: input.manualAmount,
      currency_code: 'INR',
      requested_by: createdBy,
      status: 'submitted',
      receipt_required: true,
      metadata: {
        artModuleType: 'expense',
        quantity: input.quantity,
        manualAmount: input.manualAmount,
        extractedAmount: 0,
        extractedQuantity: null,
        amountMismatch: false,
        quantityMismatch: false,
        mismatchLabel: null,
        anomaly: false,
        validationStatus: buildValidationStatus(Boolean(receiptFile), false),
        ocrText: null,
        receiptPath: null,
        approvalId: null,
        approvalStatus: 'pending_art_director',
        approvalPendingWith: 'art_director',
        approvalReviewedBy: null,
        approvalReviewedAt: null,
        approvalNote: null,
      },
    })
    .select('id, project_id, category, title, amount, requested_by, status, approval_id, metadata, created_at')
    .single()

  if (error) {
    throw error
  }

  const expense = insertedExpense as DbRow
  let receiptRow: DbRow | undefined
  let receiptUrl: string | null = null
  let nextMetadata = {
    ...asObject(expense.metadata),
    artModuleType: 'expense',
    quantity: input.quantity,
    manualAmount: input.manualAmount,
    extractedAmount: 0,
    extractedQuantity: null as number | null,
    amountMismatch: false,
    quantityMismatch: false,
    mismatchLabel: null as string | null,
    anomaly: false,
    validationStatus: buildValidationStatus(Boolean(receiptFile), false),
    ocrText: null as string | null,
    receiptPath: null as string | null,
    approvalId: null as string | null,
    approvalStatus: 'pending_art_director' as ArtExpenseApprovalStatus,
    approvalPendingWith: 'art_director' as const,
    approvalReviewedBy: null as string | null,
    approvalReviewedAt: null as string | null,
    approvalNote: null as string | null,
  }

  if (receiptFile) {
    await ensureArtReceiptBucket()
    const objectPath = `${input.projectId}/${randomUUID()}-${receiptFile.originalname.replace(/[^a-zA-Z0-9._-]+/g, '-')}`
    const uploaded = await adminClient.storage
      .from(ART_RECEIPT_BUCKET)
      .upload(objectPath, receiptFile.buffer, {
        contentType: receiptFile.mimetype,
        upsert: false,
      })

    if (uploaded.error) {
      throw uploaded.error
    }

    const ocrResult = await runReceiptOcr(receiptFile, {
      manualAmount: input.manualAmount,
      manualQuantity: input.quantity,
    })
    const extractedAmount = ocrResult.extractedAmount
    const extractedQuantity = ocrResult.extractedQuantity
    const amountMismatch = Math.abs(extractedAmount - input.manualAmount) > RECEIPT_ANOMALY_TOLERANCE
    const quantityMismatch = extractedQuantity != null && extractedQuantity !== input.quantity
    const anomalyDetected = amountMismatch || quantityMismatch
    const mismatchLabel = buildMismatchLabel(amountMismatch, quantityMismatch)
    const validationStatus = buildValidationStatus(true, anomalyDetected)
    receiptUrl = buildReceiptUrl(objectPath)
    const ocrData = {
      text: ocrResult.text,
      extractedText: ocrResult.text || (ocrResult.errorMessage ?? 'OCR text extraction failed.'),
      previewText: ocrResult.previewText,
      extractedAmount,
      detectedAmount: extractedAmount,
      manualAmount: input.manualAmount,
      expectedAmount: input.manualAmount,
      quantity: input.quantity,
      extractedQuantity,
      manualQuantity: input.quantity,
      amountMismatch,
      quantityMismatch,
      anomalyDetected,
      mismatchLabel: anomalyDetected ? mismatchLabel : null,
      anomalyMessage: anomalyDetected ? mismatchLabel : null,
      status: validationStatus,
      ocrFailed: !ocrResult.success,
      errorMessage: ocrResult.errorMessage,
      extractionSource: 'tesseract',
      mismatchFlag: anomalyDetected,
      fileName: receiptFile.originalname,
      receiptUrl,
    }

    const { data: insertedReceipt, error: receiptError } = await adminClient
      .from('receipts')
      .insert({
        project_id: input.projectId,
        expense_id: String(expense.id),
        uploaded_by: createdBy,
        storage_path: objectPath,
        file_name: receiptFile.originalname,
        file_mime: receiptFile.mimetype,
        file_size_bytes: receiptFile.size,
        status: 'uploaded',
        vendor_name: input.description,
        receipt_date: todayIsoDate(),
        total_amount: input.manualAmount,
        extracted_data: ocrData,
      })
      .select('expense_id, storage_path, file_name, extracted_data, total_amount, created_at')
      .single()

    if (receiptError) {
      throw receiptError
    }

    receiptRow = insertedReceipt as DbRow
    nextMetadata = {
      ...nextMetadata,
      extractedAmount,
      extractedQuantity,
      amountMismatch,
      quantityMismatch,
      mismatchLabel: anomalyDetected ? mismatchLabel : null,
      anomaly: anomalyDetected,
      validationStatus,
      ocrText: ocrResult.text || null,
      receiptPath: objectPath,
    }

    await adminClient
      .from('expenses')
      .update({
        metadata: {
          ...nextMetadata,
          ocrData,
        },
      })
      .eq('id', String(expense.id))
      .eq('project_id', input.projectId)

    await syncExpenseAnomalyAlert({
      projectId: input.projectId,
      expenseId: String(expense.id),
      description: input.description,
      mismatchLabel,
      expectedAmount: input.manualAmount,
      detectedAmount: Number(ocrData.detectedAmount ?? 0),
      manualQuantity: input.quantity,
      extractedQuantity,
      shouldExist: Boolean(ocrData.mismatchFlag),
    })
  } else {
    receiptUrl = null
  }

  await syncArtExpenseMirror({
    id: String(expense.id),
    projectId: input.projectId,
    description: input.description,
    category: input.category,
    quantity: input.quantity,
    manualAmount: input.manualAmount,
    extractedAmount: Number(nextMetadata.extractedAmount ?? 0),
    anomaly: Boolean(nextMetadata.anomaly),
    ocrText: asString(nextMetadata.ocrText),
    receiptUrl,
    status: (asString(nextMetadata.validationStatus) ?? 'pending_review') as ArtExpenseRecord['status'],
    createdBy,
    createdAt: String(expense.created_at),
  })

  const approval = await createArtExpenseApproval({
    expenseId: String(expense.id),
    projectId: input.projectId,
    description: input.description,
    category: input.category,
    quantity: input.quantity,
    amount: input.manualAmount,
    requestedBy: createdBy,
    hasReceipt: Boolean(receiptFile),
    validationStatus: (asString(nextMetadata.validationStatus) ?? 'pending_review') as ArtExpenseRecord['status'],
    mismatchLabel: asString(nextMetadata.mismatchLabel),
  })

  nextMetadata = {
    ...nextMetadata,
    approvalId: approval.id,
    approvalStatus: 'pending_art_director',
    approvalPendingWith: 'art_director',
    approvalReviewedBy: null,
    approvalReviewedAt: null,
    approvalNote: null,
  }

  if (!receiptFile) {
    await adminClient
      .from('expenses')
      .update({
        metadata: {
          ...nextMetadata,
          ocrData: {
            text: '',
            extractedText: `No receipt uploaded for ${input.description}.`,
            extractedAmount: 0,
            detectedAmount: 0,
            manualAmount: input.manualAmount,
            expectedAmount: input.manualAmount,
            quantity: input.quantity,
            extractedQuantity: null,
            manualQuantity: input.quantity,
            amountMismatch: false,
            quantityMismatch: false,
            anomalyDetected: false,
            anomalyMessage: null,
            mismatchLabel: null,
            status: 'pending_review',
            ocrFailed: false,
            errorMessage: null,
            extractionSource: 'manual_input',
            mismatchFlag: false,
            fileName: null,
            receiptUrl: null,
          },
        },
        approval_id: approval.id,
      })
      .eq('id', String(expense.id))
      .eq('project_id', input.projectId)
  }

  if (receiptFile) {
    await adminClient
      .from('expenses')
      .update({
        approval_id: approval.id,
        metadata: {
          ...nextMetadata,
          ocrData: receiptRow ? asObject(receiptRow.extracted_data) : asObject(asObject(expense.metadata).ocrData),
        },
      })
      .eq('id', String(expense.id))
      .eq('project_id', input.projectId)
  }

  const userNames = await loadUserNames([createdBy])
  return toArtExpenseRecord({
    ...expense,
    status: 'submitted',
    approval_id: approval.id,
    metadata: {
      ...nextMetadata,
      ocrData: receiptRow
        ? asObject(receiptRow.extracted_data)
        : {
          text: '',
          extractedText: `No receipt uploaded for ${input.description}.`,
          extractedAmount: 0,
          detectedAmount: 0,
          manualAmount: input.manualAmount,
          expectedAmount: input.manualAmount,
          quantity: input.quantity,
          extractedQuantity: null,
          manualQuantity: input.quantity,
          amountMismatch: false,
          quantityMismatch: false,
          anomalyDetected: false,
          anomalyMessage: null,
          mismatchLabel: null,
          status: 'pending_review',
          ocrFailed: false,
          errorMessage: null,
          extractionSource: 'manual_input',
          mismatchFlag: false,
          fileName: null,
          receiptUrl: null,
        },
    },
  }, receiptRow, userNames, approval)
}

export async function deleteArtExpense(projectId: string, expenseId: string): Promise<void> {
  const expense = await findArtExpense(projectId, expenseId)
  const receiptMap = await listExpenseReceipts(projectId, [expenseId])
  const receipt = receiptMap.get(expenseId)

  if (receipt) {
    const storagePath = asString(receipt.storage_path)
    if (storagePath) {
      await ensureArtReceiptBucket()
      await adminClient.storage.from(ART_RECEIPT_BUCKET).remove([storagePath])
    }
  }

  const { error } = await adminClient
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('project_id', projectId)
    .eq('department', 'art')

  if (error) {
    throw error
  }

  await adminClient
    .from('alerts')
    .delete()
    .eq('project_id', projectId)
    .eq('source', 'expenses')
    .eq('entity_table', 'expenses')
    .eq('entity_id', expenseId)

  const approvalId = asString(expense.approval_id)
  if (approvalId) {
    const approvalDelete = await adminClient
      .from('approvals')
      .delete()
      .eq('project_id', projectId)
      .eq('id', approvalId)

    if (approvalDelete.error) {
      throw approvalDelete.error
    }
  }

  await deleteArtExpenseMirror(projectId, expenseId)
}

export async function listArtProps(projectId: string): Promise<ArtPropRecord[]> {
  const { data, error } = await adminClient
    .from('assets')
    .select('id, project_id, name, category, owner_vendor, metadata, created_at')
    .eq('project_id', projectId)
    .eq('department', 'art')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as DbRow[])
    .filter(row => asString(asObject(row.metadata).artModuleType) === ART_PROP_MARKER)
    .map(toArtPropRecord)
}

export async function createArtProp(input: ArtPropCreateInput): Promise<ArtPropRecord> {
  const { data, error } = await adminClient
    .from('assets')
    .insert({
      project_id: input.projectId,
      department: 'art',
      asset_code: generateAssetCode(input.propName),
      name: input.propName,
      category: input.category,
      owner_vendor: input.vendorName?.trim() || null,
      status: mapPropLifecycleToAssetStatus(input.status),
      metadata: {
        artModuleType: ART_PROP_MARKER,
        sourcingType: input.sourcingType,
        lifecycleStatus: input.status,
        vendorName: input.vendorName?.trim() || null,
        returnDueDate: input.returnDueDate ?? null,
      },
    })
    .select('id, project_id, name, category, owner_vendor, metadata, created_at')
    .single()

  if (error) {
    throw error
  }

  return toArtPropRecord(data as DbRow)
}

export async function updateArtProp(id: string, input: ArtPropUpdateInput): Promise<ArtPropRecord> {
  const existing = await findArtProp(input.projectId, id)
  const currentMetadata = asObject(existing.metadata)

  const nextMetadata = {
    ...currentMetadata,
    artModuleType: ART_PROP_MARKER,
    lifecycleStatus: input.status,
    vendorName: input.vendorName !== undefined ? input.vendorName?.trim() || null : asString(currentMetadata.vendorName),
    returnDueDate: input.returnDueDate !== undefined ? input.returnDueDate ?? null : asString(currentMetadata.returnDueDate),
  }

  const { data, error } = await adminClient
    .from('assets')
    .update({
      owner_vendor: input.vendorName !== undefined ? input.vendorName?.trim() || null : asString(existing.owner_vendor),
      status: mapPropLifecycleToAssetStatus(input.status),
      metadata: nextMetadata,
    })
    .eq('id', id)
    .eq('project_id', input.projectId)
    .select('id, project_id, name, category, owner_vendor, metadata, created_at')
    .single()

  if (error) {
    throw error
  }

  return toArtPropRecord(data as DbRow)
}

export async function deleteArtProp(projectId: string, propId: string): Promise<void> {
  await findArtProp(projectId, propId)

  const { error } = await adminClient
    .from('assets')
    .delete()
    .eq('id', propId)
    .eq('project_id', projectId)
    .eq('department', 'art')

  if (error) {
    throw error
  }
}

export async function listArtSets(projectId: string): Promise<ArtSetRecord[]> {
  const { data, error } = await adminClient
    .from('set_construction')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error && !isMissingTableError(error)) {
    throw error
  }

  if (!error) {
    return ((data ?? []) as DbRow[]).map(toArtSetRecord)
  }

  const snapshotResult = await adminClient
    .from('report_snapshots')
    .select('id, project_id, title, snapshot, created_at')
    .eq('project_id', projectId)
    .eq('report_type', 'custom')
    .order('created_at', { ascending: false })

  if (snapshotResult.error) {
    throw snapshotResult.error
  }

  return ((snapshotResult.data ?? []) as DbRow[])
    .filter(row => asString(snapshot(row).artModuleType) === ART_SET_SNAPSHOT_TYPE)
    .map(toArtSetRecordFromSnapshot)
}

export async function createArtSet(input: ArtSetCreateInput): Promise<ArtSetRecord> {
  const { data, error } = await adminClient
    .from('set_construction')
    .insert({
      project_id: input.projectId,
      set_name: input.setName,
      estimated_cost: input.estimatedCost,
      actual_cost: input.actualCost,
      status: input.status,
      progress_percentage: input.progressPercentage,
    })
    .select('*')
    .single()

  if (error && !isMissingTableError(error)) {
    throw error
  }

  if (!error) {
    return toArtSetRecord(data as DbRow)
  }

  const updatedAt = new Date().toISOString()
  const snapshotInsert = await adminClient
    .from('report_snapshots')
    .insert({
      project_id: input.projectId,
      report_type: 'custom',
      title: input.setName,
      snapshot: {
        artModuleType: ART_SET_SNAPSHOT_TYPE,
        setName: input.setName,
        estimatedCost: input.estimatedCost,
        actualCost: input.actualCost,
        status: input.status,
        progressPercentage: input.progressPercentage,
        updatedAt,
      },
    })
    .select('id, project_id, title, snapshot, created_at')
    .single()

  if (snapshotInsert.error) {
    throw snapshotInsert.error
  }

  return toArtSetRecordFromSnapshot(snapshotInsert.data as DbRow)
}

export async function updateArtSet(id: string, input: ArtSetUpdateInput): Promise<ArtSetRecord> {
  const existingResult = await adminClient
    .from('set_construction')
    .select('*')
    .eq('id', id)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (existingResult.error && !isMissingTableError(existingResult.error)) {
    throw existingResult.error
  }

  if (!existingResult.error) {
    const existing = existingResult.data as DbRow
    if (!existing) {
      throw new HttpError(404, 'Set construction entry not found.')
    }

    const { data, error } = await adminClient
    .from('set_construction')
    .update({
      estimated_cost: input.estimatedCost ?? Number(existing.estimated_cost ?? 0),
      actual_cost: input.actualCost ?? Number(existing.actual_cost ?? 0),
      status: input.status ?? asString(existing.status) ?? 'planned',
      progress_percentage: input.progressPercentage ?? Number(existing.progress_percentage ?? 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('project_id', input.projectId)
    .select('*')
    .single()

    if (error) {
      throw error
    }

    return toArtSetRecord(data as DbRow)
  }

  const existingSnapshot = await findSetConstructionSnapshot(input.projectId, id)
  const current = snapshot(existingSnapshot)
  const nextSnapshot = {
    ...current,
    artModuleType: ART_SET_SNAPSHOT_TYPE,
    setName: asString(current.setName) ?? asString(existingSnapshot.title) ?? 'Unnamed Set',
    estimatedCost: input.estimatedCost ?? Number(current.estimatedCost ?? 0),
    actualCost: input.actualCost ?? Number(current.actualCost ?? 0),
    status: input.status ?? asString(current.status) ?? 'planned',
    progressPercentage: input.progressPercentage ?? Number(current.progressPercentage ?? 0),
    updatedAt: new Date().toISOString(),
  }

  const updatedSnapshot = await adminClient
    .from('report_snapshots')
    .update({
      title: String(nextSnapshot.setName),
      snapshot: nextSnapshot,
    })
    .eq('id', id)
    .eq('project_id', input.projectId)
    .select('id, project_id, title, snapshot, created_at')
    .single()

  if (updatedSnapshot.error) {
    throw updatedSnapshot.error
  }

  return toArtSetRecordFromSnapshot(updatedSnapshot.data as DbRow)
}

export async function getArtBudget(projectId: string): Promise<ArtBudgetRecord> {
  const usedBudget = await sumUsedArtBudget(projectId)
  const allocatedBudget = await loadBudgetSeed(projectId)

  return {
    projectId,
    department: 'art',
    allocatedBudget,
    usedBudget,
    remainingBudget: allocatedBudget - usedBudget,
    isExceeded: usedBudget > allocatedBudget,
  }
}

export async function listArtAlerts(projectId: string): Promise<ArtAlertRecord[]> {
  const [budget, expenses, props, sets] = await Promise.all([
    getArtBudget(projectId),
    listArtExpenses(projectId),
    listArtProps(projectId),
    listArtSets(projectId),
  ])

  const alerts: ArtAlertRecord[] = []

  if (budget.isExceeded) {
    alerts.push({
      type: 'critical',
      message: `Art spend exceeded the allocated budget by ${Math.abs(budget.remainingBudget).toFixed(0)}.`,
      timestamp: new Date().toISOString(),
    })
  }

  for (const expense of expenses) {
    if (!expense.hasReceipt) {
      alerts.push({
        type: 'warning',
        message: `${expense.description} is missing a receipt attachment.`,
        timestamp: expense.createdAt,
      })
    }

    if (expense.mismatchFlag) {
      const mismatchLabel = asString(asObject(expense.ocrData).mismatchLabel) ?? 'Amount Not Matching'
      alerts.push({
        type: 'warning',
        message: `${expense.description}: ${mismatchLabel.toLowerCase()}.`,
        timestamp: expense.createdAt,
      })
    }
  }

  for (const prop of props) {
    if (prop.status === 'missing') {
      alerts.push({
        type: 'critical',
        message: `${prop.propName} has been marked as missing.`,
        timestamp: prop.createdAt,
      })
    }

    if (prop.isOverdue) {
      alerts.push({
        type: 'warning',
        message: `${prop.propName} is overdue for return.`,
        timestamp: prop.returnDueDate ?? prop.createdAt,
      })
    }
  }

  for (const set of sets) {
    if (set.isOverBudget) {
      alerts.push({
        type: 'warning',
        message: `${set.setName} is over its estimated construction budget.`,
        timestamp: set.updatedAt,
      })
    }
  }

  return alerts.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
}
