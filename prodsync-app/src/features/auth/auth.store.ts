import { create } from 'zustand'
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js'
import { apiBaseUrl } from '@/lib/api'
import { getDepartmentLabel, getProjectRoleTitle, getUserRoleLabel } from './onboarding'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { ProjectDepartment, ProjectRequestedRole, User, UserRole } from '@/types'

type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'not_configured' | 'account_not_found' | 'invalid_password' | 'unexpected'; message?: string }

type GoogleSignInResult =
  | { ok: true; redirected: boolean; user?: User }
  | { ok: false; reason: 'not_configured' | 'unexpected'; message?: string }

type GoogleCallbackResult =
  | { ok: true; user: User; needsOnboarding: boolean }
  | { ok: false; reason: 'not_configured' | 'not_authenticated' | 'unexpected'; message?: string }

type GoogleOnboardingResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'not_configured' | 'not_authenticated' | 'unexpected'; message?: string }

type RegisterResult =
  | { ok: true; user: User; requiresEmailConfirmation: boolean }
  | { ok: false; reason: 'not_configured' | 'email_exists' | 'phone_exists' | 'unexpected'; message?: string }

interface RegisterAccountInput {
  name: string
  phone: string
  email: string
  password: string
  role: UserRole
  roleLabel: string
  projectRoleTitle: ProjectRequestedRole
  departmentId: ProjectDepartment
  avatarUrl?: string
}

interface CompleteGoogleOnboardingInput {
  departmentId: ProjectDepartment
  projectRoleTitle: ProjectRequestedRole
}

interface BackendAuthUser {
  id: string
  authUserId: string
  email: string | null
  fullName: string | null
  role: string | null
  department: string | null
  projectRoleTitle: string | null
  avatarUrl: string | null
  authProvider: string | null
  isGoogleLinked: boolean
  onboardingCompletedAt: string | null
}

interface BackendAuthStateResponse {
  user: BackendAuthUser
  needsOnboarding: boolean
  sessionProvider: string | null
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isAuthReady: boolean
  sessionExpiresAt: number | null
  needsOnboarding: boolean
  sessionProvider: 'email' | 'google' | null
  initializeAuth: () => Promise<void>
  setSession: (session: Session | null) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>
  signInWithGoogle: () => Promise<GoogleSignInResult>
  finalizeGoogleSignIn: () => Promise<GoogleCallbackResult>
  completeGoogleOnboarding: (input: CompleteGoogleOnboardingInput) => Promise<GoogleOnboardingResult>
  registerAccount: (account: RegisterAccountInput) => Promise<RegisterResult>
  logout: () => Promise<void>
  switchRole: (_role: UserRole) => Promise<void>
}

let authSubscriptionBound = false

function normalizeUserRole(rawRole?: string | null): UserRole {
  const role = rawRole?.trim()

  if (role === 'EP') return 'EP'
  if (role === 'LINE_PRODUCER' || role === 'LineProducer') return 'LineProducer'
  if (role === 'HOD') return 'HOD'
  if (role === 'SUPERVISOR' || role === 'Supervisor') return 'Supervisor'
  if (role === 'DRIVER' || role === 'Driver') return 'Driver'
  if (role === 'DATA_WRANGLER' || role === 'DataWrangler') return 'DataWrangler'

  return 'Crew'
}

function normalizeDepartment(rawDepartment?: string | null): ProjectDepartment {
  const department = rawDepartment?.trim()
  if (department === 'camera' || department === 'art' || department === 'transport' || department === 'production' || department === 'wardrobe' || department === 'post') {
    return department
  }

  return 'production'
}

function normalizeProjectRoleTitle(rawRoleTitle: unknown, role: UserRole): ProjectRequestedRole {
  if (typeof rawRoleTitle === 'string' && rawRoleTitle.trim()) {
    return rawRoleTitle as ProjectRequestedRole
  }

  return getProjectRoleTitle({ role, departmentId: undefined, projectRoleTitle: undefined })
}

