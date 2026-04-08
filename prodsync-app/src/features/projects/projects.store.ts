import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { ProjectCurrency } from '@/types'

interface ProjectsStore {
  activeProjectId: string | null
  activeProjectCurrency: ProjectCurrency
  setActiveProject: (projectId: string | null, currency?: ProjectCurrency | null) => void
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeProjectCurrency: 'INR',
      setActiveProject: (projectId, currency) => set({
        activeProjectId: projectId,
        activeProjectCurrency: currency ?? 'INR',
      }),
    }),
    {
      name: 'prodsync-projects',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        activeProjectId: state.activeProjectId,
        activeProjectCurrency: state.activeProjectCurrency,
      }),
      migrate: (persistedState) => ({
        activeProjectId:
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'activeProjectId' in persistedState &&
          typeof persistedState.activeProjectId === 'string'
            ? persistedState.activeProjectId
            : null,
        activeProjectCurrency:
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'activeProjectCurrency' in persistedState &&
          (persistedState.activeProjectCurrency === 'INR' || persistedState.activeProjectCurrency === 'USD' || persistedState.activeProjectCurrency === 'EUR')
            ? persistedState.activeProjectCurrency
            : 'INR',
      }),
    },
  ),
)
