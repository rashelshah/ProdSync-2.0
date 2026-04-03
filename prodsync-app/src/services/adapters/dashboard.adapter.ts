import type {
  DashboardKpis,
  DeptVelocityItem,
  BurnDataPoint,
  DepartmentSnapshot,
  Trip,
  FuelLog,
  CrewMember,
  OvertimeGroup,
  ApprovalRequest,
} from '@/types'

/**
 * Aggregate data from all modules into dashboard KPIs
 */
export function mapDashboardKpis(
  otGroups: OvertimeGroup[],
  crew: CrewMember[],
): DashboardKpis {
  const budgetActualUSD = 2_400_000
  const budgetTotalUSD = 3_700_000
  const budgetPercent = Math.round((budgetActualUSD / budgetTotalUSD) * 100)
  const totalOtCost = otGroups.reduce((sum, g) => sum + g.estimatedCostUSD, 0)

  return {
    budgetActualUSD,
    budgetTotalUSD,
    budgetPercent,
    todaySpendUSD: 42_500,
    todaySpendDelta: 4.2,
    cashFlowUSD: 840_000,
    cashFlowReservePercent: 22,
    otCostTodayUSD: totalOtCost,
    otStatus: totalOtCost > 10_000 ? 'critical' : totalOtCost > 5_000 ? 'warning' : 'ok',
    activeCrew: crew.filter(c => c.status !== 'offduty').length,
    crewCheckInPercent: 98,
    activeFleet: 28,
  }
}

/**
 * Build department velocity data for chart
 */
export function buildDeptVelocity(
  trips: Trip[],
  _fuelLogs: FuelLog[],
  approvals: ApprovalRequest[]
): DeptVelocityItem[] {
  const artApprovals = approvals.filter(a => a.department === 'Art Dept')
  return [
    { dept: 'Trans', budget: 100, actual: trips.length > 0 ? 85 : 70 },
    { dept: 'Art', budget: 100, actual: artApprovals.length > 0 ? 92 : 78 },
    { dept: 'Cam', budget: 70, actual: 75 },
    { dept: 'Crew', budget: 100, actual: 100 },
    { dept: 'Loc', budget: 40, actual: 35 },
  ]
}

/**
 * Build production burn timeline
 */
export function buildBurnData(): BurnDataPoint[] {
  return [
    { week: 'Wk 1', actual: 280, planned: 320 },
    { week: 'Wk 2', actual: 310, planned: 310 },
    { week: 'Wk 3', actual: 420, planned: 400 },
    { week: 'Wk 4', actual: 380, planned: 380 },
    { week: 'Wk 5', actual: 520, planned: 480 },
    { week: 'Wk 6', actual: 460, planned: 450 },
    { week: 'Wk 7', actual: 610, planned: 580 },
  ]
}

/**
 * Build department snapshots for dashboard cards
 */
export function buildDeptSnapshots(
  trips: Trip[],
  crew: CrewMember[],
  otGroups: OvertimeGroup[]
): DepartmentSnapshot[] {
  const totalOtHours = otGroups.reduce((sum, g) => sum + 1.5, 0) // simplified
  return [
    {
      id: 'transport',
      name: 'Transport',
      status: 'active',
      metrics: [
        { label: 'Efficiency', value: '92%' },
        { label: 'Pending Fuel', value: '$1,240' },
      ],
    },
    {
      id: 'camera',
      name: 'Camera',
      status: 'stable',
      metrics: [
        { label: 'Rental Days', value: '41/68' },
        { label: 'Data Used', value: '18.4 TB' },
      ],
    },
    {
      id: 'crew',
      name: 'Crew',
      status: crew.length > 150 ? 'warning' : 'active',
      metrics: [
        { label: 'Headcount', value: String(crew.length) },
        { label: 'OT Forecast', value: `${totalOtHours.toFixed(1)} hrs` },
      ],
    },
    {
      id: 'art',
      name: 'Art',
      status: 'over',
      metrics: [
        { label: 'Budget Used', value: '88%' },
        { label: 'Active Builds', value: '4' },
      ],
    },
    {
      id: 'wardrobe',
      name: 'Wardrobe',
      status: 'stable',
      metrics: [
        { label: 'Cast Ready', value: '12/12' },
        { label: 'Expedited', value: '2' },
      ],
    },
    {
      id: 'fleet',
      name: 'Fleet GPS',
      status: 'active',
      metrics: [
        { label: 'Moving', value: String(trips.filter(t => t.status === 'active').length) },
        { label: 'Idling', value: '20' },
      ],
    },
  ]
}
