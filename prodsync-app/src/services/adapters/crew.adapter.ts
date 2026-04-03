import type { CrewMember, OvertimeGroup, WagePayout, CrewKpis } from '@/types'

/**
 * Calculate OT cost from hours, rate, and crew count
 */
export function calculateOTCost(elapsedMinutes: number, hourlyRate: number, crewCount: number): number {
  return (elapsedMinutes / 60) * hourlyRate * crewCount * 1.5 // 1.5x OT multiplier
}

/**
 * Determine if crew member is in OT territory
 */
export function isOvertimeTrigger(shiftHours: number, shiftCap = 10): boolean {
  return shiftHours > shiftCap
}

/**
 * Map raw crew attendance to CrewKpis
 */
export function mapCrewKpis(
  crew: CrewMember[],
  payouts: WagePayout[],
  otGroups: OvertimeGroup[]
): CrewKpis {
  const totalCrew = crew.length
  const plannedHeadcount = 150
  const activeOtCrew = otGroups.reduce((sum, g) => sum + g.memberCount, 0)
  const totalOtCostUSD = otGroups.reduce((sum, g) => sum + g.estimatedCostUSD, 0)

  const battaPending = payouts.filter(p => p.type === 'batta' && p.status === 'requested')
  const battaPaid = payouts.filter(p => p.type === 'batta' && p.status === 'paid')

  return {
    totalCrew,
    plannedHeadcount,
    activeOtCrew,
    totalOtCostUSD,
    battaRequested: battaPending.reduce((sum, p) => sum + p.amount, 0),
    battaPaid: battaPaid.reduce((sum, p) => sum + p.amount, 0),
    overstaffingCount: Math.max(0, totalCrew - plannedHeadcount),
  }
}

/**
 * Get headcount distribution by department
 */
export function getHeadcountByDept(crew: CrewMember[]) {
  const map: Record<string, { actual: number; planned: number }> = {
    Camera: { actual: 0, planned: 40 },
    'Art Dept': { actual: 0, planned: 45 },
    'General Crew': { actual: 0, planned: 45 },
    Transport: { actual: 0, planned: 20 },
  }
  crew.forEach(c => {
    if (map[c.department]) map[c.department].actual++
  })
  return Object.entries(map).map(([dept, { actual, planned }]) => ({
    dept,
    actual,
    planned,
    overPercent: Math.max(0, ((actual - planned) / planned) * 100),
    plannedPercent: Math.min(100, (Math.min(actual, planned) / planned) * 100),
  }))
}
