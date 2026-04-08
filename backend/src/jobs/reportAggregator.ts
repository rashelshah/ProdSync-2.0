import { runAggregationCycle } from '../services/reportService'

const ACTIVE_PROJECT_INTERVAL_MS = 5 * 60 * 1000
const ARCHIVED_PROJECT_INTERVAL_MS = 60 * 60 * 1000

let started = false

function scheduleCycle(label: 'active' | 'archived', isArchived: boolean, intervalMs: number) {
  const run = async () => {
    try {
      await runAggregationCycle(isArchived)
      console.log('[reports][aggregator] cycle complete', { label, intervalMs })
    } catch (error) {
      console.error('[reports][aggregator] cycle failed', {
        label,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  void run()
  const timer = setInterval(() => {
    void run()
  }, intervalMs) as ReturnType<typeof setInterval> & { unref?: () => void }
  timer.unref?.()
}

export function startReportAggregator() {
  if (started) {
    return
  }

  started = true
  scheduleCycle('active', false, ACTIVE_PROJECT_INTERVAL_MS)
  scheduleCycle('archived', true, ARCHIVED_PROJECT_INTERVAL_MS)
}
