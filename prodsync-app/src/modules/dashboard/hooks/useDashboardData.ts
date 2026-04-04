import { useQuery } from '@tanstack/react-query'
import { transportService } from '@/services/transport.service'
import { crewService } from '@/services/crew.service'
import { approvalsService } from '@/services/approvals.service'
import { mapDashboardKpis, buildDeptVelocity, buildBurnData, buildDeptSnapshots } from '@/services/adapters/dashboard.adapter'
import { mapTransportKpis, transformFuelLog } from '@/services/adapters/transport.adapter'
import { mapCrewKpis } from '@/services/adapters/crew.adapter'
import { useAlertDispatcher } from '@/features/alerts/alert.dispatcher'

export function useDashboardData() {
  const tripsQ = useQuery({ queryKey: ['trips'], queryFn: transportService.getTrips, staleTime: 30_000 })
  const fuelQ = useQuery({ queryKey: ['fuel-logs'], queryFn: transportService.getFuelLogs, staleTime: 30_000 })
  const crewQ = useQuery({ queryKey: ['crew'], queryFn: crewService.getCrew, staleTime: 30_000 })
  const otQ = useQuery({ queryKey: ['ot-groups'], queryFn: crewService.getOvertimeGroups, staleTime: 15_000 })
  const approvalsQ = useQuery({ queryKey: ['pending-approvals'], queryFn: approvalsService.getPendingApprovals, staleTime: 20_000 })

  const trips = tripsQ.data ?? []
  const fuelLogs = fuelQ.data ?? []
  const crew = crewQ.data ?? []
  const otGroups = otQ.data ?? []
  const pendingApprovals = approvalsQ.data ?? []

  useAlertDispatcher({
    fuelLogs,
    crew,
    otGroups,
    pendingApprovals,
    artBudgetPercent: 0,
  })

  const kpis = mapDashboardKpis(otGroups, crew)
  const transportKpis = mapTransportKpis(trips, fuelLogs)
  const crewKpis = mapCrewKpis(crew, [], otGroups)
  const fuelLogsUI = fuelLogs.map(transformFuelLog)
  const deptVelocity = buildDeptVelocity(trips, fuelLogs, pendingApprovals)
  const burnData = buildBurnData()
  const deptSnapshots = buildDeptSnapshots(trips, crew, otGroups)

  return {
    isLoading: tripsQ.isLoading || crewQ.isLoading || fuelQ.isLoading,
    isError: tripsQ.isError || crewQ.isError,
    kpis,
    transportKpis,
    crewKpis,
    fuelLogsUI,
    deptVelocity,
    burnData,
    deptSnapshots,
    pendingApprovals: pendingApprovals.slice(0, 3),
    trips: trips.slice(0, 5),
  }
}
