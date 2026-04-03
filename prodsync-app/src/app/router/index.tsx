import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardView } from '@/modules/dashboard/views/DashboardView'
import { TransportView } from '@/modules/transport/views/TransportView'
import { CameraView } from '@/modules/camera/views/CameraView'
import { CrewView } from '@/modules/crew/views/CrewView'
import { ExpensesView } from '@/modules/expenses/views/ExpensesView'
import { WardrobeView } from '@/modules/wardrobe/views/WardrobeView'
import { ApprovalsView } from '@/modules/approvals/views/ApprovalsView'
import { ReportsView } from '@/modules/reports/views/ReportsView'
import { SettingsView } from '@/modules/settings/views/SettingsView'

export function AppRouter() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/transport" element={<TransportView />} />
        <Route path="/camera" element={<CameraView />} />
        <Route path="/crew" element={<CrewView />} />
        <Route path="/expenses" element={<ExpensesView />} />
        <Route path="/wardrobe" element={<WardrobeView />} />
        <Route path="/approvals" element={<ApprovalsView />} />
        <Route path="/reports" element={<ReportsView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<DashboardView />} />
      </Routes>
    </AppLayout>
  )
}
