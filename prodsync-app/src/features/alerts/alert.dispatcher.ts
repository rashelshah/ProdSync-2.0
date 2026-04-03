import { useEffect } from 'react'
import { useAlertStore } from './alert.store'
import { runAlertEngine, sortAlertsBySeverity } from './alert.engine'
import type { FuelLog, CrewMember, OvertimeGroup, ApprovalRequest } from '@/types'

interface DispatcherInput {
  fuelLogs?: FuelLog[]
  crew?: CrewMember[]
  otGroups?: OvertimeGroup[]
  pendingApprovals?: ApprovalRequest[]
  artBudgetPercent?: number
}

/**
 * React hook that acts as the alert dispatcher.
 * Call this at the app root whenever data changes.
 * Runs the alert engine and dispatches results to the Zustand store.
 */
export function useAlertDispatcher(input: DispatcherInput) {
  const addAlerts = useAlertStore(s => s.addAlerts)

  useEffect(() => {
    if (!input.fuelLogs && !input.crew && !input.otGroups) return

    const rawAlerts = runAlertEngine(input)
    const sorted = sortAlertsBySeverity(rawAlerts)
    if (sorted.length > 0) {
      addAlerts(sorted)
    }
  }, [
    // Stringify for stable dependency comparison
    JSON.stringify(input.fuelLogs?.map(f => f.id)),
    JSON.stringify(input.otGroups?.map(g => g.id)),
    input.crew?.length,
    input.artBudgetPercent,
    input.pendingApprovals?.length,
  ])
}
