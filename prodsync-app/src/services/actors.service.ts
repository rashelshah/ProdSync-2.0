import { apiFetch, readApiJson } from '@/lib/api'
import type {
  ActorAlert,
  ActorCallSheet,
  ActorCallSheetGroup,
  ActorLook,
  ActorPayment,
  CreateActorCallSheetInput,
  CreateActorLookInput,
  CreateActorPaymentInput,
  CreateJuniorArtistLogInput,
  JuniorArtistLog,
  UpdateActorPaymentInput,
} from '@/modules/actors/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const actorsService = {
  async getJuniorLogs(projectId: string): Promise<JuniorArtistLog[]> {
    const response = await apiFetch(`/actors/juniors?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ logs: JuniorArtistLog[] }>(response)
    return payload.logs ?? []
  },

  async createJuniorLog(input: CreateJuniorArtistLogInput): Promise<JuniorArtistLog> {
    const response = await apiFetch('/actors/juniors', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ log: JuniorArtistLog }>(response)
    return payload.log
  },

  async deleteJuniorLog(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/actors/juniors/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getCallSheets(projectId: string): Promise<{ callSheets: ActorCallSheet[]; groupedByDate: ActorCallSheetGroup[] }> {
    const response = await apiFetch(`/actors/call-sheet?${withProjectId(projectId)}`)
    return readApiJson<{ callSheets: ActorCallSheet[]; groupedByDate: ActorCallSheetGroup[] }>(response)
  },

  async getCallSheet(projectId: string, id: string): Promise<ActorCallSheet> {
    const response = await apiFetch(`/actors/call-sheet/${encodeURIComponent(id)}?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ callSheet: ActorCallSheet }>(response)
    return payload.callSheet
  },

  async createCallSheet(input: CreateActorCallSheetInput): Promise<ActorCallSheet> {
    const response = await apiFetch('/actors/call-sheet', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ callSheet: ActorCallSheet }>(response)
    return payload.callSheet
  },

  async getPayments(projectId: string): Promise<ActorPayment[]> {
    const response = await apiFetch(`/actors/payments?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ payments: ActorPayment[] }>(response)
    return payload.payments ?? []
  },

  async createPayment(input: CreateActorPaymentInput): Promise<ActorPayment> {
    const response = await apiFetch('/actors/payments', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ payment: ActorPayment }>(response)
    return payload.payment
  },

  async updatePaymentStatus(id: string, input: UpdateActorPaymentInput): Promise<ActorPayment> {
    const response = await apiFetch(`/actors/payments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ payment: ActorPayment }>(response)
    return payload.payment
  },

  async getLooks(projectId: string, filters?: { actor?: string; character?: string }): Promise<ActorLook[]> {
    const params = new URLSearchParams({ projectId })
    if (filters?.actor) params.set('actor', filters.actor)
    if (filters?.character) params.set('character', filters.character)
    const response = await apiFetch(`/actors/look?${params.toString()}`)
    const payload = await readApiJson<{ looks: ActorLook[] }>(response)
    return payload.looks ?? []
  },

  async createLook(input: CreateActorLookInput): Promise<ActorLook> {
    const formData = new FormData()
    formData.append('projectId', input.projectId)
    formData.append('actorName', input.actorName)
    if (input.characterName) formData.append('characterName', input.characterName)
    if (input.notes) formData.append('notes', input.notes)
    formData.append('image', input.image)

    const response = await apiFetch('/actors/look', {
      method: 'POST',
      body: formData,
    })
    const payload = await readApiJson<{ look: ActorLook }>(response)
    return payload.look
  },

  async deleteLook(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/actors/look/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getAlerts(projectId: string): Promise<ActorAlert[]> {
    const response = await apiFetch(`/actors/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: ActorAlert[] }>(response)
    return payload.alerts ?? []
  },
}
