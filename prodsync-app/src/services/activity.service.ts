import { apiFetch, readApiJson } from '@/lib/api'
import type { ActivityEvent } from '@/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const activityService = {
  async getActivity(projectId: string): Promise<ActivityEvent[]> {
    console.log('[activityService] fetching activity', { projectId })
    const response = await apiFetch(`/activity?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ events: ActivityEvent[] }>(response)
    console.log('[activityService] activity loaded', { projectId, count: payload.events?.length ?? 0 })
    return payload.events ?? []
  },
}
