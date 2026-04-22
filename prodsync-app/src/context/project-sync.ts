import type { QueryClient } from '@tanstack/react-query'

export async function invalidateProjectData(
  queryClient: QueryClient,
  options?: {
    projectId?: string | null
    userId?: string | null
  },
) {
  const tasks: Array<Promise<unknown>> = []
  const { projectId, userId } = options ?? {}

  if (projectId) {
    const projectScopedKeys: Array<readonly unknown[]> = [
      ['project', projectId],
      ['project-progress', projectId],
      ['budget-allocations', projectId],
      ['report-summary', projectId],
      ['reports-summary', projectId],
      ['reports-burn-chart', projectId],
      ['reports-departments', projectId],
      ['reports-alerts', projectId],
      ['alerts', projectId],
      ['activity', projectId],
      ['pending-approvals', projectId],
      ['approval-history', projectId],
      ['approvals-kpis', projectId],
      ['crew-dashboard', projectId],
      ['crew-attendance-history', projectId],
      ['crew-location', projectId],
      ['crew', projectId],
      ['ot-groups', projectId],
      ['trips', projectId],
      ['fuel-logs', projectId],
      ['vehicles', projectId],
      ['gps-logs', projectId],
      ['tracking-live', projectId],
      ['transport-alerts', projectId],
      ['transport-drivers', projectId],
      ['art-expenses', projectId],
      ['art-props', projectId],
      ['art-sets', projectId],
      ['art-budget', projectId],
      ['art-alerts', projectId],
      ['actors-juniors', projectId],
      ['actors-call-sheets', projectId],
      ['actors-payments', projectId],
      ['actors-looks', projectId],
      ['actors-alerts', projectId],
    ]

    for (const queryKey of projectScopedKeys) {
      tasks.push(queryClient.invalidateQueries({ queryKey }))
    }
  }

  if (userId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['accessible-projects', userId] }))
  }

  tasks.push(
    queryClient.invalidateQueries({ queryKey: ['discoverable-projects'] }),
    queryClient.invalidateQueries({ queryKey: ['project-join-requests'] }),
  )

  await Promise.all(tasks)
}
