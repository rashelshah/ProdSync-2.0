import { adminClient } from '../config/supabaseClient'

export interface ProjectAccessResult {
  isMember: boolean
  isOwner: boolean
  membershipRole: string | null
  projectRole: string | null
  department: string | null
  hasApprovedJoinRequest: boolean
}

export async function getProjectAccess(projectId: string, userId: string): Promise<ProjectAccessResult> {
  const [{ data: membership }, { data: project }, { data: joinRequest }] = await Promise.all([
    adminClient
      .from('project_members')
      .select('access_role, role, department')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle(),
    adminClient
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle(),
    adminClient
      .from('project_join_requests')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .maybeSingle(),
  ])

  return {
    isMember: Boolean(membership),
    isOwner: project?.owner_id === userId,
    membershipRole: membership?.access_role ?? null,
    projectRole: membership?.role ?? null,
    department: membership?.department ?? null,
    hasApprovedJoinRequest: Boolean(joinRequest),
  }
}
