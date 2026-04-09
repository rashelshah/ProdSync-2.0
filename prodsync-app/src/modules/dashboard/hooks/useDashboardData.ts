import { useQuery } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { transportService } from '@/services/transport.service'
import { crewService } from '@/services/crew.service'
import { approvalsService } from '@/services/approvals.service'
import { alertsService } from '@/services/alerts.service'
import { activityService } from '@/services/activity.service'
import { mapDashboardKpis, buildDeptVelocity, buildBurnData, buildDeptSnapshots } from '@/services/adapters/dashboard.adapter'
import { mapTransportKpis, transformFuelLog } from '@/services/adapters/transport.adapter'
import { mapCrewKpis } from '@/services/adapters/crew.adapter'

export function useDashboardData() {
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()

  const tripsQ = useQuery({
    queryKey: ['trips', activeProjectId],
    queryFn: () => transportService.getTrips(activeProjectId!),
    staleTime: 30_000,
    enabled: Boolean(activeProjectId),
  })
  const fuelQ = useQuery({
    queryKey: ['fuel-logs', activeProjectId],
    queryFn: () => transportService.getFuelLogs(activeProjectId!),
    staleTime: 30_000,
    enabled: Boolean(activeProjectId),
  })
  const crewQ = useQuery({
    queryKey: ['crew', activeProjectId],
    queryFn: () => crewService.getCrew(activeProjectId!),
    staleTime: 30_000,
    enabled: Boolean(activeProjectId),
  })
  const otQ = useQuery({
    queryKey: ['ot-groups', activeProjectId],
    queryFn: () => crewService.getOvertimeGroups(activeProjectId!),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId),
  })
  const approvalsQ = useQuery({
    queryKey: ['pending-approvals', activeProjectId],
    queryFn: () => approvalsService.getPendingApprovals(activeProjectId!),
    staleTime: 20_000,
    enabled: Boolean(activeProjectId),
  })
  const alertsQ = useQuery({
    queryKey: ['alerts', activeProjectId],
    queryFn: () => alertsService.getAlerts(activeProjectId!),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId),
  })
  const activityQ = useQuery({
    queryKey: ['activity', activeProjectId],
    queryFn: () => activityService.getActivity(activeProjectId!),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId),
  })
  const reportQ = useQuery({
    queryKey: ['report-summary', activeProjectId],
    queryFn: () => import('@/services/reports.service').then(m => m.reportsService.getSummary(activeProjectId!)),
    staleTime: 60_000,
    enabled: Boolean(activeProjectId),
  })

  const trips = tripsQ.data ?? []
  const fuelLogs = fuelQ.data ?? []
  const crew = crewQ.data ?? []
  const otGroups = otQ.data ?? []
  const pendingApprovals = approvalsQ.data ?? []
  const alerts = alertsQ.data ?? []
  const events = activityQ.data ?? []
  const report = reportQ.data

  const kpis = mapDashboardKpis(otGroups, crew, report)
  const transportKpis = mapTransportKpis(trips, fuelLogs)
  const crewKpis = mapCrewKpis(crew, [], otGroups)
  const fuelLogsUI = fuelLogs.map(transformFuelLog)
  const deptVelocity = buildDeptVelocity(trips, fuelLogs, pendingApprovals)
  const burnData = buildBurnData()
  const deptSnapshots = buildDeptSnapshots(trips, crew, otGroups)

  return {
    isLoading: isLoadingProjectContext || tripsQ.isLoading || crewQ.isLoading || fuelQ.isLoading || approvalsQ.isLoading || alertsQ.isLoading || activityQ.isLoading || reportQ.isLoading,
    isError: isErrorProjectContext || tripsQ.isError || crewQ.isError || fuelQ.isError || approvalsQ.isError || alertsQ.isError || activityQ.isError || reportQ.isError,
    kpis,
    transportKpis,
    crewKpis,
    fuelLogsUI,
    deptVelocity,
    burnData,
    deptSnapshots,
    pendingApprovals: pendingApprovals.slice(0, 3),
    alerts: alerts.slice(0, 4),
    events: events.slice(0, 5),
    trips: trips.slice(0, 5),
  }
}
