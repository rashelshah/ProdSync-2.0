import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/system/SystemStates'

export function ExpensesView() {
  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Art & Expenses</h1>
        <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Petty Cash · Props · Budget Tracking</p>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Spent" value="$88,400" subLabel="88% of budget" subType="warning" />
        <KpiCard label="Petty Cash" value="$3,400" subLabel="Remaining today" />
        <KpiCard label="Active Builds" value="4" subLabel="Sets under construction" />
        <KpiCard label="Prop Inventory" value="312" subLabel="Items tracked" />
        <KpiCard label="Pending Receipts" value="18" subLabel="Awaiting validation" subType="warning" />
        <KpiCard label="Budget Variance" value="+$8,200" subLabel="Over projection" subType="critical" />
      </section>
      <div className="bg-[#131313] border border-white/5 rounded-sm">
        <EmptyState
          title="Art & Expenses Module — Coming Soon"
          description="Petty cash ledger, receipt validation, prop inventory, and budget comparison tools will be built here."
          icon="palette"
        />
      </div>
    </div>
  )
}
