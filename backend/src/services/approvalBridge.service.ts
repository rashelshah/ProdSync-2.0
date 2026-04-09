import { adminClient } from '../config/supabaseClient'

/**
 * Central approval bridge service.
 *
 * All modules should call `bridgeApproval()` when creating an approval-worthy
 * entity so the request appears in the global Approval Center.
 *
 * Idempotent: duplicate calls for the same approvable_table + approvable_id
 * will update the existing row rather than insert.
 */

export type ApprovalType =
  | 'expense'
  | 'travel_auth'
  | 'catering'
  | 'props_rental'
  | 'camera_rental'
  | 'overtime_extension'
  | 'petty_cash'
  | 'vendor_payment'
  | 'batta'
  | 'wage'
  | 'rental'
  | 'fuel'
  | 'other'

export interface BridgeApprovalInput {
  projectId: string
  type: ApprovalType
  department: string
  requestedBy: string
  title: string
  description?: string | null
  amount?: number | null
  sourceModule: string
  approvableTable: string
  approvableId: string
  priority?: 'normal' | 'high' | 'emergency'
  metadata?: Record<string, unknown>
}

export interface BridgeApprovalUpdateInput {
  projectId: string
  approvableTable: string
  approvableId: string
  status: 'approved' | 'rejected' | 'cancelled'
  actorUserId?: string | null
  reason?: string | null
}

/**
 * Create or update a central approval entry for any module entity.
 * Returns the approval row ID.
 */
export async function bridgeApproval(input: BridgeApprovalInput): Promise<string> {
  try {
    // Check for existing approval linked to this entity
    const { data: existing, error: lookupError } = await adminClient
      .from('approvals')
      .select('id')
      .eq('project_id', input.projectId)
      .eq('approvable_table', input.approvableTable)
      .eq('approvable_id', input.approvableId)
      .maybeSingle()

    if (lookupError) {
      console.error('[approvalBridge] lookup failed', lookupError)
      throw lookupError
    }

    const now = new Date().toISOString()
    const mergedMetadata = {
      ...(input.metadata ?? {}),
      sourceModule: input.sourceModule,
      bridgedAt: now,
    }

    if (existing) {
      // Update the existing approval row
      const { error: updateError } = await adminClient
        .from('approvals')
        .update({
          request_title: input.title,
          request_description: input.description ?? null,
          amount: input.amount ?? null,
          priority: input.priority ?? 'normal',
          source_module: input.sourceModule,
          metadata: mergedMetadata,
          updated_at: now,
        })
        .eq('id', (existing as { id: string }).id)

      if (updateError) {
        console.error('[approvalBridge] update failed', updateError)
        throw updateError
      }

      console.log('[approvalBridge] updated existing approval', { approvalId: (existing as { id: string }).id, sourceModule: input.sourceModule })
      return (existing as { id: string }).id
    }

    // Insert a new approval row
    const { data: inserted, error: insertError } = await adminClient
      .from('approvals')
      .insert({
        project_id: input.projectId,
        type: input.type,
        department: input.department,
        requested_by: input.requestedBy,
        request_title: input.title,
        request_description: input.description ?? null,
        amount: input.amount ?? null,
        priority: input.priority ?? 'normal',
        status: 'pending',
        approvable_table: input.approvableTable,
        approvable_id: input.approvableId,
        source_module: input.sourceModule,
        metadata: mergedMetadata,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[approvalBridge] insert failed', insertError)
      throw insertError
    }

    const approvalId = (inserted as { id: string }).id

    // Record the submission action
    await adminClient.from('approval_actions').insert({
      approval_id: approvalId,
      project_id: input.projectId,
      action: 'submitted',
      actor_id: input.requestedBy,
      note: `Bridged from ${input.sourceModule} module`,
    })

    console.log('[approvalBridge] created new approval', { approvalId, sourceModule: input.sourceModule })
    return approvalId
  } catch (error) {
    // Non-critical: log and swallow so the source module's own flow is not broken
    console.error('[approvalBridge] bridge failed (non-fatal)', {
      sourceModule: input.sourceModule,
      approvableTable: input.approvableTable,
      approvableId: input.approvableId,
      error: error instanceof Error ? error.message : error,
    })
    return ''
  }
}

/**
 * Update the status of a central approval entry when the source module
 * approves/rejects/cancels the entity directly.
 */
export async function updateBridgedApprovalStatus(input: BridgeApprovalUpdateInput): Promise<void> {
  try {
    const now = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      status: input.status,
      updated_at: now,
    }

    if (input.status === 'approved') {
      updatePayload.approved_by = input.actorUserId ?? null
      updatePayload.approved_at = now
    }

    if (input.status === 'rejected') {
      updatePayload.approved_by = input.actorUserId ?? null
      updatePayload.rejected_at = now
      updatePayload.rejection_reason = input.reason ?? 'Rejected from module'
    }

    const { error } = await adminClient
      .from('approvals')
      .update(updatePayload)
      .eq('project_id', input.projectId)
      .eq('approvable_table', input.approvableTable)
      .eq('approvable_id', input.approvableId)

    if (error) {
      console.error('[approvalBridge] status update failed', error)
      return
    }

    // Record the action
    const { data: approval } = await adminClient
      .from('approvals')
      .select('id')
      .eq('project_id', input.projectId)
      .eq('approvable_table', input.approvableTable)
      .eq('approvable_id', input.approvableId)
      .maybeSingle()

    if (approval) {
      await adminClient.from('approval_actions').insert({
        approval_id: (approval as { id: string }).id,
        project_id: input.projectId,
        action: input.status === 'approved' ? 'approved' : input.status === 'rejected' ? 'rejected' : 'cancelled',
        actor_id: input.actorUserId ?? null,
        note: input.reason ?? `Status changed to ${input.status}`,
      })
    }

    console.log('[approvalBridge] status updated', {
      approvableTable: input.approvableTable,
      approvableId: input.approvableId,
      status: input.status,
    })
  } catch (error) {
    console.error('[approvalBridge] status update failed (non-fatal)', {
      error: error instanceof Error ? error.message : error,
    })
  }
}
