import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function ExpensesView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Budget Tracking</span>
        <h1 className="page-title page-title-compact">Art & Expenses</h1>
        <p className="page-subtitle">Petty cash, props, and expense visibility on the new white, black, and orange system.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Spent" value="$88,400" subLabel="88% of budget" subType="warning" accentColor="#f97316" />
        <KpiCard label="Petty Cash" value="$3,400" subLabel="Remaining today" />
        <KpiCard label="Active Builds" value="4" subLabel="Sets under construction" accentColor="#18181b" />
        <KpiCard label="Prop Inventory" value="312" subLabel="Items tracked" />
        <KpiCard label="Pending Receipts" value="18" subLabel="Awaiting validation" subType="warning" />
        <KpiCard label="Budget Variance" value="+$8,200" subLabel="Over projection" subType="critical" accentColor="#ef4444" />
      </section>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="Art & Expenses Module - Coming Soon"
          description="Petty cash ledgers, receipt validation, prop inventory, and budget comparison tools will be built here."
          icon="palette"
        />
      </Surface>
    </div>
  )
}
