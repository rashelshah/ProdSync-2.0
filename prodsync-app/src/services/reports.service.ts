import { apiFetch, readApiJson } from '@/lib/api'
import type { ReportAlert, ReportBurnChartPoint, ReportDepartmentRow, ReportSummary } from '@/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

function extractFilename(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? fallback
}

async function downloadResponse(response: Response, fallbackFilename: string) {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { error?: string; message?: string } | null
    throw new Error(errorPayload?.error ?? errorPayload?.message ?? 'Export failed.')
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = extractFilename(response.headers.get('content-disposition'), fallbackFilename)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export const reportsService = {
  async getSummary(projectId: string): Promise<ReportSummary> {
    const response = await apiFetch(`/reports/summary?${withProjectId(projectId)}`)
    return readApiJson<ReportSummary>(response)
  },

  async getBurnChart(projectId: string): Promise<ReportBurnChartPoint[]> {
    const response = await apiFetch(`/reports/burn-chart?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ burnChart: ReportBurnChartPoint[] }>(response)
    return payload.burnChart ?? []
  },

  async getDepartments(projectId: string): Promise<ReportDepartmentRow[]> {
    const response = await apiFetch(`/reports/departments?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ departments: ReportDepartmentRow[] }>(response)
    return payload.departments ?? []
  },

  async getAlerts(projectId: string): Promise<ReportAlert[]> {
    const response = await apiFetch(`/reports/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: ReportAlert[] }>(response)
    return payload.alerts ?? []
  },

  async exportReport(projectId: string, type: 'pdf' | 'csv') {
    const response = await apiFetch(`/reports/export?${withProjectId(projectId)}&type=${encodeURIComponent(type)}`)
    await downloadResponse(response, `reports.${type}`)
  },
}
