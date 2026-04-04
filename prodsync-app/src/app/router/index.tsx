import { Navigate, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RouteAccessGuard } from '@/features/auth/access-control'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/AuthRouteGate'
import { LandingPage } from '@/modules/landing/views/LandingPage'
import { AuthPage } from '@/modules/auth/views/AuthPage'
import { DashboardView } from '@/modules/dashboard/views/DashboardView'
import { ProjectsView } from '@/modules/projects/views/ProjectsView'
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
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<RouteAccessGuard routeId="dashboard"><DashboardView /></RouteAccessGuard>} />
          <Route path="/projects" element={<RouteAccessGuard routeId="projects"><ProjectsView /></RouteAccessGuard>} />
          <Route path="/transport" element={<RouteAccessGuard routeId="transport"><TransportView /></RouteAccessGuard>} />
          <Route path="/camera" element={<RouteAccessGuard routeId="camera"><CameraView /></RouteAccessGuard>} />
          <Route path="/crew" element={<RouteAccessGuard routeId="crew"><CrewView /></RouteAccessGuard>} />
          <Route path="/expenses" element={<RouteAccessGuard routeId="expenses"><ExpensesView /></RouteAccessGuard>} />
          <Route path="/wardrobe" element={<RouteAccessGuard routeId="wardrobe"><WardrobeView /></RouteAccessGuard>} />
          <Route path="/approvals" element={<RouteAccessGuard routeId="approvals"><ApprovalsView /></RouteAccessGuard>} />
          <Route path="/reports" element={<RouteAccessGuard routeId="reports"><ReportsView /></RouteAccessGuard>} />
          <Route path="/settings" element={<RouteAccessGuard routeId="settings"><SettingsView /></RouteAccessGuard>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
