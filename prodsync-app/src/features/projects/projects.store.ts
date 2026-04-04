import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ProjectsStore {
  activeProjectId: string | null
  setActiveProject: (projectId: string | null) => void
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProject: (projectId) => set({ activeProjectId: projectId }),
    }),
    {
      name: 'prodsync-projects',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        activeProjectId: state.activeProjectId,
      }),
      migrate: (persistedState) => ({
        activeProjectId:
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'activeProjectId' in persistedState &&
          typeof persistedState.activeProjectId === 'string'
            ? persistedState.activeProjectId
            : null,
      }),
    },
  ),
)
