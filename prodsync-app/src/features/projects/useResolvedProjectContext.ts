import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { projectsService } from '@/services/projects.service'

export function useResolvedProjectContext() {
  const user = useAuthStore(state => state.user)
  const activeProjectId = useProjectsStore(state => state.activeProjectId)
  const activeProjectCurrency = useProjectsStore(state => state.activeProjectCurrency)
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
    const resolvedProject = accessibleProjects.find(project => project.id === resolvedActiveProjectId) ?? null

    if (resolvedActiveProjectId === activeProjectId && (!resolvedProject || activeProjectCurrency === resolvedProject.currency)) {
      return
    }

    setActiveProject(resolvedActiveProjectId, resolvedProject?.currency ?? 'INR')
  }, [accessibleProjects, activeProjectCurrency, activeProjectId, resolvedActiveProjectId, setActiveProject])

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
