import type { User } from '@supabase/supabase-js'
import { adminClient } from '../config/supabaseClient'
import { HttpError } from '../utils/httpError'

export type AuthProvider = 'email' | 'google' | 'both'
export type SessionProvider = 'email' | 'google' | null

interface UserProfileRow {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  department: string | null
  avatar_url: string | null
  auth_provider: string | null
  supabase_user_id: string | null
  is_google_linked: boolean | null
  onboarding_completed_at: string | null
  metadata: Record<string, unknown> | null
}

export interface AuthenticatedUserContext {
  id: string
  authUserId: string
  email: string | null
  fullName: string | null
  role: string | null
  department: string | null
  projectRoleTitle: string | null
  avatarUrl: string | null
  authProvider: AuthProvider | null
  isGoogleLinked: boolean
  onboardingCompletedAt: string | null
  needsOnboarding: boolean
  sessionProvider: SessionProvider
  userMetadata: Record<string, unknown>
  profileMetadata: Record<string, unknown>
}

export interface CompleteGoogleOnboardingInput {
  departmentId: string
  projectRoleTitle: string
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function getSessionProvider(user: User): SessionProvider {
  const appMetadata = asMetadata((user as User & { app_metadata?: Record<string, unknown> }).app_metadata)
  const provider = typeof appMetadata.provider === 'string' ? appMetadata.provider.trim().toLowerCase() : ''

  if (provider === 'google') {
    return 'google'
  }

  if (provider === 'email') {
    return 'email'
  }

  return null
}

function normalizeAuthProvider(rawProvider?: string | null, sessionProvider?: SessionProvider): AuthProvider | null {
  const normalized = rawProvider?.trim().toLowerCase()

  if (normalized === 'email' || normalized === 'google' || normalized === 'both') {
    return normalized
  }

  if (sessionProvider === 'google') {
    return 'google'
  }

  if (sessionProvider === 'email') {
    return 'email'
  }

  return null
}

function hasOnboardingMetadata(profileMetadata: Record<string, unknown>) {
  return true
}

function mapAuthenticatedUser(authUser: User, row: UserProfileRow): AuthenticatedUserContext {
  const userMetadata = asMetadata(authUser.user_metadata)
  const profileMetadata = asMetadata(row.metadata)
  const sessionProvider = getSessionProvider(authUser)
  const authProvider = normalizeAuthProvider(row.auth_provider, sessionProvider)
  const fullName =
    row.full_name ??
    (typeof userMetadata.full_name === 'string' ? userMetadata.full_name : null) ??
    (typeof userMetadata.name === 'string' ? userMetadata.name : null) ??
    authUser.email ??
    null

  return {
    id: row.id,
    authUserId: authUser.id,
    email: row.email ?? authUser.email ?? null,
    fullName,
    role: row.role ?? null,
    department: row.department ?? null,
    projectRoleTitle: typeof profileMetadata.project_role_title === 'string' ? profileMetadata.project_role_title : null,
    avatarUrl:
      row.avatar_url ??
      (typeof userMetadata.avatar_url === 'string' ? userMetadata.avatar_url : null),
    authProvider,
    isGoogleLinked: Boolean(row.is_google_linked || authProvider === 'google' || authProvider === 'both'),
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    needsOnboarding: !hasOnboardingMetadata(profileMetadata),
    sessionProvider,
    userMetadata,
    profileMetadata,
  }
}

async function getSupabaseUser(accessToken: string) {
  const { data, error } = await adminClient.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new HttpError(401, 'Invalid or expired access token.')
  }

  return data.user
}

async function findUserById(id: string) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, email, role, department, avatar_url, auth_provider, supabase_user_id, is_google_linked, onboarding_completed_at, metadata')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as UserProfileRow | null) ?? null
}

async function findUserBySupabaseUserId(id: string) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, email, role, department, avatar_url, auth_provider, supabase_user_id, is_google_linked, onboarding_completed_at, metadata')
    .eq('supabase_user_id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as UserProfileRow | null) ?? null
}

async function findUserByEmail(email: string) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name, email, role, department, avatar_url, auth_provider, supabase_user_id, is_google_linked, onboarding_completed_at, metadata')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as UserProfileRow | null) ?? null
}

async function findCanonicalUser(authUser: User) {
  const byId = await findUserById(authUser.id)
  if (byId) {
    return byId
  }

  const bySupabaseUserId = await findUserBySupabaseUserId(authUser.id)
  if (bySupabaseUserId) {
    return bySupabaseUserId
  }

  if (authUser.email) {
    const byEmail = await findUserByEmail(authUser.email)
    if (byEmail) {
      return byEmail
    }
  }

  return null
}

function nextGoogleAuthProvider(currentProvider: AuthProvider | null) {
  if (currentProvider === 'both') {
    return 'both' satisfies AuthProvider
  }

  if (currentProvider === 'email') {
    return 'both' satisfies AuthProvider
  }

  return 'google' satisfies AuthProvider
}

