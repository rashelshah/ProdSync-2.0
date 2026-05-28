import { useQuery } from '@tanstack/react-query'
import { accommodationService } from '@/services/accommodation.service'

export function useAccommodationData(projectId: string | null) {
  const hotelsQ = useQuery({
    queryKey: ['accommodation-hotels', projectId],
    queryFn: () => accommodationService.getHotels(projectId),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const allocationsQ = useQuery({
    queryKey: ['accommodation-allocations', projectId],
    queryFn: () => accommodationService.getAllocations(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const remindersQ = useQuery({
    queryKey: ['accommodation-reminders', projectId],
    queryFn: () => accommodationService.getReminders(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const travelQ = useQuery({
    queryKey: ['accommodation-travel-sync', projectId],
    queryFn: () => accommodationService.getTravelSync(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const alertsQ = useQuery({
    queryKey: ['accommodation-alerts', projectId],
    queryFn: () => accommodationService.getAlerts(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  return {
    hotels: hotelsQ.data ?? [],
    allocations: allocationsQ.data ?? [],
    reminders: remindersQ.data ?? [],
    travelSync: travelQ.data ?? [],
    alerts: alertsQ.data ?? [],
    isLoading: hotelsQ.isLoading || allocationsQ.isLoading || remindersQ.isLoading || travelQ.isLoading || alertsQ.isLoading,
    isError: hotelsQ.isError || allocationsQ.isError || remindersQ.isError || travelQ.isError || alertsQ.isError,
    refetch: () => Promise.all([hotelsQ.refetch(), allocationsQ.refetch(), remindersQ.refetch(), travelQ.refetch(), alertsQ.refetch()]),
  }
}
