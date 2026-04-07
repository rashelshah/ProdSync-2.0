import { env } from '../utils/env'
import { getCacheString, incrementCacheCounter } from './cache.service'

export type MapboxMode = 'normal' | 'restricted' | 'disabled'
export type MapProvider = 'mapbox' | 'osm'
export type MapProviderRole = 'ADMIN' | 'PRODUCER' | 'CAPTAIN' | 'DRIVER' | 'MEMBER'

export interface MapboxUsageState {
  dailyCount: number
  monthlyCount: number
  dailyUsagePercent: number
  monthlyUsagePercent: number
  usagePercent: number
  enabled: boolean
  mode: MapboxMode
  reason?: string
}

export const LIMITS = {
  SAFE: 70,
  WARNING: 90,
  CRITICAL: 100,
} as const

function dailyUsageKey() {
  return `mapbox:daily_count:${new Date().toISOString().slice(0, 10)}`
}

function monthlyUsageKey() {
  return `mapbox:monthly_count:${new Date().toISOString().slice(0, 7)}`
}

function secondsUntilEndOfDay() {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000))
}

function secondsUntilEndOfMonth() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000))
}

export function getMapboxToken() {
  const token = process.env.MAPBOX_TOKEN ?? process.env.MAPBOX_ACCESS_TOKEN ?? env.mapboxAccessToken
  return typeof token === 'string' ? token : ''
}

export function hasMapboxToken() {
  const token = process.env.MAPBOX_TOKEN ?? process.env.MAPBOX_ACCESS_TOKEN ?? env.mapboxAccessToken
  return typeof token === 'string' && token.trim().length > 0
}

function calculateUsagePercent(dailyCount: number, monthlyCount: number) {
  const dailyUsagePercent = env.mapboxDailyLimit > 0 ? (dailyCount / env.mapboxDailyLimit) * 100 : 0
  const monthlyUsagePercent = env.mapboxMonthlyLimit > 0 ? (monthlyCount / env.mapboxMonthlyLimit) * 100 : 0
  return {
    dailyUsagePercent,
    monthlyUsagePercent,
    usagePercent: Math.max(dailyUsagePercent, monthlyUsagePercent),
  }
}

let lastLoggedMode: MapboxMode | null = null

function logModeTransition(mode: MapboxMode) {
  if (lastLoggedMode === mode) {
    return
  }

  if (mode === 'restricted') {
    console.warn('Mapbox -> Restricted mode')
  }

  if (mode === 'disabled') {
    console.warn('Mapbox -> Disabled, switching to OSM')
  }

  lastLoggedMode = mode
}

export async function getMapboxUsageState(): Promise<MapboxUsageState> {
  if (!hasMapboxToken()) {
    logModeTransition('disabled')
    return {
      dailyCount: 0,
      monthlyCount: 0,
      dailyUsagePercent: 0,
      monthlyUsagePercent: 0,
      usagePercent: 0,
      enabled: false,
      mode: 'disabled',
      reason: 'No token',
    }
  }

  const [dailyResult, monthlyResult] = await Promise.allSettled([
    getCacheString(dailyUsageKey()),
    getCacheString(monthlyUsageKey()),
  ])

  const dailyCount = Number(dailyResult.status === 'fulfilled' ? (dailyResult.value ?? 0) : 0)
  const monthlyCount = Number(monthlyResult.status === 'fulfilled' ? (monthlyResult.value ?? 0) : 0)
  const percentages = calculateUsagePercent(dailyCount, monthlyCount)

  if (percentages.usagePercent < LIMITS.SAFE) {
    logModeTransition('normal')
    return {
      dailyCount,
      monthlyCount,
      ...percentages,
      enabled: true,
      mode: 'normal',
    }
  }

  if (percentages.usagePercent < LIMITS.WARNING) {
    logModeTransition('restricted')
    return {
      dailyCount,
      monthlyCount,
      ...percentages,
      enabled: true,
      mode: 'restricted',
    }
  }

  logModeTransition('disabled')
  return {
    dailyCount,
    monthlyCount,
    ...percentages,
    enabled: false,
    mode: 'disabled',
    reason: 'Usage limit reached',
  }
}

export async function incrementMapboxUsage() {
  if (!hasMapboxToken()) {
    return
  }

  await Promise.allSettled([
    incrementCacheCounter(dailyUsageKey(), secondsUntilEndOfDay()),
    incrementCacheCounter(monthlyUsageKey(), secondsUntilEndOfMonth()),
  ])
}

export function mapboxUsageSnapshot(state: MapboxUsageState) {
  return {
    dailyCount: state.dailyCount,
    monthlyCount: state.monthlyCount,
    dailyUsagePercent: Number(state.dailyUsagePercent.toFixed(2)),
    monthlyUsagePercent: Number(state.monthlyUsagePercent.toFixed(2)),
    usagePercent: Number(state.usagePercent.toFixed(2)),
    enabled: state.enabled,
    mode: state.mode,
    reason: state.reason ?? null,
  }
}

export function selectMapProvider(userRole: MapProviderRole, state: MapboxUsageState): MapProvider {
  if (userRole === 'DRIVER') {
    return 'osm'
  }

  if (!state.enabled) {
    return 'osm'
  }

  if (state.mode === 'restricted') {
    return userRole === 'ADMIN' ? 'mapbox' : 'osm'
  }

  if (userRole === 'ADMIN' || userRole === 'PRODUCER') {
    return 'mapbox'
  }

  return 'osm'
}

export async function safeMapboxCall<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (error) {
    console.warn('[mapbox] safe fallback', {
      error: error instanceof Error ? error.message : error,
    })
    return null
  }
}
