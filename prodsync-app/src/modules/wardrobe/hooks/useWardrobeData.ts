import { useQuery } from '@tanstack/react-query'
import { wardrobeService } from '@/services/wardrobe.service'

export function useWardrobeData(projectId: string | null, filters: { scene?: string; character?: string }) {
  const continuityQ = useQuery({
    queryKey: ['wardrobe-continuity', projectId, filters.scene ?? '', filters.character ?? ''],
    queryFn: () => wardrobeService.getContinuity(projectId!, filters),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const inventoryQ = useQuery({
    queryKey: ['wardrobe-inventory', projectId],
    queryFn: () => wardrobeService.getInventory(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const laundryQ = useQuery({
    queryKey: ['wardrobe-laundry', projectId],
    queryFn: () => wardrobeService.getLaundry(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const accessoriesQ = useQuery({
    queryKey: ['wardrobe-accessories', projectId],
    queryFn: () => wardrobeService.getAccessories(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const alertsQ = useQuery({
    queryKey: ['wardrobe-alerts', projectId],
    queryFn: () => wardrobeService.getAlerts(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  return {
    continuityLogs: continuityQ.data ?? [],
    inventory: inventoryQ.data ?? [],
    laundry: laundryQ.data ?? [],
    accessories: accessoriesQ.data ?? [],
    alerts: alertsQ.data ?? [],
    isLoading: continuityQ.isLoading || inventoryQ.isLoading || laundryQ.isLoading,
    isError: continuityQ.isError || inventoryQ.isError || laundryQ.isError,
    accessoriesError: accessoriesQ.isError,
    alertsError: alertsQ.isError,
    refetch: () => Promise.all([
      continuityQ.refetch(),
      inventoryQ.refetch(),
      laundryQ.refetch(),
      accessoriesQ.refetch(),
      alertsQ.refetch(),
    ]),
  }
}
