import { KpiCard } from '@/components/shared/KpiCard'
import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function CameraView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Asset Operations</span>
        <h1 className="page-title page-title-compact">Camera & Assets</h1>
        <p className="page-subtitle">Rental orders, inventory movement, and asset readiness in the same open layout system.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Rental Days" value="41/68" subLabel="Day 41 of shoot" />
        <KpiCard label="Active Rentals" value="12" subLabel="Camera packages" />
        <KpiCard label="Data Ingested" value="18.4 TB" subLabel="Since day 1" accentColor="#f97316" />
        <KpiCard label="Assets Checked Out" value="84" subLabel="3 overdue" subType="warning" />
        <KpiCard label="Daily Rental Cost" value="$4,200" subLabel="Within budget" subType="success" />
        <KpiCard label="Returns Pending" value="7" subLabel="Due today" subType="warning" />
      </section>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="Camera Module - Coming Soon"
          description="Rental order management, inventory tracking, and asset check-in and check-out flows will live here."
          icon="photo_camera"
        />
      </Surface>
    </div>
  )
}
