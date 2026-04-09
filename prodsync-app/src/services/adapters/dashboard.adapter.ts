import type {
  DashboardKpis,
  DeptVelocityItem,
  BurnDataPoint,
  DepartmentSnapshot,
  CrewMember,
  OvertimeGroup,
  ApprovalRequest,
  ReportSummary,
} from '@/types'
import type { Trip, FuelLog } from '@/modules/transport/types'

export function mapDashboardKpis(
  otGroups: OvertimeGroup[],
  crew: CrewMember[],
  report?: ReportSummary,
): DashboardKpis {
  const totalOtCost = otGroups.reduce((sum, group) => sum + group.estimatedCostUSD, 0)
  const budget = report?.budget ?? 0
  const spend = report?.totalSpend ?? 0

  return {
    budgetActualUSD: spend,
    budgetTotalUSD: budget,
    budgetPercent: budget > 0 ? Math.round((spend / budget) * 100) : 0,
    todaySpendUSD: spend, // Since mocked report returns full snapshot
    todaySpendDelta: 0,
    cashFlowUSD: report?.cashFlow ?? 0,
    cashFlowReservePercent: 0,
    otCostTodayUSD: totalOtCost,
    otStatus: totalOtCost > 10_000 ? 'critical' : totalOtCost > 5_000 ? 'warning' : 'ok',
    activeCrew: report ? report.activeCrewCount : crew.filter(member => member.status !== 'offduty').length,
    crewCheckInPercent: crew.length > 0 ? 100 : 0,
    activeFleet: 0,
  }
}

export function buildDeptVelocity(
  trips: Trip[],
  _fuelLogs: FuelLog[],
  approvals: ApprovalRequest[],
): DeptVelocityItem[] {
  if (trips.length === 0 && approvals.length === 0) {
    return []
  }

  return [
    { dept: 'Trips', budget: trips.length, actual: trips.filter(trip => trip.status === 'completed').length },
    { dept: 'Approvals', budget: approvals.length, actual: approvals.filter(approval => approval.status === 'approved').length },
  ]
}

export function buildBurnData(): BurnDataPoint[] {
  return []
}

export function buildDeptSnapshots(
  trips: Trip[],
  crew: CrewMember[],
  otGroups: OvertimeGroup[],
): DepartmentSnapshot[] {
  const snapshots: DepartmentSnapshot[] = []

  if (trips.length > 0) {
    snapshots.push({
      id: 'transport',
      name: 'Transport',
      status: trips.some(trip => trip.status === 'flagged') ? 'warning' : 'active',
      metrics: [
        { label: 'Trips', value: String(trips.length) },
        { label: 'Active', value: String(trips.filter(trip => trip.status === 'active').length) },
      ],
    })
  }

  if (crew.length > 0) {
    snapshots.push({
      id: 'crew',
      name: 'Crew',
      status: otGroups.length > 0 ? 'warning' : 'active',
      metrics: [
        { label: 'Headcount', value: String(crew.length) },
        { label: 'OT Groups', value: String(otGroups.length) },
      ],
    })
  }

  return snapshots
}
