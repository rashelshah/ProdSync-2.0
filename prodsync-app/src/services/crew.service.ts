import type { CrewDashboardData, CrewMember, CrewProjectLocation, OvertimeGroup, WagePayout } from '@/types'
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
  lat: number
  lng: number
  radius: number
}

export interface CrewLocationSearchResult {
  name: string
  lat: number
  lng: number
}

export interface CrewReverseGeocodeResult {
  name: string
  lat: number | null
  lng: number | null
  address?: string
}

interface CrewProjectLocationResponse {
  message?: string
  projectLocation: CrewProjectLocation | null
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
  async getProjectLocation(projectId: string) {
    const response = await apiFetch(`/crew/location?${withProjectId(projectId)}`)
    const payload = await readApiJson<CrewProjectLocationResponse>(response)
    return payload.projectLocation ?? null
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
    const response = await apiFetch(`/crew/location/set?${withProjectId(input.projectId)}`, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        radius: input.radius,
      }),
    })
    return readApiJson<CrewProjectLocationResponse>(response)
  },
  async reverseGeocode(projectId: string, payload: Pick<GpsPayload, 'lat' | 'lng'>) {
    const params = new URLSearchParams({
      projectId,
      lat: String(payload.lat),
      lng: String(payload.lng),
    })
    const response = await apiFetch(`/location/reverse?${params.toString()}`)
    return readApiJson<CrewReverseGeocodeResult>(response)
  },
  async searchLocations(projectId: string, query: string) {
    const params = new URLSearchParams({
      projectId,
      q: query,
    })
    const response = await apiFetch(`/location/search?${params.toString()}`)
    return readApiJson<CrewLocationSearchResult[]>(response)
  },
}
