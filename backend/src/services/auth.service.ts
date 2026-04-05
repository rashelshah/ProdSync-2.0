import type { User } from '@supabase/supabase-js'
import { adminClient } from '../config/supabaseClient'
import { HttpError } from '../utils/httpError'

export interface AuthenticatedUserContext {
  id: string
  email: string | null
  fullName: string | null
  role: string | null
  department: string | null
  projectRoleTitle: string | null
  userMetadata: User['user_metadata']
}

function mapAuthUser(user: User): AuthenticatedUserContext {
  const rawRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role.trim() : null
  const normalizedRole = rawRole === 'LineProducer'
    ? 'LINE_PRODUCER'
    : rawRole === 'DataWrangler'
      ? 'DATA_WRANGLER'
      : rawRole === 'Driver'
        ? 'DRIVER'
        : rawRole

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    role: normalizedRole ?? null,
    department: user.user_metadata?.department_id ?? null,
    projectRoleTitle: user.user_metadata?.project_role_title ?? null,
    userMetadata: user.user_metadata,
  }
}

export async function getUserFromAccessToken(accessToken: string) {
  const { data, error } = await adminClient.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new HttpError(401, 'Invalid or expired access token.')
  }

  return mapAuthUser(data.user)
}
