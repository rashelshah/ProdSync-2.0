import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'

export function WardrobeView() {
  return (
    <div className="page-shell">
      <header>
        <span className="page-kicker">Continuity Control</span>
        <h1 className="page-title page-title-compact">Wardrobe & Makeup</h1>
        <p className="page-subtitle">Continuity, laundry, and cast readiness are ready for real records instead of placeholder metrics.</p>
      </header>

      <Surface variant="table" padding="lg">
        <EmptyState
          title="No wardrobe data yet"
          description="Demo continuity counts and readiness stats have been removed so this area can be built with actual wardrobe logs and continuity records."
          icon="checkroom"
        />
      </Surface>
    </div>
  )
}
