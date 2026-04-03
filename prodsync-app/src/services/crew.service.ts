import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const MOCK_CREW: CrewMember[] = [
  { id: 'c1', name: 'Sarah J.', role: '1st AC', department: 'Camera', checkInTime: '06:45', verification: 'gps', status: 'active', shiftHours: 9 },
  { id: 'c2', name: 'Michael R.', role: 'Gaffer', department: 'Camera', checkInTime: '06:12', verification: 'gps', status: 'active', shiftHours: 10 },
  { id: 'c3', name: 'James K.', role: 'Key Grip', department: 'General Crew', checkInTime: '06:50', verification: 'manual', status: 'active', shiftHours: 8 },
  { id: 'c4', name: 'Elena M.', role: 'Set Dresser', department: 'Art Dept', checkInTime: '07:15', verification: 'gps', status: 'active', shiftHours: 7 },
  { id: 'c5', name: 'Robert M.', role: 'Driver', department: 'Transport', checkInTime: '05:45', verification: 'gps', status: 'ot', shiftHours: 11.5 },
  { id: 'c6', name: 'Linda V.', role: 'Driver', department: 'Transport', checkInTime: '06:30', verification: 'gps', status: 'active', shiftHours: 6.2 },
  { id: 'c7', name: 'Karthik R.', role: 'Driver', department: 'Transport', checkInTime: '07:00', verification: 'gps', status: 'active', shiftHours: 8 },
  { id: 'c8', name: 'David W.', role: 'Driver', department: 'Transport', checkInTime: '04:00', verification: 'biometric', status: 'offduty', shiftHours: 8 },
  // Add more to reach 184 for realism
  ...Array.from({ length: 176 }, (_, i) => ({
    id: `c${i + 9}`,
    name: `Crew Member ${i + 9}`,
    role: ['PA', 'Grip', 'Spark', 'Runner', 'Set PA'][i % 5],
    department: ['Camera', 'Art Dept', 'General Crew', 'Transport'][i % 4],
    checkInTime: `0${6 + (i % 3)}:${String(i % 60).padStart(2, '0')}`,
    verification: (['gps', 'manual', 'biometric'][i % 3]) as 'gps' | 'manual' | 'biometric',
    status: (['active', 'active', 'active', 'ot', 'offduty'][i % 5]) as any,
    shiftHours: 6 + (i % 6),
  })),
]

const MOCK_OT_GROUPS: OvertimeGroup[] = [
  { id: 'ot1', name: 'Lighting Unit', memberCount: 32, startTime: '06:00 PM', elapsedLabel: '01:12:44', estimatedCostUSD: 3400, authorized: true },
  { id: 'ot2', name: 'Art Dept (Stage 4)', memberCount: 18, startTime: '06:30 PM', elapsedLabel: '00:45:12', estimatedCostUSD: 1850, authorized: false },
]

const MOCK_PAYOUTS: WagePayout[] = [
  { id: 'p1', crewMemberId: 'c1', crewName: 'Sarah Jenkins', department: 'Transport', amount: 120, method: 'UPI', type: 'batta', status: 'paid', timestamp: new Date().toISOString() },
  { id: 'p2', crewMemberId: 'c2', crewName: 'Mike Ross', department: 'Transport', amount: 45, method: 'CASH', type: 'batta', status: 'paid', timestamp: new Date().toISOString() },
  { id: 'p3', crewMemberId: 'c3', crewName: 'David Chen', department: 'Camera', amount: 50, method: 'UPI', type: 'batta', status: 'requested', timestamp: new Date().toISOString() },
  { id: 'p4', crewMemberId: 'c4', crewName: 'Production Van 2', department: 'Transport', amount: 250, method: 'UPI', type: 'batta', status: 'approved', timestamp: new Date().toISOString() },
  { id: 'p5', crewMemberId: 'c5', crewName: 'Art Supplies Runner', department: 'Art Dept', amount: 30, method: 'CASH', type: 'batta', status: 'paid', timestamp: new Date().toISOString() },
]

export const crewService = {
  async getCrew(): Promise<CrewMember[]> {
    await delay(300)
    return MOCK_CREW
  },
  async getOvertimeGroups(): Promise<OvertimeGroup[]> {
    await delay(200)
    return MOCK_OT_GROUPS
  },
  async getWagePayouts(): Promise<WagePayout[]> {
    await delay(250)
    return MOCK_PAYOUTS
  },
}
