import { create } from 'zustand'
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js'
import { getDepartmentLabel, getProjectRoleTitle, getUserRoleLabel } from './onboarding'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { ProjectDepartment, ProjectRequestedRole, User, UserRole } from '@/types'

type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'not_configured' | 'account_not_found' | 'invalid_password' | 'unexpected'; message?: string }

type GoogleSignInResult =
  | { ok: true; redirected: boolean; user?: User }
  | { ok: false; reason: 'not_configured' | 'unexpected'; message?: string }

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

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isAuthReady: boolean
  sessionExpiresAt: number | null
  initializeAuth: () => Promise<void>
  setSession: (session: Session | null) => void
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>
  signInWithGoogle: () => Promise<GoogleSignInResult>
  registerAccount: (account: RegisterAccountInput) => Promise<RegisterResult>
  logout: () => Promise<void>
  switchRole: (_role: UserRole) => Promise<void>
}

let authSubscriptionBound = false

function normalizeUserRole(rawRole?: string | null): UserRole {
  const role = rawRole?.trim()
  if (role === 'EP' || role === 'LineProducer' || role === 'HOD' || role === 'Supervisor' || role === 'Crew' || role === 'Driver' || role === 'DataWrangler') {
    return role
  }

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
  const role = normalizeUserRole(authUser.user_metadata?.role)
  const departmentId = normalizeDepartment(authUser.user_metadata?.department_id)
  const projectRoleTitle = normalizeProjectRoleTitle(authUser.user_metadata?.project_role_title, role)
  const name = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email ?? 'ProdSync User'

  return {
    id: authUser.id,
    name,
    role,
    roleLabel: getUserRoleLabel({ role, projectRoleTitle, departmentId }),
    projectRoleTitle,
    departmentId,
    departmentLabel: getDepartmentLabel(departmentId),
    avatarUrl: authUser.user_metadata?.avatar_url,
  }
}

function sessionPayload(session: Session | null) {
  if (!session?.user) {
    return {
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
    }
  }

  return {
    user: mapAuthUserToAppUser(session.user),
    isAuthenticated: true,
    sessionExpiresAt: session.expires_at ? session.expires_at * 1000 : null,
  }
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,
  sessionExpiresAt: null,

  initializeAuth: async () => {
    if (!isSupabaseConfigured) {
      set({ isAuthReady: true, user: null, isAuthenticated: false, sessionExpiresAt: null })
      return
    }

    const { data } = await supabase.auth.getSession()
    set({
      ...sessionPayload(data.session),
      isAuthReady: true,
    })

    if (!authSubscriptionBound) {
      authSubscriptionBound = true
      supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
        get().setSession(session)
      })
    }
  },

  setSession: (session) => {
    set({
      ...sessionPayload(session),
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

    const nextUser = data.user ? mapAuthUserToAppUser(data.user) : null
    set(sessionPayload(data.session))

    if (!nextUser) {
      return { ok: false, reason: 'unexpected', message: 'No user session was returned.' }
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
        redirectTo: `${window.location.origin}/projects`,
      },
    })

    if (error) {
      return { ok: false, reason: 'unexpected', message: error.message }
    }

    return { ok: true, redirected: true }
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

    const nextUser = mapAuthUserToAppUser(data.user)
    set(sessionPayload(data.session))

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
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
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
