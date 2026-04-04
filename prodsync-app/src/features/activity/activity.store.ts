import { create } from 'zustand'

export type ActivityEventType =
  | 'trip_started' | 'trip_completed' | 'fuel_uploaded' | 'receipt_validated'
  | 'ot_approved' | 'ot_triggered' | 'crew_checkin' | 'crew_checkout'
  | 'expense_added' | 'expense_approved' | 'expense_rejected'
  | 'approval_action' | 'asset_returned' | 'callsheet_published'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  title: string
  description: string
  timestamp: Date
  module: string
  userId?: string
}

interface ActivityStore {
  events: ActivityEvent[]
  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void
  clearEvents: () => void
}

let activityCounter = 1

export const useActivityStore = create<ActivityStore>((set) => ({
  events: [],

  addEvent: (event) =>
    set((state) => ({
      events: [
        {
          ...event,
          id: `act-${activityCounter++}`,
          timestamp: new Date(),
        },
        ...state.events,
      ].slice(0, 100),
    })),

  clearEvents: () => set({ events: [] }),
}))
