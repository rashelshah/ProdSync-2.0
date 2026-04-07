import { adminClient } from '../config/supabaseClient'

type TransportApprovalSource = 'fuel_alert' | 'trip_alert'
type TransportApprovalDecision = 'approved' | 'rejected'

export interface CreateTransportApprovalInput {
  projectId: string
  requestedBy: string | null
  referenceId: string
  referenceTable: 'fuel_logs' | 'trips'
  source: TransportApprovalSource
  title: string
  description: string
  priority?: 'normal' | 'high' | 'emergency'
  amount?: number | null
  metadata?: Record<string, unknown>
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isTransportApprovalMetadata(value: unknown): value is Record<string, unknown> & {
  transportApprovalSource: TransportApprovalSource
  referenceId: string
  referenceTable: 'fuel_logs' | 'trips'
} {
  const metadata = asObject(value)
  const source = asString(metadata.transportApprovalSource)
  const referenceId = asString(metadata.referenceId)
  const referenceTable = asString(metadata.referenceTable)

  return (
    (source === 'fuel_alert' || source === 'trip_alert') &&
    Boolean(referenceId) &&
    (referenceTable === 'fuel_logs' || referenceTable === 'trips')
  )
}

export async function createTransportApproval(input: CreateTransportApprovalInput) {
  const { data: existing, error: existingError } = await adminClient
    .from('approvals')
    .select('id, metadata')
    .eq('project_id', input.projectId)
    .eq('department', 'transport')
    .eq('approvable_table', input.referenceTable)
    .eq('status', 'pending')

  if (existingError) {
    throw existingError
  }

  const duplicate = ((existing ?? []) as Array<Record<string, unknown>>).find(row => {
    const metadata = asObject(row.metadata)
    return (
      asString(metadata.transportApprovalSource) === input.source &&
      asString(metadata.referenceId) === input.referenceId
    )
  })

  if (duplicate?.id) {
    return String(duplicate.id)
  }

  const { data, error } = await adminClient
    .from('approvals')
    .insert({
      project_id: input.projectId,
      type: 'other',
      department: 'transport',
      requested_by: input.requestedBy,
      request_title: input.title,
      request_description: input.description,
      amount: input.amount ?? null,
      priority: input.priority ?? 'normal',
      status: 'pending',
      approvable_table: input.referenceTable,
      metadata: {
        ...(input.metadata ?? {}),
        requestType: 'TRANSPORT',
        transportApprovalSource: input.source,
        referenceId: input.referenceId,
        referenceTable: input.referenceTable,
        createdAt: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }

  return String(data.id)
}

export async function resolveTransportApprovalDecision(params: {
  projectId: string
  reviewerId: string | null
  decision: TransportApprovalDecision
  reason: string | null
  metadata: Record<string, unknown>
}) {
  if (!isTransportApprovalMetadata(params.metadata)) {
    return
  }

  const resolution = {
    status: params.decision,
    actedBy: params.reviewerId,
    actedAt: new Date().toISOString(),
    note: params.reason,
  }

  if (params.metadata.referenceTable === 'fuel_logs') {
    const nextAuditStatus = params.decision === 'approved' ? 'verified' : 'mismatch'
    await adminClient
      .from('fuel_logs')
      .update({
        audit_status: nextAuditStatus,
        reviewed_by: params.reviewerId,
        reviewed_at: resolution.actedAt,
        approval_note: params.reason ?? (params.decision === 'approved'
          ? 'Approved from approvals center.'
          : 'Rejected from approvals center.'),
      })
      .eq('project_id', params.projectId)
      .eq('id', params.metadata.referenceId)
  }

  if (params.metadata.referenceTable === 'trips') {
    const { data, error } = await adminClient
      .from('trips')
      .select('metadata')
      .eq('project_id', params.projectId)
      .eq('id', params.metadata.referenceId)
      .maybeSingle()

    if (!error && data) {
      const currentMetadata = asObject(data.metadata)
      await adminClient
        .from('trips')
        .update({
          metadata: {
            ...currentMetadata,
            transportApproval: resolution,
          },
        })
        .eq('project_id', params.projectId)
        .eq('id', params.metadata.referenceId)
    }
  }

  const alertId = asString(params.metadata.alertId)
  if (alertId) {
    await adminClient
      .from('transport_alerts')
      .update({
        status: 'acknowledged',
      })
      .eq('project_id', params.projectId)
      .eq('id', alertId)
  }
}
