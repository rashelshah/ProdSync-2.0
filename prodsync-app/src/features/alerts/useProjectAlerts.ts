import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useProjectWorkflow } from '@/features/workflow/projectWorkflow'
import { alertsService } from '@/services/alerts.service'

export function useProjectAlerts() {
  const queryClient = useQueryClient()
  const { activeProjectId } = useResolvedProjectContext()
  const { phase } = useProjectWorkflow()

  const alertsQuery = useQuery({
    queryKey: ['alerts', activeProjectId],
    queryFn: () => alertsService.getAlerts(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 15_000,
  })

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId: string) => alertsService.acknowledgeAlert(activeProjectId!, alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', activeProjectId] })
    },
  })

  const acknowledgeAllMutation = useMutation({
    mutationFn: () => alertsService.acknowledgeAll(activeProjectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', activeProjectId] })
    },
  })

  const phaseSources = {
    planning: new Set(['approvals', 'system']),
    pre_production: new Set(['locations', 'transport', 'food_beverages', 'crew', 'camera', 'expenses', 'approvals', 'system']),
    production: new Set(['transport', 'food_beverages', 'crew', 'camera', 'expenses', 'locations', 'approvals', 'system']),
    post_production: new Set(['approvals', 'expenses', 'food_beverages', 'system']),
    completed: new Set(['system', 'approvals']),
  }[phase]
  const alerts = (alertsQuery.data ?? []).filter(alert => phaseSources.has(alert.source))

  return {
    activeProjectId,
    alerts,
    unreadCount: alerts.filter(alert => !alert.acknowledged).length,
    isLoading: alertsQuery.isLoading,
    isError: alertsQuery.isError,
    acknowledgeAlert: (alertId: string) => acknowledgeAlertMutation.mutate(alertId),
    acknowledgeAll: () => acknowledgeAllMutation.mutate(),
    isAcknowledgingAll: acknowledgeAllMutation.isPending,
  }
}
