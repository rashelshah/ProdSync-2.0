import { useQuery } from '@tanstack/react-query'
import { cameraService } from '@/services/camera.service'

export function useCameraData(projectId: string | null) {
  const wishlistQ = useQuery({
    queryKey: ['camera-wishlist', projectId],
    queryFn: () => cameraService.getWishlist(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const requestsQ = useQuery({
    queryKey: ['camera-requests', projectId],
    queryFn: () => cameraService.getRequests(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const logsQ = useQuery({
    queryKey: ['camera-logs', projectId],
    queryFn: () => cameraService.getLogs(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const damageReportsQ = useQuery({
    queryKey: ['camera-damage', projectId],
    queryFn: () => cameraService.getDamageReports(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const alertsQ = useQuery({
    queryKey: ['camera-alerts', projectId],
    queryFn: () => cameraService.getAlerts(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  return {
    wishlist: wishlistQ.data ?? [],
    requests: requestsQ.data ?? [],
    logs: logsQ.data ?? [],
    damageReports: damageReportsQ.data ?? [],
    alerts: alertsQ.data ?? [],
    isLoading: wishlistQ.isLoading || requestsQ.isLoading || logsQ.isLoading || damageReportsQ.isLoading || alertsQ.isLoading,
    isError: wishlistQ.isError || requestsQ.isError || logsQ.isError || damageReportsQ.isError || alertsQ.isError,
  }
}
