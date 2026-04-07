import type { CrewDashboardData, CrewMember, OvertimeGroup, WagePayout } from '@/types'
import { apiFetch, readApiJson } from '@/lib/api'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

interface GpsPayload {
  lat: number
  lng: number
  accuracy: number | null
  timestamp: string
}

interface CrewLocationUpdateInput {
  projectId: string
  name?: string
  latitude: number
  longitude: number
  radiusMeters: number
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
  async getDashboard(projectId: string): Promise<CrewDashboardData> {
    console.log('[crewService] fetching dashboard', { projectId })
    const response = await apiFetch(`/crew/dashboard?${withProjectId(projectId)}`)
    return readApiJson<CrewDashboardData>(response)
  },
  async checkIn(projectId: string, payload: GpsPayload) {
    const response = await apiFetch(`/crew/attendance/check-in?${withProjectId(projectId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return readApiJson<{ message: string }>(response)
  },
  async checkOut(projectId: string, payload: GpsPayload) {
    const response = await apiFetch(`/crew/attendance/check-out?${withProjectId(projectId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return readApiJson<{ message: string }>(response)
  },
  async requestBatta(projectId: string, amount: number) {
    const response = await apiFetch(`/crew/batta/request?${withProjectId(projectId)}`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
    return readApiJson<{ message: string }>(response)
  },
  async approveBatta(projectId: string, payoutId: string) {
    const response = await apiFetch(`/crew/batta/${encodeURIComponent(payoutId)}/approve?${withProjectId(projectId)}`, {
      method: 'POST',
    })
    return readApiJson<{ message: string }>(response)
  },
  async markBattaPaid(projectId: string, payoutId: string, paymentMethod: 'UPI' | 'CASH' | 'BANK') {
    const response = await apiFetch(`/crew/batta/${encodeURIComponent(payoutId)}/pay?${withProjectId(projectId)}`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    })
    return readApiJson<{ message: string }>(response)
  },
  async updateProjectLocation(input: CrewLocationUpdateInput) {
    const response = await apiFetch(`/crew/location?${withProjectId(input.projectId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
      }),
    })
    return readApiJson<{ message: string }>(response)
  },
}
