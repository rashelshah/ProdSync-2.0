import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { APP_NAV_ITEMS, canAccessRoute, type AppRouteId } from '@/features/auth/access-rules'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import type { ProjectPhase, User } from '@/types'

export type WorkflowModuleId = AppRouteId

export interface WorkflowAction {
  id: string
  label: string
  description: string
  path: string
}

export interface WorkflowReportSection {
  id: string
  title: string
  description: string
}

interface WorkflowPhaseConfig {
  id: ProjectPhase
  nav: Array<{ routeId: WorkflowModuleId; label?: string }>
  quickActions: WorkflowAction[]
  reportSections: WorkflowReportSection[]
}

export const PROJECT_PHASE_OPTIONS: Array<{ value: ProjectPhase; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'pre_production', label: 'Pre Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post Production' },
  { value: 'completed', label: 'Completed' },
]

export function formatProjectPhase(phase: ProjectPhase | null | undefined) {
  return PROJECT_PHASE_OPTIONS.find(option => option.value === phase)?.label ?? 'Planning'
}

export function canManageProjectWorkflowClient(user: User | null | undefined) {
  return Boolean(
    user?.role === 'EP'
      || user?.role === 'LineProducer'
      || user?.projectRoleTitle === 'Executive Producer'
      || user?.projectRoleTitle === 'Line Producer'
      || user?.projectRoleTitle === 'Production Manager',
  )
}

const PHASE_CONFIG: Record<ProjectPhase, WorkflowPhaseConfig> = {
  planning: {
    id: 'planning',
    nav: [
      { routeId: 'dashboard' },
      { routeId: 'projects', label: 'Project Workspace' },
      { routeId: 'reports' },
      { routeId: 'approvals' },
      { routeId: 'settings' },
    ],
    quickActions: [
      { id: 'continue-planning', label: 'Continue Project Planning', description: 'Finish planning sections and estimates.', path: '/projects' },
      { id: 'generate-budget', label: 'Generate Budget', description: 'Review the estimate and budget allocation.', path: '/settings' },
      { id: 'invite-team', label: 'Invite Team', description: 'Share the project code with your core team.', path: '/settings' },
    ],
    reportSections: [
      { id: 'planning-summary', title: 'Planning Summary', description: 'Setup progress, estimated spend, and open planning work.' },
      { id: 'estimated-budget', title: 'Estimated Budget', description: 'Budget estimates and allocation posture.' },
      { id: 'estimated-crew', title: 'Estimated Crew', description: 'Planned headcount and staffing assumptions.' },
      { id: 'estimated-cast', title: 'Estimated Cast', description: 'Cast planning and coordination estimates.' },
      { id: 'planning-progress', title: 'Planning Progress', description: 'Section completion and next planning steps.' },
    ],
  },
  pre_production: {
    id: 'pre_production',
    nav: [
      { routeId: 'projects', label: 'Project Workspace' },
      { routeId: 'dashboard' },
      { routeId: 'locations' },
      { routeId: 'transport' },
      { routeId: 'accommodation' },
      { routeId: 'food-beverages' },
      { routeId: 'crew' },
      { routeId: 'actors' },
      { routeId: 'camera' },
      { routeId: 'expenses', label: 'Art Department' },
      { routeId: 'approvals' },
      { routeId: 'reports' },
      { routeId: 'settings' },
    ],
    quickActions: [
      { id: 'add-location', label: 'Add Location', description: 'Start location scouting and permissions.', path: '/locations' },
      { id: 'book-accommodation', label: 'Book Accommodation', description: 'Block rooms for cast and HOD travel.', path: '/accommodation' },
      { id: 'create-transport', label: 'Create Transport', description: 'Prepare vehicle plans and movements.', path: '/transport' },
      { id: 'add-catering-forecast', label: 'Add Catering Forecast', description: 'Plan meal counts before the shoot.', path: '/food-beverages' },
    ],
    reportSections: [
      { id: 'location-status', title: 'Location Status', description: 'Readiness, scouting progress, and blockers.' },
      { id: 'permission-status', title: 'Permission Status', description: 'Permit approvals and expiry risk.' },
      { id: 'accommodation-status', title: 'Accommodation Status', description: 'Stay allocations and travel readiness.' },
      { id: 'transport-readiness', title: 'Transport Readiness', description: 'Fleet prep and routing readiness.' },
      { id: 'food-planning', title: 'Food Planning', description: 'Forecast coverage and catering prep.' },
    ],
  },
  production: {
    id: 'production',
    nav: [
      { routeId: 'dashboard' },
      { routeId: 'transport' },
      { routeId: 'food-beverages' },
      { routeId: 'crew' },
      { routeId: 'actors' },
      { routeId: 'camera' },
      { routeId: 'expenses', label: 'Art Department' },
      { routeId: 'locations' },
      { routeId: 'approvals' },
      { routeId: 'reports' },
      { routeId: 'settings' },
    ],
    quickActions: [
      { id: 'create-call-sheet', label: 'Create Call Sheet', description: "Manage today's shoot coordination.", path: '/actors' },
      { id: 'log-meals', label: 'Log Meals', description: "Track today's catering activity.", path: '/food-beverages' },
      { id: 'approve-expenses', label: 'Approve Expenses', description: 'Work through the live approvals queue.', path: '/approvals' },
      { id: 'track-attendance', label: 'Track Attendance', description: 'Review live crew attendance and OT.', path: '/crew' },
    ],
    reportSections: [
      { id: 'department-expenses', title: 'Department Expenses', description: 'Live cost burn across departments.' },
      { id: 'transport-costs', title: 'Transport Costs', description: 'Trip, fuel, and movement spend.' },
      { id: 'meals', title: 'Meals', description: 'Meal volume, cost, and forecast variance.' },
      { id: 'crew-summary', title: 'Crew Summary', description: 'Attendance, OT, and wage exposure.' },
      { id: 'location-usage', title: 'Location Usage', description: 'Daily location readiness and usage.' },
    ],
  },
  post_production: {
    id: 'post_production',
    nav: [
      { routeId: 'dashboard' },
      { routeId: 'reports' },
      { routeId: 'approvals' },
      { routeId: 'settings' },
    ],
    quickActions: [
      { id: 'generate-reports', label: 'Generate Reports', description: 'Review delivery and cost status.', path: '/reports' },
      { id: 'review-budget', label: 'Review Budget', description: 'Check variance and wrap cost posture.', path: '/reports' },
      { id: 'export-documents', label: 'Export Documents', description: 'Download project exports and summaries.', path: '/reports' },
    ],
    reportSections: [
      { id: 'budget-variance', title: 'Budget Variance', description: 'Compare final spend against plan.' },
      { id: 'pending-deliverables', title: 'Pending Deliverables', description: 'Remaining outputs and handoffs.' },
      { id: 'outstanding-payments', title: 'Outstanding Payments', description: 'Invoices and cost settlements.' },
      { id: 'completion-status', title: 'Completion Status', description: 'Wrap progress and close-out status.' },
    ],
  },
  completed: {
    id: 'completed',
    nav: [
      { routeId: 'dashboard' },
      { routeId: 'reports' },
      { routeId: 'settings' },
    ],
    quickActions: [
      { id: 'download-reports', label: 'Download Reports', description: 'Pull final reports and exports.', path: '/reports' },
      { id: 'archive-project', label: 'Archive Project', description: 'Review close-out and archive readiness.', path: '/projects' },
      { id: 'export-data', label: 'Export Data', description: 'Export project records for long-term storage.', path: '/reports' },
    ],
    reportSections: [
      { id: 'final-production-report', title: 'Final Production Report', description: 'Final project-wide reporting package.' },
      { id: 'final-budget', title: 'Final Budget', description: 'Final spend, variance, and close-out numbers.' },
      { id: 'department-summary', title: 'Department Summary', description: 'Department level wrap summary.' },
      { id: 'export-centre', title: 'Export Centre', description: 'Exports, downloads, and archive handoff.' },
      { id: 'archive', title: 'Archive', description: 'Read-only project records and historical activity.' },
    ],
  },
}

