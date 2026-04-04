import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'

export const crewService = {
  async getCrew(): Promise<CrewMember[]> {
    return []
  },
  async getOvertimeGroups(): Promise<OvertimeGroup[]> {
    return []
  },
  async getWagePayouts(): Promise<WagePayout[]> {
    return []
  },
}
