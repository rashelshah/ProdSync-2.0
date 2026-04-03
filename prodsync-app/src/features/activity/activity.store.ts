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

let _activityCounter = 1

// Seed with initial production events
const SEED_EVENTS: ActivityEvent[] = [
  { id: 'a1', type: 'trip_completed', title: 'Scene 42 Wrap', description: 'Unit moved to Location B. All gear accounted for.', timestamp: new Date(Date.now() - 1000 * 60 * 30), module: 'transport' },
  { id: 'a2', type: 'asset_returned', title: 'Asset Ingested', description: 'Dailies from Day 41 uploaded to review server.', timestamp: new Date(Date.now() - 1000 * 60 * 60), module: 'camera' },
  { id: 'a3', type: 'crew_checkin', title: 'Crew Check-in', description: 'Art department team 2 arrived at backlot.', timestamp: new Date(Date.now() - 1000 * 60 * 90), module: 'crew' },
  { id: 'a4', type: 'callsheet_published', title: 'Call Sheet Published', description: 'Day 43 call sheet distributed to 142 recipients.', timestamp: new Date(Date.now() - 1000 * 60 * 120), module: 'system' },
  { id: 'a5', type: 'ot_triggered', title: 'OT Triggered: Scene 42', description: 'Main Stage crew overtime started. +120 crew affected.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), module: 'crew' },
]

export const useActivityStore = create<ActivityStore>((set) => ({
  events: SEED_EVENTS,

  addEvent: (event) =>
    set((state) => ({
      events: [
        {
          ...event,
          id: `act-${_activityCounter++}`,
          timestamp: new Date(),
        },
        ...state.events,
      ].slice(0, 100), // cap at 100 events
    })),

  clearEvents: () => set({ events: [] }),
}))
