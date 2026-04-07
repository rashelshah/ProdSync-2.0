import { apiFetch, readApiJson } from '@/lib/api'
import type {
  CreateWardrobeAccessoryInput,
  CreateWardrobeContinuityInput,
  CreateWardrobeInventoryInput,
  CreateWardrobeLaundryInput,
  UpdateWardrobeAccessoryInput,
  UpdateWardrobeInventoryInput,
  UpdateWardrobeLaundryInput,
  WardrobeAccessoryItem,
  WardrobeAlert,
  WardrobeContinuityLog,
  WardrobeInventoryItem,
  WardrobeLaundryBatch,
} from '@/modules/wardrobe/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const wardrobeService = {
  async getContinuity(projectId: string, filters?: { scene?: string; character?: string }): Promise<WardrobeContinuityLog[]> {
    const params = new URLSearchParams({ projectId })
    if (filters?.scene) params.set('scene', filters.scene)
    if (filters?.character) params.set('character', filters.character)
    const response = await apiFetch(`/wardrobe/continuity?${params.toString()}`)
    const payload = await readApiJson<{ logs: WardrobeContinuityLog[] }>(response)
    return payload.logs ?? []
  },

  async createContinuity(input: CreateWardrobeContinuityInput): Promise<WardrobeContinuityLog> {
    const formData = new FormData()
    formData.append('projectId', input.projectId)
    formData.append('sceneNumber', input.sceneNumber)
    formData.append('characterName', input.characterName)
    if (input.actorName) formData.append('actorName', input.actorName)
    if (input.notes) formData.append('notes', input.notes)
    formData.append('image', input.image)

    const response = await apiFetch('/wardrobe/continuity', {
      method: 'POST',
      body: formData,
    })
    const payload = await readApiJson<{ log: WardrobeContinuityLog }>(response)
    return payload.log
  },

  async deleteContinuity(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/wardrobe/continuity/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getInventory(projectId: string): Promise<WardrobeInventoryItem[]> {
    const response = await apiFetch(`/wardrobe/inventory?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ items: WardrobeInventoryItem[] }>(response)
    return payload.items ?? []
  },

  async createInventory(input: CreateWardrobeInventoryInput): Promise<WardrobeInventoryItem> {
    const response = await apiFetch('/wardrobe/inventory', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: WardrobeInventoryItem }>(response)
    return payload.item
  },

  async updateInventory(id: string, input: UpdateWardrobeInventoryInput): Promise<WardrobeInventoryItem> {
    const response = await apiFetch(`/wardrobe/inventory/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: WardrobeInventoryItem }>(response)
    return payload.item
  },

  async getLaundry(projectId: string): Promise<WardrobeLaundryBatch[]> {
    const response = await apiFetch(`/wardrobe/laundry?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ batches: WardrobeLaundryBatch[] }>(response)
    return payload.batches ?? []
  },

  async createLaundry(input: CreateWardrobeLaundryInput): Promise<WardrobeLaundryBatch> {
    const response = await apiFetch('/wardrobe/laundry', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ batch: WardrobeLaundryBatch }>(response)
    return payload.batch
  },

  async updateLaundry(id: string, input: UpdateWardrobeLaundryInput): Promise<WardrobeLaundryBatch> {
    const response = await apiFetch(`/wardrobe/laundry/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ batch: WardrobeLaundryBatch }>(response)
    return payload.batch
  },

  async getAccessories(projectId: string): Promise<WardrobeAccessoryItem[]> {
    const response = await apiFetch(`/wardrobe/accessories?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ items: WardrobeAccessoryItem[] }>(response)
    return payload.items ?? []
  },

  async createAccessory(input: CreateWardrobeAccessoryInput): Promise<WardrobeAccessoryItem> {
    const response = await apiFetch('/wardrobe/accessories', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: WardrobeAccessoryItem }>(response)
    return payload.item
  },

  async updateAccessory(id: string, input: UpdateWardrobeAccessoryInput): Promise<WardrobeAccessoryItem> {
    const response = await apiFetch(`/wardrobe/accessories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: WardrobeAccessoryItem }>(response)
    return payload.item
  },

  async getAlerts(projectId: string): Promise<WardrobeAlert[]> {
    const response = await apiFetch(`/wardrobe/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: WardrobeAlert[] }>(response)
    return payload.alerts ?? []
  },
}
