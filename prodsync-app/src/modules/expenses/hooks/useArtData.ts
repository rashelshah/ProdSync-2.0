import { useQuery } from '@tanstack/react-query'
import { artService } from '@/services/art.service'

export function useArtData(projectId: string | null, options?: { includeBudget?: boolean }) {
  const includeBudget = options?.includeBudget ?? true

  const expensesQ = useQuery({
    queryKey: ['art-expenses', projectId],
    queryFn: () => artService.getExpenses(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const propsQ = useQuery({
    queryKey: ['art-props', projectId],
    queryFn: () => artService.getProps(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const setsQ = useQuery({
    queryKey: ['art-sets', projectId],
    queryFn: () => artService.getSets(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  const budgetQ = useQuery({
    queryKey: ['art-budget', projectId],
    queryFn: () => artService.getBudget(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId && includeBudget),
  })

  const alertsQ = useQuery({
    queryKey: ['art-alerts', projectId],
    queryFn: () => artService.getAlerts(projectId!),
    staleTime: 15_000,
    enabled: Boolean(projectId),
  })

  return {
    expenses: expensesQ.data ?? [],
    props: propsQ.data ?? [],
    sets: setsQ.data ?? [],
    budget: budgetQ.data ?? null,
    alerts: alertsQ.data ?? [],
    isLoading: expensesQ.isLoading || propsQ.isLoading || setsQ.isLoading || (includeBudget && budgetQ.isLoading) || alertsQ.isLoading,
    isError: expensesQ.isError || propsQ.isError || setsQ.isError || (includeBudget && budgetQ.isError) || alertsQ.isError,
  }
}
