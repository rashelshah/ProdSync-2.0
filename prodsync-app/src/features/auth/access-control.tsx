import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { EmptyState } from '@/components/system/SystemStates'
import { useProjectsStore } from '@/features/projects/projects.store'
import { canAccessRoute, type AppRouteId } from './access-rules'
import { useAuthStore } from './auth.store'

export function RouteAccessGuard({ routeId, children }: { routeId: AppRouteId; children: ReactNode }) {
  const user = useAuthStore(state => state.user)
  const activeProjectId = useProjectsStore(state => state.activeProjectId)
  const projectMembers = useProjectsStore(state => state.projectMembers)
  const projects = useProjectsStore(state => state.projects)

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!canAccessRoute(user, routeId)) {
    return (
      <div className="page-shell">
        <EmptyState
          icon="lock"
          title="Access restricted"
          description="This area is not available for your current role or department assignment. ProdSync is keeping the workspace scoped to approved access only."
        />
      </div>
    )
  }

  const requiresProjectContext = routeId !== 'projects'
  const hasActiveProjectAccess =
    !requiresProjectContext ||
    Boolean(
      activeProjectId &&
        (projectMembers.some(member => member.projectId === activeProjectId && member.userId === user.id) ||
          projects.some(project => project.id === activeProjectId && project.ownerId === user.id)),
    )

  if (!hasActiveProjectAccess) {
    return <Navigate to="/projects" replace />
  }

  return <>{children}</>
}
