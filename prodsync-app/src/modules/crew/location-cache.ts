import type { CrewDashboardData, CrewProjectLocation } from '@/types'

const PROJECT_LOCATION_CACHE_PREFIX = 'project_location_'
const SESSION_AUTO_LOCATION_PREFIX = 'crew_auto_location_'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function getProjectLocationCacheKey(projectId: string) {
  return `${PROJECT_LOCATION_CACHE_PREFIX}${projectId}`
}

export function readCachedProjectLocation(projectId: string) {
  if (!projectId || !canUseStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(getProjectLocationCacheKey(projectId))
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as CrewProjectLocation
  } catch {
    window.localStorage.removeItem(getProjectLocationCacheKey(projectId))
    return null
  }
}

export function writeCachedProjectLocation(projectId: string, location: CrewProjectLocation | null | undefined) {
  if (!projectId || !canUseStorage()) {
    return
  }

  if (!location) {
    window.localStorage.removeItem(getProjectLocationCacheKey(projectId))
    return
  }

  window.localStorage.setItem(getProjectLocationCacheKey(projectId), JSON.stringify(location))
}

export function seedDashboardWithCachedLocation(projectId: string, emptyDashboardData: CrewDashboardData) {
  const cachedLocation = readCachedProjectLocation(projectId)
  if (!cachedLocation) {
    return emptyDashboardData
  }

  return {
    ...emptyDashboardData,
    projectLocation: cachedLocation,
  } satisfies CrewDashboardData
}

export function hasAutoLocationRun(projectId: string) {
  if (!projectId || !canUseStorage()) {
    return false
  }

  return window.sessionStorage.getItem(`${SESSION_AUTO_LOCATION_PREFIX}${projectId}`) === '1'
}

export function markAutoLocationRun(projectId: string) {
  if (!projectId || !canUseStorage()) {
    return
  }

  window.sessionStorage.setItem(`${SESSION_AUTO_LOCATION_PREFIX}${projectId}`, '1')
}
