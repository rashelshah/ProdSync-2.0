import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { alertsService } from '@/services/alerts.service'

export function useProjectAlerts() {
  const queryClient = useQueryClient()
  const { activeProjectId } = useResolvedProjectContext()

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

  const alerts = alertsQuery.data ?? []

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
