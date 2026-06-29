import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateProjectData } from '@/context/project-sync'
import { useAuthStore } from '@/features/auth/auth.store'
import { canManageProjectWorkflowClient, formatProjectPhase, PROJECT_PHASE_OPTIONS } from '@/features/workflow/projectWorkflow'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { projectsService } from '@/services/projects.service'
import { cn, formatDate } from '@/utils'
import type { ProjectPhase, ProjectRecord } from '@/types'

interface ProjectPhaseControlProps {
  project: ProjectRecord
  showHistory?: boolean
  compact?: boolean
}

export function ProjectPhaseControl({ project, showHistory = false, compact = false }: ProjectPhaseControlProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const canManagePhase = canManageProjectWorkflowClient(user) || project.ownerId === user?.id

  const historyQ = useQuery({
    queryKey: ['project-phase-history', project.id],
    queryFn: () => projectsService.getProjectPhaseHistory(project.id),
    enabled: showHistory,
    staleTime: 30_000,
  })

  const updatePhaseMutation = useMutation({
    mutationFn: (projectPhase: ProjectPhase) => projectsService.updateProjectPhase(project.id, projectPhase),
    onSuccess: async updatedProject => {
      await invalidateProjectData(queryClient, {
        projectId: project.id,
        userId: user?.id,
      })
      showSuccess(`Project phase updated to ${formatProjectPhase(updatedProject?.projectPhase ?? project.projectPhase)}.`, { id: `project-phase-${project.id}` })
    },
    onError: error => {
      showError(resolveErrorMessage(error, 'Project phase could not be updated.'), { id: `project-phase-${project.id}` })
    },
  })

  function handlePhaseChange(nextPhase: ProjectPhase) {
    if (nextPhase === project.projectPhase || !canManagePhase) return
    showLoading('Updating project phase...', { id: `project-phase-${project.id}` })
    updatePhaseMutation.mutate(nextPhase)
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className={cn('rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900', compact && 'p-3')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Project Phase</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{formatProjectPhase(project.projectPhase)}</p>
          </div>
          <select
            value={project.projectPhase}
            onChange={event => handlePhaseChange(event.target.value as ProjectPhase)}
            disabled={!canManagePhase || updatePhaseMutation.isPending}
            className="auth-input min-w-[190px] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Project phase"
          >
            {PROJECT_PHASE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {!canManagePhase && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Phase changes are limited to production leadership for this project.</p>
        )}
      </div>

      {showHistory && (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Phase History</p>
          <div className="mt-4 space-y-3">
            {(historyQ.data ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No phase changes recorded yet.</p>
            ) : (
              historyQ.data?.map(item => (
                <div key={item.id} className="rounded-[18px] bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {item.previousPhase ? `${formatProjectPhase(item.previousPhase)} to ` : ''}{formatProjectPhase(item.newPhase)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.changedByName} on {formatDate(item.changedAt)}
                  </p>
                  {item.notes && <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{item.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
