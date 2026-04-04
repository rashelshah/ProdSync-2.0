import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function WardrobeView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Continuity Control</span>
        <h1 className="page-title page-title-compact">Wardrobe & Makeup</h1>
        <p className="page-subtitle">Continuity, laundry, and cast readiness brought into the same open, minimal layout.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Cast Ready" value="12/12" subLabel="All principals cleared" subType="success" accentColor="#f97316" />
        <KpiCard label="Costumes Tracked" value="248" subLabel="Active production" />
        <KpiCard label="Laundry Batches" value="3" subLabel="In progress" accentColor="#18181b" />
        <KpiCard label="Expedited Items" value="2" subLabel="Rush orders" subType="warning" />
        <KpiCard label="Continuity Logs" value="89" subLabel="Scene entries" />
        <KpiCard label="Damage Reports" value="1" subLabel="Pending assessment" subType="warning" />
      </section>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="Wardrobe & Makeup Module - Coming Soon"
          description="Continuity image logs, laundry tracking, cast readiness, and costume checkout flows will be implemented here."
          icon="checkroom"
        />
      </Surface>
    </div>
  )
}
