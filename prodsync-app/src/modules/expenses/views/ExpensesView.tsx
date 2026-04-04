import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function ExpensesView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Budget Tracking</span>
        <h1 className="page-title page-title-compact">Art & Expenses</h1>
        <p className="page-subtitle">Petty cash, props, and expense workflows are now cleared of demo values and ready for real backend integration.</p>
      </header>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="No expense data yet"
          description="Seeded budget numbers were removed so this module can be implemented and tested against real project financial records."
          icon="palette"
        />
      </Surface>
    </div>
  )
}