const projectRoleToAccessRole: Record<string, string> = {
  'Executive Producer': 'EP',
  'Line Producer': 'LINE_PRODUCER',
  'Production Manager': 'SUPERVISOR',
  '1st AD': 'SUPERVISOR',
  DOP: 'HOD',
  '1st AC': 'SUPERVISOR',
  'Camera Operator': 'CREW',
  'Art Director': 'HOD',
  'Art Assistant': 'CREW',
  'Transport Captain': 'HOD',
  Driver: 'DRIVER',
  Editor: 'HOD',
  Colorist: 'SUPERVISOR',
  'Costume Supervisor': 'HOD',
  'Wardrobe Stylist': 'CREW',
  'Crew Member': 'CREW',
  'Data Wrangler': 'DATA_WRANGLER',
}

const projectRoleToDepartment: Record<string, string> = {
  'Executive Producer': 'production',
  'Line Producer': 'production',
  'Production Manager': 'production',
  '1st AD': 'production',
  DOP: 'camera',
  '1st AC': 'camera',
  'Camera Operator': 'camera',
  'Art Director': 'art',
  'Art Assistant': 'art',
  'Transport Captain': 'transport',
  Driver: 'transport',
  Editor: 'post',
  Colorist: 'post',
  'Costume Supervisor': 'wardrobe',
  'Wardrobe Stylist': 'wardrobe',
  'Crew Member': 'production',
  'Data Wrangler': 'camera',
}

function accessRoleToMetadataRole(accessRole: string) {
  if (accessRole === 'LINE_PRODUCER') return 'LineProducer'
  if (accessRole === 'DATA_WRANGLER') return 'DataWrangler'
  if (accessRole === 'DRIVER') return 'Driver'
  if (accessRole === 'SUPERVISOR') return 'Supervisor'
  if (accessRole === 'CREW') return 'Crew'
  return accessRole
}

function assertGoogleSession(user: AuthenticatedUserContext) {
  if (user.sessionProvider !== 'google') {
    throw new HttpError(400, 'This endpoint requires an authenticated Google session.')
  }
}

export async function getUserFromAccessToken(accessToken: string) {
  const authUser = await getSupabaseUser(accessToken)
  const canonicalUser = await findCanonicalUser(authUser)

  if (!canonicalUser) {
    throw new HttpError(404, 'Authenticated user profile could not be resolved.')
  }

  return mapAuthenticatedUser(authUser, canonicalUser)
}

export async function syncGoogleLogin(user: AuthenticatedUserContext) {
  assertGoogleSession(user)

  const metadata = {
    ...user.profileMetadata,
    ...user.userMetadata,
    full_name: user.fullName ?? user.profileMetadata.full_name ?? user.userMetadata.full_name ?? user.userMetadata.name ?? null,
    avatar_url: user.avatarUrl ?? user.profileMetadata.avatar_url ?? user.userMetadata.avatar_url ?? null,
  }

  const { error } = await adminClient
    .from('users')
    .update({
      full_name: user.fullName ?? 'ProdSync User',
      avatar_url: user.avatarUrl,
      auth_provider: nextGoogleAuthProvider(user.authProvider),
      supabase_user_id: user.authUserId,
      is_google_linked: true,
      metadata,
    })
    .eq('id', user.id)

  if (error) {
    throw error
  }
}

export async function completeGoogleOnboarding(user: AuthenticatedUserContext, input: CompleteGoogleOnboardingInput) {
  assertGoogleSession(user)

  const accessRole = projectRoleToAccessRole[input.projectRoleTitle]
  const expectedDepartment = projectRoleToDepartment[input.projectRoleTitle]

  if (!accessRole || !expectedDepartment) {
    throw new HttpError(400, 'Unsupported project role selection.')
  }

  if (expectedDepartment !== input.departmentId) {
    throw new HttpError(400, 'Selected role does not belong to the chosen department.')
  }

  const metadata = {
    ...user.profileMetadata,
    ...user.userMetadata,
    full_name: user.fullName ?? 'ProdSync User',
    department_id: input.departmentId,
    project_role_title: input.projectRoleTitle,
    role: accessRoleToMetadataRole(accessRole),
    role_label: input.projectRoleTitle,
    avatar_url: user.avatarUrl ?? null,
  }

  const { error } = await adminClient
    .from('users')
    .update({
      full_name: user.fullName ?? 'ProdSync User',
      role: accessRole,
      department: input.departmentId,
      avatar_url: user.avatarUrl,
      auth_provider: nextGoogleAuthProvider(user.authProvider),
      supabase_user_id: user.authUserId,
      is_google_linked: true,
      onboarding_completed_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', user.id)

  if (error) {
    throw error
  }
}
