import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function ReportsView() {
  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-kicker">Insights</span>
          <h1 className="page-title page-title-compact">Reports & Insights</h1>
          <p className="page-subtitle">This reporting layer is now empty by design so real project snapshots can be tested module by module.</p>
        </div>
      </header>

      <Surface variant="table" padding="lg">
        <EmptyState
          icon="analytics"
          title="No reporting snapshots yet"
          description="The demo burn charts and budget summaries were removed. Connect this view to financial snapshots, approvals, and activity data to begin validating reports properly."
        />
      </Surface>
    </div>
  )
}