function mapAuthUserToAppUser(authUser: SupabaseAuthUser): User {
  const role = normalizeUserRole(typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role : null)
  const departmentId = normalizeDepartment(typeof authUser.user_metadata?.department_id === 'string' ? authUser.user_metadata.department_id : null)
  const projectRoleTitle = normalizeProjectRoleTitle(authUser.user_metadata?.project_role_title, role)
  const name = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email ?? 'ProdSync User'

  return {
    id: authUser.id,
    name,
    email: authUser.email ?? undefined,
    role,
    roleLabel: getUserRoleLabel({ role, projectRoleTitle, departmentId }),
    projectRoleTitle,
    departmentId,
    departmentLabel: getDepartmentLabel(departmentId),
    avatarUrl: typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : undefined,
  }
}

function mapBackendUserToAppUser(authUser: BackendAuthUser): User {
  const role = normalizeUserRole(authUser.role)
  const departmentId = normalizeDepartment(authUser.department)
  const projectRoleTitle = normalizeProjectRoleTitle(authUser.projectRoleTitle, role)
  const name = authUser.fullName?.trim() || authUser.email || 'ProdSync User'

  return {
    id: authUser.id,
    name,
    email: authUser.email ?? undefined,
    role,
    roleLabel: getUserRoleLabel({ role, projectRoleTitle, departmentId }),
    projectRoleTitle,
    departmentId,
    departmentLabel: getDepartmentLabel(departmentId),
    avatarUrl: authUser.avatarUrl ?? undefined,
  }
}

function sessionExpiresAt(session: Session | null) {
  return session?.expires_at ? session.expires_at * 1000 : null
}

function normalizeSessionProvider(rawProvider?: string | null): 'email' | 'google' | null {
  if (rawProvider === 'email' || rawProvider === 'google') {
    return rawProvider
  }

  return null
}

function clearAuthState() {
  return {
    user: null,
    isAuthenticated: false,
    sessionExpiresAt: null,
    needsOnboarding: false,
    sessionProvider: null,
  }
}

