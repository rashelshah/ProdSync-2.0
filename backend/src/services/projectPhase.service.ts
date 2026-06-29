import { adminClient } from '../config/supabaseClient'

export const PROJECT_PHASES = ['planning', 'pre_production', 'production', 'post_production', 'completed'] as const

export type ProjectPhase = typeof PROJECT_PHASES[number]

export interface ProjectPhaseHistoryItem {
  id: string
  projectId: string
  previousPhase: ProjectPhase | null
  newPhase: ProjectPhase
  changedBy: string | null
  changedByName: string
  changedAt: string
  notes: string | null
  source: string
}

interface ProjectPhaseAuditInput {
  projectId: string
  previousPhase: ProjectPhase | null
  nextPhase: ProjectPhase
  changedBy: string | null
  changedByName?: string | null
  notes?: string | null
  source?: string
}

function normalizeRole(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
}

function normalizeProjectRole(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, '_') ?? null
}

export function formatProjectPhaseLabel(phase: ProjectPhase | string | null | undefined) {
  switch (phase) {
    case 'planning':
      return 'Planning'
    case 'pre_production':
      return 'Pre Production'
    case 'production':
      return 'Production'
    case 'post_production':
      return 'Post Production'
    case 'completed':
      return 'Completed'
    default:
      return 'Planning'
  }
}

export function canManageProjectWorkflow(input: {
  authRole?: string | null
  membershipRole?: string | null
  projectRole?: string | null
  isOwner?: boolean
}) {
  const authRole = normalizeRole(input.authRole)
  const membershipRole = normalizeRole(input.membershipRole)
  const projectRole = normalizeProjectRole(input.projectRole)

  return Boolean(
    input.isOwner
      || authRole === 'EP'
      || authRole === 'LINEPRODUCER'
      || membershipRole === 'EP'
      || membershipRole === 'LINE_PRODUCER'
      || projectRole === 'EXECUTIVE_PRODUCER'
      || projectRole === 'LINE_PRODUCER'
      || projectRole === 'PRODUCTION_MANAGER',
  )
}

async function resolveActorName(userId: string | null | undefined, fallback?: string | null) {
  if (!userId) {
    return fallback?.trim() || 'ProdSync'
  }

  const { data, error } = await adminClient
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return String((data as { full_name?: string | null } | null)?.full_name ?? fallback ?? 'ProdSync')
}

export async function recordProjectPhaseChange(input: ProjectPhaseAuditInput) {
  if (input.previousPhase === input.nextPhase) {
    return
  }

  const actorName = await resolveActorName(input.changedBy, input.changedByName)
  const source = input.source?.trim() || 'manual'
  const notes = input.notes?.trim() || null
  const previousLabel = formatProjectPhaseLabel(input.previousPhase)
  const nextLabel = formatProjectPhaseLabel(input.nextPhase)

  const [{ error: historyError }, { error: activityError }, { error: alertError }] = await Promise.all([
    adminClient.from('project_phase_history').insert({
      project_id: input.projectId,
      previous_phase: input.previousPhase,
      new_phase: input.nextPhase,
      changed_by: input.changedBy,
      notes,
      source,
      metadata: {
        previousPhaseLabel: previousLabel,
        newPhaseLabel: nextLabel,
      },
    }),
    adminClient.from('activity_logs').insert({
      project_id: input.projectId,
      user_id: input.changedBy,
      action: 'project_phase_changed',
      entity: 'project_phase',
      entity_id: input.projectId,
      entity_label: `Project phase changed to ${nextLabel}`,
      old_data: input.previousPhase ? { phase: input.previousPhase, label: previousLabel } : null,
      new_data: { phase: input.nextPhase, label: nextLabel, notes, source },
      context: {
        previousPhase: input.previousPhase,
        previousPhaseLabel: previousLabel,
        newPhase: input.nextPhase,
        newPhaseLabel: nextLabel,
        changedByName: actorName,
        source,
        notes,
      },
    }),
    adminClient.from('alerts').insert({
      project_id: input.projectId,
      source: 'system',
      severity: 'info',
      title: 'Project phase updated',
      message: `${actorName} changed the workflow from ${previousLabel} to ${nextLabel}.`,
      status: 'open',
      metadata: {
        eventType: 'project_phase_changed',
        previousPhase: input.previousPhase,
        newPhase: input.nextPhase,
        changedBy: input.changedBy,
        changedByName: actorName,
        notes,
        source,
      },
    }),
  ])

  if (historyError) throw historyError
  if (activityError) throw activityError
  if (alertError) throw alertError
}

export async function listProjectPhaseHistory(projectId: string): Promise<ProjectPhaseHistoryItem[]> {
  const { data, error } = await adminClient
    .from('project_phase_history')
    .select('id, project_id, previous_phase, new_phase, changed_by, changed_at, notes, source')
    .eq('project_id', projectId)
    .order('changed_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') {
      return []
    }
    throw error
  }

  const rows = (data ?? []) as Array<{
    id: string
    project_id: string
    previous_phase: ProjectPhase | null
    new_phase: ProjectPhase
    changed_by: string | null
    changed_at: string
    notes: string | null
    source: string | null
  }>

  const actorIds = Array.from(new Set(rows.map(row => row.changed_by).filter((value): value is string => Boolean(value))))
  const actorMap = new Map<string, string>()

  if (actorIds.length > 0) {
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id, full_name')
      .in('id', actorIds)

    if (usersError) {
      throw usersError
    }

    for (const row of (users ?? []) as Array<{ id: string; full_name: string | null }>) {
      actorMap.set(row.id, row.full_name ?? 'ProdSync')
    }
  }

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    previousPhase: row.previous_phase,
    newPhase: row.new_phase,
    changedBy: row.changed_by,
    changedByName: row.changed_by ? actorMap.get(row.changed_by) ?? 'ProdSync' : 'ProdSync',
    changedAt: row.changed_at,
    notes: row.notes,
    source: row.source ?? 'manual',
  }))
}
