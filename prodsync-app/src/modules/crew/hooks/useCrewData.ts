import { useQuery } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { crewService } from '@/services/crew.service'
import { mapCrewKpis, getHeadcountByDept } from '@/services/adapters/crew.adapter'

export function useCrewData() {
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const crewQ = useQuery({
    queryKey: ['crew', activeProjectId],
    queryFn: () => crewService.getCrew(activeProjectId!),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId),
  })
  const otQ = useQuery({
    queryKey: ['ot-groups', activeProjectId],
    queryFn: () => crewService.getOvertimeGroups(activeProjectId!),
    staleTime: 10_000,
    enabled: Boolean(activeProjectId),
  })
  const payoutsQ = useQuery({
    queryKey: ['wage-payouts', activeProjectId],
    queryFn: () => crewService.getWagePayouts(activeProjectId!),
    staleTime: 30_000,
    enabled: Boolean(activeProjectId),
  })

  const crew = crewQ.data ?? []
  const otGroups = otQ.data ?? []
  const payouts = payoutsQ.data ?? []

  const kpis = mapCrewKpis(crew, payouts, otGroups)
  const headcountByDept = getHeadcountByDept(crew)

  return {
    isLoading: isLoadingProjectContext || crewQ.isLoading || otQ.isLoading || payoutsQ.isLoading,
    isError: isErrorProjectContext || crewQ.isError || otQ.isError || payoutsQ.isError,
    kpis,
    crew: crew.slice(0, 10), // show first 10 for table
    otGroups,
    payouts,
    headcountByDept,
    battaQueue: payouts.filter(p => p.type === 'batta'),
    recentPayouts: payouts.slice(0, 3),
  }
}
