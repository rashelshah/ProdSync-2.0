import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function CameraView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Asset Operations</span>
        <h1 className="page-title page-title-compact">Camera & Assets</h1>
        <p className="page-subtitle">Rental orders, inventory movement, and asset readiness will appear here once the camera module is connected to live data.</p>
      </header>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="No camera data yet"
          description="The seeded rental and asset metrics have been removed. Wire this module to Supabase tables and realtime logs to start testing it properly."
          icon="photo_camera"
        />
      </Surface>
    </div>
  )
}
