import type { AlertItem, AlertSeverity, AlertSource } from '@/types'
import type { FuelLog, CrewMember, OvertimeGroup, ApprovalRequest } from '@/types'

let _alertIdCounter = 1
const makeId = () => `alert-${_alertIdCounter++}`

// ─── Alert Factories ─────────────────────────────────────────────────────────

export function makeFuelAnomalyAlert(log: FuelLog): AlertItem | null {
  const diff = ((log.expectedMileage - log.actualMileage) / log.expectedMileage) * 100
  if (diff <= 15) return null
  return {
    id: makeId(),
    severity: diff > 30 ? 'critical' : 'warning',
    source: 'transport',
    title: 'Fuel Anomaly Detected',
    message: `${log.vehicleName}: Consumption #{Math.round(diff)}% above expected. Mileage ${log.actualMileage} vs expected ${log.expectedMileage} km/L`,
    timestamp: new Date(),
    acknowledged: false,
  }
}

export function makeOvertimeTriggerAlert(group: OvertimeGroup): AlertItem | null {
  if (group.authorized) return null
  return {
    id: makeId(),
    severity: 'critical',
    source: 'crew',
    title: 'Unapproved Overtime Running',
    message: `${group.name}: ${group.memberCount} crew members OT since ${group.startTime}. Accrual: $${group.estimatedCostUSD.toLocaleString()}`,
    timestamp: new Date(),
    acknowledged: false,
  }
}

export function makeOverstaffingAlert(actual: number, planned: number): AlertItem | null {
  if (actual <= planned) return null
  return {
    id: makeId(),
    severity: 'warning',
    source: 'crew',
    title: 'Overstaffing Detected',
    message: `${actual} crew present vs ${planned} planned. +${actual - planned} unplanned headcount.`,
    timestamp: new Date(),
    acknowledged: false,
  }
}

export function makeBudgetOverrunAlert(
  dept: string,
  actualPercent: number,
  source: AlertSource = 'expenses'
): AlertItem | null {
  if (actualPercent < 85) return null
  return {
    id: makeId(),
    severity: actualPercent >= 100 ? 'critical' : 'warning',
    source,
    title: `Budget ${actualPercent >= 100 ? 'Overrun' : 'Warning'}: ${dept}`,
    message: `${dept} department at ${actualPercent}% of budget allocation.`,
    timestamp: new Date(),
    acknowledged: false,
  }
}

export function makeEmergencyRequestAlert(request: ApprovalRequest): AlertItem | null {
  if (request.priority !== 'emergency') return null
  return {
    id: makeId(),
    severity: 'critical',
    source: 'approvals',
    title: 'Emergency Approval Required',
    message: `${request.type} from ${request.department}: ₹${request.amountINR.toLocaleString()} — ${request.notes ?? ''}`,
    timestamp: new Date(),
    acknowledged: false,
  }
}

// ─── Main Alert Engine ───────────────────────────────────────────────────────

export interface AlertEngineInput {
  fuelLogs?: FuelLog[]
  crew?: CrewMember[]
  otGroups?: OvertimeGroup[]
  pendingApprovals?: ApprovalRequest[]
  artBudgetPercent?: number
}

/**
 * Run all alert checks against incoming data and return new alerts.
 * This is pure — it does NOT write to the store directly.
 * The dispatcher calls this and feeds results to the store.
 */
export function runAlertEngine(input: AlertEngineInput): AlertItem[] {
  const alerts: AlertItem[] = []

  // Fuel anomaly checks
  input.fuelLogs?.forEach(log => {
    const alert = makeFuelAnomalyAlert(log)
    if (alert) alerts.push(alert)
  })

  // Overtime checks
  input.otGroups?.forEach(group => {
    const alert = makeOvertimeTriggerAlert(group)
    if (alert) alerts.push(alert)
  })

  // Overstaffing check
  if (input.crew) {
    const actual = input.crew.length
    const alert = makeOverstaffingAlert(actual, 150)
    if (alert) alerts.push(alert)
  }

  // Art budget overrun
  if (input.artBudgetPercent !== undefined) {
    const alert = makeBudgetOverrunAlert('Art Department', input.artBudgetPercent)
    if (alert) alerts.push(alert)
  }

  // Emergency approvals
  input.pendingApprovals?.forEach(req => {
    const alert = makeEmergencyRequestAlert(req)
    if (alert) alerts.push(alert)
  })

  return alerts
}

export function getSeverityWeight(s: AlertSeverity): number {
  return s === 'critical' ? 3 : s === 'warning' ? 2 : 1
}

export function sortAlertsBySeverity(alerts: AlertItem[]): AlertItem[] {
  return [...alerts].sort((a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity))
}
