import { Surface } from '@/components/shared/Surface'
import type { ReportAlert } from '@/types'
import { formatDate, formatTime } from '@/utils'

interface AlertsPanelProps {
  alerts: ReportAlert[]
}

function alertStyles(severity: ReportAlert['severity']) {
  if (severity === 'RED') {
    return {
      shell: 'border-red-200 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10',
      pill: 'bg-red-500 text-white',
    }
  }

  if (severity === 'YELLOW') {
    return {
      shell: 'border-orange-200 bg-orange-50/80 dark:border-orange-500/20 dark:bg-orange-500/10',
      pill: 'bg-orange-500 text-black',
    }
  }

  return {
    shell: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    pill: 'bg-emerald-500 text-white',
  }
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Surface variant="table" padding="lg">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Alert Engine</p>
          <h2 className="section-title">Active Signals</h2>
          <p className="section-description">Budget overruns, OT spikes, and anomaly detection from the reporting job.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            No active reporting alerts. The project is currently within tracked thresholds.
          </div>
        ) : (
          alerts.map(alert => {
            const styles = alertStyles(alert.severity)
            return (
              <div key={alert.id} className={`rounded-[24px] border px-4 py-4 ${styles.shell}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.pill}`}>
                    {alert.severity}
                  </span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.type.replace(/_/g, ' ')}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{alert.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {alert.department ?? 'project'} | {formatDate(alert.createdAt)} | {formatTime(alert.createdAt)}
                </p>
              </div>
            )
          })
        )}
      </div>
    </Surface>
  )
}
