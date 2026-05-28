import { apiFetch, readApiJson } from '@/lib/api'
import type {
  AccommodationAlert,
  AccommodationHotel,
  CreateAccommodationHotelInput,
  CreateHotelAllocationInput,
  HotelAllocation,
  HotelReminder,
  TravelSyncItem,
  UpdateAccommodationHotelInput,
  UpdateHotelAllocationInput,
} from '@/modules/accommodation/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const accommodationService = {
  async getHotels(projectId?: string | null): Promise<AccommodationHotel[]> {
    const query = projectId ? `?${withProjectId(projectId)}` : ''
    const response = await apiFetch(`/accommodation/hotels${query}`)
    const payload = await readApiJson<{ hotels: AccommodationHotel[] }>(response)
    return payload.hotels ?? []
  },

  async createHotel(input: CreateAccommodationHotelInput): Promise<AccommodationHotel> {
    const response = await apiFetch('/accommodation/hotels', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ hotel: AccommodationHotel }>(response)
    return payload.hotel
  },

  async updateHotel(id: string, input: UpdateAccommodationHotelInput): Promise<AccommodationHotel> {
    const response = await apiFetch(`/accommodation/hotels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ hotel: AccommodationHotel }>(response)
    return payload.hotel
  },

  async getAllocations(projectId: string): Promise<HotelAllocation[]> {
    const response = await apiFetch(`/accommodation/allocations?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ allocations: HotelAllocation[] }>(response)
    return payload.allocations ?? []
  },

  async createAllocation(input: CreateHotelAllocationInput): Promise<HotelAllocation> {
    const response = await apiFetch('/accommodation/allocations', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ allocation: HotelAllocation }>(response)
    return payload.allocation
  },

  async updateAllocation(id: string, input: UpdateHotelAllocationInput): Promise<HotelAllocation> {
    const response = await apiFetch(`/accommodation/allocations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ allocation: HotelAllocation }>(response)
    return payload.allocation
  },

  async deleteAllocation(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/accommodation/allocations/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getReminders(projectId: string): Promise<HotelReminder[]> {
    const response = await apiFetch(`/accommodation/reminders?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ reminders: HotelReminder[] }>(response)
    return payload.reminders ?? []
  },

  async getTravelSync(projectId: string): Promise<TravelSyncItem[]> {
    const response = await apiFetch(`/accommodation/travel-sync?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ travel: TravelSyncItem[] }>(response)
    return payload.travel ?? []
  },

  async getAlerts(projectId: string): Promise<AccommodationAlert[]> {
    const response = await apiFetch(`/accommodation/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: AccommodationAlert[] }>(response)
    return payload.alerts ?? []
  },
}
