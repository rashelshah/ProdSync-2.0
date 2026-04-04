import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getDepartmentLabel, getProjectRoleTitle, getUserRoleLabel } from './onboarding'
import type { ProjectDepartment, ProjectRequestedRole, User, UserRole } from '@/types'

const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const LEGACY_PASSWORD = 'ProdSync!1'
const GOOGLE_DEMO_ACCOUNT = {
  name: 'Google Producer',
  phone: '',
  email: 'google.producer@prodsync.app',
  password: 'ProdSync!1',
  role: 'EP' as UserRole,
  roleLabel: 'Executive Producer',
  projectRoleTitle: 'Executive Producer' as ProjectRequestedRole,
  departmentId: 'production' as ProjectDepartment,
  avatarUrl: undefined,
}

interface AuthAccount extends User {
  phone: string
  email: string
  password?: string
}

type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'account_not_found' | 'invalid_password' }

type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'email_exists' | 'phone_exists' }

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
  accounts: AuthAccount[]
  user: User | null
  isAuthenticated: boolean
  sessionExpiresAt: number | null
  login: (user: User) => void
  signInWithEmail: (email: string, password: string) => SignInResult
  signInWithGoogle: () => User
  registerAccount: (account: RegisterAccountInput) => RegisterResult
  logout: () => void
  switchRole: (role: UserRole) => void
}

function createSessionExpiry() {
  return Date.now() + SESSION_TTL_MS
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, '')
}

function createAccountId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `user-${Date.now()}`
}

function hydrateUser(account: AuthAccount): User {
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    roleLabel: account.roleLabel ?? getUserRoleLabel(account),
    projectRoleTitle: account.projectRoleTitle ?? getProjectRoleTitle(account),
    departmentId: account.departmentId,
    departmentLabel: account.departmentLabel ?? getDepartmentLabel(account.departmentId),
    avatarUrl: account.avatarUrl,
  }
}

function normalizeAccount(account: AuthAccount): AuthAccount {
  return {
    ...account,
    email: normalizeValue(account.email),
    phone: account.phone.trim(),
    password: account.password ?? LEGACY_PASSWORD,
    roleLabel: account.roleLabel ?? getUserRoleLabel(account),
    projectRoleTitle: account.projectRoleTitle ?? getProjectRoleTitle(account),
    departmentLabel: account.departmentLabel ?? getDepartmentLabel(account.departmentId),
  }
}

function normalizePersistedUser(user: User): User {
  return {
    ...user,
    roleLabel: getUserRoleLabel(user),
    projectRoleTitle: getProjectRoleTitle(user),
    departmentLabel: user.departmentLabel ?? getDepartmentLabel(user.departmentId),
  }
}

function withSession(user: User) {
  return {
    user,
    isAuthenticated: true,
    sessionExpiresAt: createSessionExpiry(),
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,

      login: (user) =>
        set(withSession({
          ...user,
          roleLabel: getUserRoleLabel(user),
          projectRoleTitle: getProjectRoleTitle(user),
          departmentLabel: user.departmentLabel ?? getDepartmentLabel(user.departmentId),
        })),

      signInWithEmail: (email, password) => {
        const normalizedEmail = normalizeValue(email)
        const account = get().accounts.find(savedAccount => normalizeValue(savedAccount.email) === normalizedEmail)

        if (!account) {
          return { ok: false, reason: 'account_not_found' }
        }

        if ((account.password ?? LEGACY_PASSWORD) !== password) {
          return { ok: false, reason: 'invalid_password' }
        }

        const user = hydrateUser(account)
        set(withSession(user))
        return { ok: true, user }
      },

      signInWithGoogle: () => {
        const existing = get().accounts.find(account => normalizeValue(account.email) === GOOGLE_DEMO_ACCOUNT.email)
        const nextAccount = existing ?? normalizeAccount({
          ...GOOGLE_DEMO_ACCOUNT,
          id: createAccountId(),
        })
        const user = hydrateUser(nextAccount)

        set(state => ({
          accounts: existing ? state.accounts : [nextAccount, ...state.accounts],
          ...withSession(user),
        }))

        return user
      },

      registerAccount: (account) => {
        const normalizedEmail = normalizeValue(account.email)
        const normalizedPhone = normalizePhone(account.phone)
        const existingEmail = get().accounts.find(savedAccount => normalizeValue(savedAccount.email) === normalizedEmail)
        if (existingEmail) {
          return { ok: false, reason: 'email_exists' }
        }

        const existingPhone = get().accounts.find(savedAccount => normalizePhone(savedAccount.phone) === normalizedPhone)
        if (existingPhone) {
          return { ok: false, reason: 'phone_exists' }
        }

        const nextAccount = normalizeAccount({
          ...account,
          id: createAccountId(),
          email: normalizedEmail,
        })

        const user = hydrateUser(nextAccount)

        set(state => ({
          accounts: [nextAccount, ...state.accounts],
          ...withSession(user),
        }))

        return { ok: true, user }
      },

      logout: () => set({ user: null, isAuthenticated: false, sessionExpiresAt: null }),

      switchRole: (role) =>
        set(state => {
          if (!state.user) return state

          const nextUser: User = {
            ...state.user,
            role,
            roleLabel: getUserRoleLabel({ ...state.user, role, roleLabel: undefined }),
            projectRoleTitle: getProjectRoleTitle({ ...state.user, role, projectRoleTitle: undefined }),
          }

          return {
            user: nextUser,
            accounts: state.accounts.map(account =>
              account.id === state.user?.id
                ? normalizeAccount({
                    ...account,
                    role,
                    roleLabel: nextUser.roleLabel,
                    projectRoleTitle: nextUser.projectRoleTitle,
                  })
                : account,
            ),
            sessionExpiresAt: createSessionExpiry(),
          }
        }),
    }),
    {
      name: 'prodsync-auth',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        accounts: state.accounts,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthStore> | undefined
        const accounts = Array.isArray(state?.accounts) ? state.accounts.map(account => normalizeAccount(account as AuthAccount)) : []
        const user = state?.user ? normalizePersistedUser(state.user as User) : null

        return {
          accounts,
          user,
          isAuthenticated: Boolean(state?.isAuthenticated && user),
          sessionExpiresAt: state?.sessionExpiresAt ?? null,
        }
      },
    },
  ),
)

export function hasActiveSession(state: Pick<AuthStore, 'isAuthenticated' | 'user' | 'sessionExpiresAt'>) {
  return Boolean(state.isAuthenticated && state.user && state.sessionExpiresAt && state.sessionExpiresAt > Date.now())
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
