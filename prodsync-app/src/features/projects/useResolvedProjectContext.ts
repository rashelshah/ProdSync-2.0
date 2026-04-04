import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { projectsService } from '@/services/projects.service'

export function useResolvedProjectContext() {
  const user = useAuthStore(state => state.user)
  const activeProjectId = useProjectsStore(state => state.activeProjectId)
  const setActiveProject = useProjectsStore(state => state.setActiveProject)

  const accessibleProjectsQ = useQuery({
    queryKey: ['accessible-projects', user?.id],
    queryFn: () => projectsService.getAccessibleProjects(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })

  const accessibleProjects = accessibleProjectsQ.data?.projects ?? []
  const accessibleProjectIds = accessibleProjects.map(project => project.id)
  const resolvedActiveProjectId = activeProjectId && accessibleProjectIds.includes(activeProjectId)
    ? activeProjectId
    : accessibleProjects[0]?.id ?? null

  useEffect(() => {
    if (resolvedActiveProjectId === activeProjectId) {
      return
    }

    setActiveProject(resolvedActiveProjectId)
  }, [activeProjectId, resolvedActiveProjectId, setActiveProject])

  const activeProject = accessibleProjects.find(project => project.id === resolvedActiveProjectId) ?? null

  return {
    activeProjectId: resolvedActiveProjectId,
    activeProject,
    projects: accessibleProjects,
    projectMembers: accessibleProjectsQ.data?.projectMembers ?? [],
    isLoadingProjectContext: accessibleProjectsQ.isLoading,
    isErrorProjectContext: accessibleProjectsQ.isError,
  }
}
