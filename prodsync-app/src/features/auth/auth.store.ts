import { create } from 'zustand'
import type { User, UserRole } from '@/types'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
  switchRole: (role: UserRole) => void // for demo purposes
}

// Default mock user (Executive Producer)
const DEFAULT_USER: User = {
  id: 'user-1',
  name: 'K. Sharma',
  role: 'EP',
  departmentId: undefined,
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: DEFAULT_USER,
  isAuthenticated: true,

  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),

  switchRole: (role) =>
    set((state) => ({
      user: state.user ? { ...state.user, role } : null,
    })),
}))

// Typed permission helpers
export const Permissions = {
  canApproveExpense: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canViewFinancials: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canManageCrew: (role: UserRole) =>
    (['EP', 'LineProducer', 'HOD'] as UserRole[]).includes(role),
  canAccessAllModules: (role: UserRole) =>
    (['EP', 'LineProducer'] as UserRole[]).includes(role),
  canViewOwnData: (_role: UserRole) => true,
}