function itemForRoute(routeId: WorkflowModuleId) {
  return APP_NAV_ITEMS.find(item => item.routeId === routeId) ?? null
}

export function getWorkflowPhaseConfig(phase: ProjectPhase | null | undefined) {
  return PHASE_CONFIG[phase ?? 'planning'] ?? PHASE_CONFIG.planning
}

export function useProjectWorkflow() {
  const user = useAuthStore(state => state.user)
  const { activeProject } = useResolvedProjectContext()
  const location = useLocation()
  const phase = activeProject?.projectPhase ?? 'planning'
  const config = getWorkflowPhaseConfig(phase)

  const visibleNavItems = useMemo(() => {
    if (!user) return []

    return config.nav
      .map(entry => {
        const item = itemForRoute(entry.routeId)
        if (!item || !canAccessRoute(user, entry.routeId)) return null
        return { ...item, label: entry.label ?? item.label }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [config.nav, user])

  const visibleRouteIds = new Set(visibleNavItems.map(item => item.routeId))
  const currentNavItem = APP_NAV_ITEMS.find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) ?? null
  const isCurrentRouteHiddenByPhase = Boolean(currentNavItem && !visibleRouteIds.has(currentNavItem.routeId))

  return {
    phase,
    config,
    visibleNavItems,
    quickActions: config.quickActions,
    reportSections: config.reportSections,
    currentNavItem,
    isCurrentRouteHiddenByPhase,
  }
}
