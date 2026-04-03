import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/system/SystemStates'

export function CameraView() {
  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Camera & Assets</h1>
        <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Rental Orders · Inventory · Asset Tracking</p>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Rental Days" value="41/68" subLabel="Day 41 of shoot" />
        <KpiCard label="Active Rentals" value="12" subLabel="Camera packages" />
        <KpiCard label="Data Ingested" value="18.4 TB" subLabel="Since Day 1" />
        <KpiCard label="Assets Checked Out" value="84" subLabel="3 overdue" subType="warning" />
        <KpiCard label="Daily Rental Cost" value="$4,200" subLabel="Within budget" subType="success" />
        <KpiCard label="Returns Pending" value="7" subLabel="Due today" subType="warning" />
      </section>
      <div className="bg-[#131313] border border-white/5 rounded-sm">
        <EmptyState
          title="Camera Module — Coming Soon"
          description="Rental order management, inventory tracker, and asset check-in/out system will be implemented here."
          icon="photo_camera"
        />
      </div>
    </div>
  )
}
