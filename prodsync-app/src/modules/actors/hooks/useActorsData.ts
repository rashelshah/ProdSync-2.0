import { useQuery } from '@tanstack/react-query'
import { actorsService } from '@/services/actors.service'

export function useActorsData(projectId: string | null, lookFilters: { actor?: string; character?: string }) {
  const juniorsQ = useQuery({
    queryKey: ['actors-juniors', projectId],
    queryFn: () => actorsService.getJuniorLogs(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const callSheetsQ = useQuery({
    queryKey: ['actors-call-sheets', projectId],
    queryFn: () => actorsService.getCallSheets(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const paymentsQ = useQuery({
    queryKey: ['actors-payments', projectId],
    queryFn: () => actorsService.getPayments(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const looksQ = useQuery({
    queryKey: ['actors-looks', projectId, lookFilters.actor ?? '', lookFilters.character ?? ''],
    queryFn: () => actorsService.getLooks(projectId!, lookFilters),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const alertsQ = useQuery({
    queryKey: ['actors-alerts', projectId],
    queryFn: () => actorsService.getAlerts(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  return {
    juniorLogs: juniorsQ.data ?? [],
    callSheets: callSheetsQ.data?.callSheets ?? [],
    callSheetGroups: callSheetsQ.data?.groupedByDate ?? [],
    payments: paymentsQ.data ?? [],
    looks: looksQ.data ?? [],
    alerts: alertsQ.data ?? [],
    isLoading: juniorsQ.isLoading || callSheetsQ.isLoading || paymentsQ.isLoading || looksQ.isLoading,
    isError: juniorsQ.isError || callSheetsQ.isError || paymentsQ.isError || looksQ.isError,
    refetch: () => Promise.all([
      juniorsQ.refetch(),
      callSheetsQ.refetch(),
      paymentsQ.refetch(),
      looksQ.refetch(),
      alertsQ.refetch(),
    ]),
  }
}
