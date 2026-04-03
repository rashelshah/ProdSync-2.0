import { useQuery } from '@tanstack/react-query'
import { crewService } from '@/services/crew.service'
import { mapCrewKpis, getHeadcountByDept } from '@/services/adapters/crew.adapter'
import { useAlertDispatcher } from '@/features/alerts/alert.dispatcher'

export function useCrewData() {
  const crewQ = useQuery({ queryKey: ['crew'], queryFn: crewService.getCrew, staleTime: 15_000 })
  const otQ = useQuery({ queryKey: ['ot-groups'], queryFn: crewService.getOvertimeGroups, staleTime: 10_000 })
  const payoutsQ = useQuery({ queryKey: ['wage-payouts'], queryFn: crewService.getWagePayouts, staleTime: 30_000 })

  const crew = crewQ.data ?? []
  const otGroups = otQ.data ?? []
  const payouts = payoutsQ.data ?? []

  useAlertDispatcher({ crew, otGroups })

  const kpis = mapCrewKpis(crew, payouts, otGroups)
  const headcountByDept = getHeadcountByDept(crew)

  return {
    isLoading: crewQ.isLoading,
    isError: crewQ.isError,
    kpis,
    crew: crew.slice(0, 10), // show first 10 for table
    otGroups,
    payouts,
    headcountByDept,
    battaQueue: payouts.filter(p => p.type === 'batta'),
    recentPayouts: payouts.slice(0, 3),
  }
}
