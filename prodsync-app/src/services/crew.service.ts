import type { CrewMember, OvertimeGroup, WagePayout } from '@/types'
import { apiFetch, readApiJson } from '@/lib/api'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const crewService = {
  async getCrew(projectId: string): Promise<CrewMember[]> {
    console.log('[crewService] fetching crew', { projectId })
    const response = await apiFetch(`/crew?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ crew: CrewMember[] }>(response)
    console.log('[crewService] crew loaded', { projectId, count: payload.crew?.length ?? 0 })
    return payload.crew ?? []
  },
  async getOvertimeGroups(projectId: string): Promise<OvertimeGroup[]> {
    console.log('[crewService] fetching overtime groups', { projectId })
    const response = await apiFetch(`/crew/overtime?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ groups: OvertimeGroup[] }>(response)
    console.log('[crewService] overtime groups loaded', { projectId, count: payload.groups?.length ?? 0 })
    return payload.groups ?? []
  },
  async getWagePayouts(projectId: string): Promise<WagePayout[]> {
    console.log('[crewService] fetching wage payouts', { projectId })
    const response = await apiFetch(`/crew/payouts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ payouts: WagePayout[] }>(response)
    console.log('[crewService] wage payouts loaded', { projectId, count: payload.payouts?.length ?? 0 })
    return payload.payouts ?? []
  },
}
