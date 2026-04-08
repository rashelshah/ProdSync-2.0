import { useQuery } from '@tanstack/react-query'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { reportsService } from '@/services/reports.service'

export function useReportsData() {
  const { activeProjectId, activeProject, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()

  const summaryQ = useQuery({
    queryKey: ['reports-summary', activeProjectId],
    queryFn: () => reportsService.getSummary(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 60_000,
  })

  const burnChartQ = useQuery({
    queryKey: ['reports-burn-chart', activeProjectId],
    queryFn: () => reportsService.getBurnChart(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 60_000,
  })

  const departmentsQ = useQuery({
    queryKey: ['reports-departments', activeProjectId],
    queryFn: () => reportsService.getDepartments(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 60_000,
  })

  const alertsQ = useQuery({
    queryKey: ['reports-alerts', activeProjectId],
    queryFn: () => reportsService.getAlerts(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 30_000,
  })

  return {
    activeProjectId,
    activeProject,
    summary: summaryQ.data,
    burnChart: burnChartQ.data ?? [],
    departments: departmentsQ.data ?? [],
    alerts: alertsQ.data ?? [],
    isLoading: isLoadingProjectContext || summaryQ.isLoading || burnChartQ.isLoading || departmentsQ.isLoading || alertsQ.isLoading,
    isError: isErrorProjectContext || summaryQ.isError || burnChartQ.isError || departmentsQ.isError || alertsQ.isError,
  }
}
