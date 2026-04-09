import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectMember, ProjectProgressSnapshot, ProjectRecord } from '@/types'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { projectsService } from '@/services/projects.service'
import { getTransportSocket } from '@/modules/transport/realtime'
import { invalidateProjectData } from './project-sync'

interface ProjectContextValue {
  activeProjectId: string | null
  activeProject: ProjectRecord | null
  project: ProjectRecord | null
  projectProgress: ProjectProgressSnapshot | null
  projects: ProjectRecord[]
  projectMembers: ProjectMember[]
  isLoadingProjectContext: boolean
  isErrorProjectContext: boolean
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
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

  const activeProjectFallback = accessibleProjects.find(project => project.id === resolvedActiveProjectId) ?? null

  const projectQ = useQuery({
    queryKey: ['project', resolvedActiveProjectId],
    queryFn: () => projectsService.getProject(resolvedActiveProjectId!),
    enabled: Boolean(resolvedActiveProjectId),
    staleTime: 30_000,
    placeholderData: activeProjectFallback ?? undefined,
  })
  const liveProject = projectQ.data ?? activeProjectFallback
  const projectProgress = liveProject
    ? {
        progress: liveProject.progressPercent,
        spent: liveProject.spentAmount,
        budget: liveProject.budgetUSD,
        isOverBudget: liveProject.isOverBudget,
        overBudgetAmount: liveProject.isOverBudget
          ? Math.max(0, Number((liveProject.spentAmount - liveProject.budgetUSD).toFixed(2)))
          : 0,
      } satisfies ProjectProgressSnapshot
    : null
  const projects = accessibleProjects.map(project =>
    project.id === liveProject?.id ? liveProject : project,
  )

  useEffect(() => {
    if (!resolvedActiveProjectId) {
      if (activeProjectId !== null || activeProjectCurrency !== 'INR') {
        setActiveProject(null, 'INR')
      }
      return
    }

    const nextCurrency = liveProject?.currency ?? activeProjectFallback?.currency ?? 'INR'
    if (resolvedActiveProjectId === activeProjectId && nextCurrency === activeProjectCurrency) {
      return
    }

    setActiveProject(resolvedActiveProjectId, nextCurrency)
  }, [
    activeProjectCurrency,
    activeProjectFallback?.currency,
    activeProjectId,
    liveProject?.currency,
    resolvedActiveProjectId,
    setActiveProject,
  ])

  useEffect(() => {
    if (!resolvedActiveProjectId || !user?.id) {
      return
    }

    let cancelled = false
    let subscribedSocket: Awaited<ReturnType<typeof getTransportSocket>> = null

    const handleProjectUpdated = (payload: { projectId?: string } | undefined) => {
      if (!payload?.projectId || payload.projectId !== resolvedActiveProjectId) {
        return
      }

      void invalidateProjectData(queryClient, {
        projectId: resolvedActiveProjectId,
        userId: user.id,
      })
    }

    void getTransportSocket().then(socket => {
      if (cancelled || !socket) {
        return
      }

      subscribedSocket = socket
      socket.emit('project:subscribe', resolvedActiveProjectId)
      socket.on('project_updated', handleProjectUpdated)
    })

    return () => {
      cancelled = true
      subscribedSocket?.off('project_updated', handleProjectUpdated)
      subscribedSocket?.emit('project:unsubscribe', resolvedActiveProjectId)
    }
  }, [queryClient, resolvedActiveProjectId, user?.id])

  return (
    <ProjectContext.Provider
      value={{
        activeProjectId: resolvedActiveProjectId,
        activeProject: liveProject,
        project: liveProject,
        projectProgress,
        projects,
        projectMembers: accessibleProjectsQ.data?.projectMembers ?? [],
        isLoadingProjectContext: accessibleProjectsQ.isLoading || (Boolean(resolvedActiveProjectId) && projectQ.isLoading),
        isErrorProjectContext: accessibleProjectsQ.isError || (Boolean(resolvedActiveProjectId) && projectQ.isError),
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider.')
  }

  return context
}
