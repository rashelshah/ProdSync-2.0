import { apiFetch, readApiJson } from '@/lib/api'
import type {
  CameraAlert,
  CameraAssetLog,
  CameraRequest,
  CameraWishlistItem,
  CreateCameraRequestInput,
  CreateCameraWishlistInput,
  CreateDamageReportInput,
  DamageReport,
  CameraScanInput,
  UpdateCameraRequestInput,
  UpdateCameraWishlistInput,
} from '@/modules/camera/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const cameraService = {
  async getWishlist(projectId: string): Promise<CameraWishlistItem[]> {
    const response = await apiFetch(`/camera/wishlist?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ wishlist: CameraWishlistItem[] }>(response)
    return payload.wishlist ?? []
  },

  async createWishlistItem(input: CreateCameraWishlistInput): Promise<CameraWishlistItem> {
    const response = await apiFetch('/camera/wishlist', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: CameraWishlistItem }>(response)
    return payload.item
  },

  async updateWishlistItem(id: string, input: UpdateCameraWishlistInput): Promise<CameraWishlistItem> {
    const response = await apiFetch(`/camera/wishlist/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ item: CameraWishlistItem }>(response)
    return payload.item
  },

  async deleteWishlistItem(id: string, projectId: string): Promise<void> {
    const response = await apiFetch(`/camera/wishlist/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getRequests(projectId: string): Promise<CameraRequest[]> {
    const response = await apiFetch(`/camera/requests?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ requests: CameraRequest[] }>(response)
    return payload.requests ?? []
  },

  async createRequest(input: CreateCameraRequestInput): Promise<CameraRequest> {
    const response = await apiFetch('/camera/requests', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ request: CameraRequest }>(response)
    return payload.request
  },

  async updateRequest(id: string, input: UpdateCameraRequestInput): Promise<CameraRequest> {
    const response = await apiFetch(`/camera/requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ request: CameraRequest }>(response)
    return payload.request
  },

  async checkIn(input: CameraScanInput): Promise<CameraAssetLog> {
    const response = await apiFetch('/camera/checkin', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ log: CameraAssetLog }>(response)
    return payload.log
  },

  async checkOut(input: CameraScanInput): Promise<CameraAssetLog> {
    const response = await apiFetch('/camera/checkout', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ log: CameraAssetLog }>(response)
    return payload.log
  },

  async getLogs(projectId: string): Promise<CameraAssetLog[]> {
    const response = await apiFetch(`/camera/logs?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ logs: CameraAssetLog[] }>(response)
    return payload.logs ?? []
  },

  async createDamageReport(input: CreateDamageReportInput): Promise<DamageReport> {
    const response = await apiFetch('/camera/damage', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ report: DamageReport }>(response)
    return payload.report
  },

  async getDamageReports(projectId: string): Promise<DamageReport[]> {
    const response = await apiFetch(`/camera/damage?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ reports: DamageReport[] }>(response)
    return payload.reports ?? []
  },

  async getAlerts(projectId: string): Promise<CameraAlert[]> {
    const response = await apiFetch(`/camera/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: CameraAlert[] }>(response)
    return payload.alerts ?? []
  },
}
