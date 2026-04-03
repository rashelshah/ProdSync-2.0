import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/system/SystemStates'

export function WardrobeView() {
  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Wardrobe & Makeup</h1>
        <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Continuity · Laundry · Cast Readiness</p>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Cast Ready" value="12/12" subLabel="All principals cleared" subType="success" />
        <KpiCard label="Costumes Tracked" value="248" subLabel="Active production" />
        <KpiCard label="Laundry Batches" value="3" subLabel="In progress" />
        <KpiCard label="Expedited Items" value="2" subLabel="Rush orders" subType="warning" />
        <KpiCard label="Continuity Logs" value="89" subLabel="Scene entries" />
        <KpiCard label="Damage Reports" value="1" subLabel="Pending assessment" subType="warning" />
      </section>
      <div className="bg-[#131313] border border-white/5 rounded-sm">
        <EmptyState
          title="Wardrobe & Makeup Module — Coming Soon"
          description="Continuity image logs, laundry tracker, cast readiness board, and costume checkout system will be implemented here."
          icon="checkroom"
        />
      </div>
    </div>
  )
}
