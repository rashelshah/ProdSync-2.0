import { create } from 'zustand'
import type { AlertItem, AlertSeverity } from '@/types'

interface AlertStore {
  alerts: AlertItem[]
  unreadCount: number
  addAlerts: (newAlerts: AlertItem[]) => void
  acknowledgeAlert: (id: string) => void
  acknowledgeAll: () => void
  clearAlerts: () => void
  getAlertsBySeverity: (severity: AlertSeverity) => AlertItem[]
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  addAlerts: (newAlerts) =>
    set((state) => {
      // Deduplicate by title+source to avoid spam on polling
      const existingKeys = new Set(state.alerts.map(a => `${a.source}:${a.title}`))
      const fresh = newAlerts.filter(a => !existingKeys.has(`${a.source}:${a.title}`))
      const merged = [...fresh, ...state.alerts].slice(0, 50) // cap at 50
      return {
        alerts: merged,
        unreadCount: merged.filter(a => !a.acknowledged).length,
      }
    }),

  acknowledgeAlert: (id) =>
    set((state) => {
      const alerts = state.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a)
      return { alerts, unreadCount: alerts.filter(a => !a.acknowledged).length }
    }),

  acknowledgeAll: () =>
    set((state) => ({
      alerts: state.alerts.map(a => ({ ...a, acknowledged: true })),
      unreadCount: 0,
    })),

  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),

  getAlertsBySeverity: (severity) =>
    get().alerts.filter(a => a.severity === severity),
}))
