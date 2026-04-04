import { apiFetch, readApiJson } from '@/lib/api'
import type { AlertItem } from '@/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

interface BackendAlert {
  id: string
  source: AlertItem['source']
  severity: AlertItem['severity']
  title: string
  message: string
  timestamp: string
  acknowledged: boolean
}

function toAlertItem(alert: BackendAlert): AlertItem {
  return {
    ...alert,
    timestamp: new Date(alert.timestamp),
  }
}

export const alertsService = {
  async getAlerts(projectId: string): Promise<AlertItem[]> {
    console.log('[alertsService] fetching alerts', { projectId })
    const response = await apiFetch(`/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: BackendAlert[] }>(response)
    const alerts = (payload.alerts ?? []).map(toAlertItem)
    console.log('[alertsService] alerts loaded', { projectId, count: alerts.length })
    return alerts
  },

  async acknowledgeAlert(projectId: string, alertId: string): Promise<void> {
    console.log('[alertsService] acknowledging alert', { projectId, alertId })
    const response = await apiFetch(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
    await readApiJson<{ ok: boolean }>(response)
    console.log('[alertsService] alert acknowledged', { projectId, alertId })
  },

  async acknowledgeAll(projectId: string): Promise<void> {
    console.log('[alertsService] acknowledging all alerts', { projectId })
    const response = await apiFetch('/alerts/acknowledge-all', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
    await readApiJson<{ ok: boolean }>(response)
    console.log('[alertsService] all alerts acknowledged', { projectId })
  },
}
