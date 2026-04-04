import { useQuery } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { activityService } from '@/services/activity.service'

export function useProjectActivity() {
  const { activeProjectId } = useResolvedProjectContext()

  const activityQuery = useQuery({
    queryKey: ['activity', activeProjectId],
    queryFn: () => activityService.getActivity(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 15_000,
  })

  return {
    activeProjectId,
    events: activityQuery.data ?? [],
    isLoading: activityQuery.isLoading,
    isError: activityQuery.isError,
  }
}