async function readAuthenticatedJson<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)

  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null
    throw new Error(payload?.error ?? payload?.message ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function hydrateFromSession(session: Session) {
  const payload = await readAuthenticatedJson<BackendAuthStateResponse>('/auth/me', session.access_token)

  return {
    user: mapBackendUserToAppUser(payload.user),
    isAuthenticated: true,
    sessionExpiresAt: sessionExpiresAt(session),
    needsOnboarding: payload.needsOnboarding,
    sessionProvider: normalizeSessionProvider(payload.sessionProvider),
  }
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,
  sessionExpiresAt: null,
  needsOnboarding: false,
  sessionProvider: null,

  initializeAuth: async () => {
    if (!isSupabaseConfigured) {
      set({ ...clearAuthState(), isAuthReady: true })
      return
    }

    const { data } = await supabase.auth.getSession()
    await get().setSession(data.session)

    if (!authSubscriptionBound) {
      authSubscriptionBound = true
      supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
        void get().setSession(session)
      })
    }
  },

  setSession: async (session) => {
    if (!session?.user) {
      set({
        ...clearAuthState(),
        isAuthReady: true,
      })
      return
    }

    try {
      const hydratedState = await hydrateFromSession(session)
      set({
        ...hydratedState,
        isAuthReady: true,
      })
      return
    } catch (error) {
      console.error('[authStore] backend auth hydration failed', error)
    }

    set({
      ...clearAuthState(),
      isAuthReady: true,
    })
  },

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: 'not_configured', message: 'Supabase environment variables are missing.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('invalid login credentials')) {
        return { ok: false, reason: 'invalid_password', message: error.message }
      }
      if (message.includes('email not confirmed')) {
        return { ok: false, reason: 'unexpected', message: error.message }
      }

      return { ok: false, reason: 'account_not_found', message: error.message }
    }

    await get().setSession(data.session)
    const nextUser = get().user

    if (!nextUser) {
      return { ok: false, reason: 'unexpected', message: 'Account session could not be verified by the backend.' }
    }

    return { ok: true, user: nextUser }
  },

  signInWithGoogle: async () => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: 'not_configured', message: 'Supabase environment variables are missing.' }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      return { ok: false, reason: 'unexpected', message: error.message }
    }

    return { ok: true, redirected: true }
  },

  finalizeGoogleSignIn: async () => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: 'not_configured', message: 'Supabase environment variables are missing.' }
    }

    const { data } = await supabase.auth.getSession()
    const session = data.session

    if (!session) {
      return { ok: false, reason: 'not_authenticated', message: 'No active Google session was found.' }
    }

    try {
      const payload = await readAuthenticatedJson<BackendAuthStateResponse & { isNewUser: boolean }>(
        '/auth/google-login',
        session.access_token,
        { method: 'POST' },
      )

      const nextUser = mapBackendUserToAppUser(payload.user)
      set({
        user: nextUser,
        isAuthenticated: true,
        isAuthReady: true,
        sessionExpiresAt: sessionExpiresAt(session),
        needsOnboarding: payload.needsOnboarding,
        sessionProvider: normalizeSessionProvider(payload.sessionProvider),
      })

      return { ok: true, user: nextUser, needsOnboarding: payload.needsOnboarding }
    } catch (error) {
      return {
        ok: false,
        reason: 'unexpected',
        message: error instanceof Error ? error.message : 'Google sign-in could not be completed.',
      }
    }
  },

  completeGoogleOnboarding: async (input) => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: 'not_configured', message: 'Supabase environment variables are missing.' }
    }

    const { data } = await supabase.auth.getSession()
    const session = data.session

    if (!session) {
      return { ok: false, reason: 'not_authenticated', message: 'No authenticated Google session was found.' }
    }

    try {
      const payload = await readAuthenticatedJson<BackendAuthStateResponse>(
        '/auth/google-onboarding',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )

      const nextUser = mapBackendUserToAppUser(payload.user)
      set({
        user: nextUser,
        isAuthenticated: true,
        isAuthReady: true,
        sessionExpiresAt: sessionExpiresAt(session),
        needsOnboarding: payload.needsOnboarding,
        sessionProvider: normalizeSessionProvider(payload.sessionProvider),
      })

      return { ok: true, user: nextUser }
    } catch (error) {
      return {
        ok: false,
        reason: 'unexpected',
        message: error instanceof Error ? error.message : 'Google onboarding could not be completed.',
      }
    }
  },

  registerAccount: async (account) => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: 'not_configured', message: 'Supabase environment variables are missing.' }
    }

    const { data, error } = await supabase.auth.signUp({
      email: account.email.trim(),
      password: account.password,
      options: {
        data: {
          full_name: account.name.trim(),
          phone: account.phone.trim(),
          role: account.role,
          role_label: account.roleLabel,
          project_role_title: account.projectRoleTitle,
          department_id: account.departmentId,
          avatar_url: account.avatarUrl,
        },
      },
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('already registered') || message.includes('already exists')) {
        return { ok: false, reason: 'email_exists', message: error.message }
      }

      return { ok: false, reason: 'unexpected', message: error.message }
    }

    if (!data.user) {
      return { ok: false, reason: 'unexpected', message: 'Account creation did not return a user.' }
    }

    if (data.session) {
      await get().setSession(data.session)
    }

    const nextUser = data.session ? get().user : mapAuthUserToAppUser(data.user)

    if (!nextUser) {
      return { ok: false, reason: 'unexpected', message: 'Account session could not be verified by the backend.' }
    }

    return {
      ok: true,
      user: nextUser,
      requiresEmailConfirmation: !data.session,
    }
  },

  logout: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }

    set({
      ...clearAuthState(),
      isAuthReady: true,
    })
  },

  switchRole: async () => {
    return
  },
}))

export function hasActiveSession(state: Pick<AuthStore, 'isAuthenticated' | 'user' | 'sessionExpiresAt'>) {
  return Boolean(state.isAuthenticated && state.user && (!state.sessionExpiresAt || state.sessionExpiresAt > Date.now()))
}

export const Permissions = {
  canApproveExpense: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canViewFinancials: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canManageCrew: (role: UserRole) =>
    (['EP', 'LineProducer', 'HOD', 'Supervisor'] as UserRole[]).includes(role),
  canAccessAllModules: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canManageProjects: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canViewOwnData: () => true,
}
