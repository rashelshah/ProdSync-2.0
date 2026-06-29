import { useQuery } from '@tanstack/react-query'
import { Surface } from '@/components/shared/Surface'
import { PageLoader } from '@/components/system/SystemStates'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { formatProjectPhase, useProjectWorkflow } from '@/features/workflow/projectWorkflow'
import { locationsService } from '@/services/locations.service'
import { formatCurrency } from '@/utils'
import { ReportsDashboard } from '../components/ReportsDashboard'

export function ReportsView() {
  const { activeProjectId, activeProject } = useResolvedProjectContext()
  const { phase, reportSections } = useProjectWorkflow()
  const showLocationReports = phase === 'pre_production' || phase === 'production'
  const locationsReportsQ = useQuery({
    queryKey: ['locations-reports', activeProjectId],
    queryFn: () => locationsService.getReports(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 30_000,
  })

  if (locationsReportsQ.isLoading && activeProjectId) {
    return <PageLoader open message="Loading reports..." />
  }

  return (
    <div className="space-y-6">
      <Surface variant="raised" padding="lg">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{formatProjectPhase(phase)} Reports</p>
            <h2 className="section-title">Relevant Report Sections</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportSections.map(section => (
            <div key={section.id} className="rounded-[22px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{section.title}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{section.description}</p>
            </div>
          ))}
        </div>
      </Surface>
      <ReportsDashboard />
      {showLocationReports && locationsReportsQ.data && (
        <Surface variant="table" padding="lg">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Locations Reports</p>
              <h2 className="section-title">Compliance, Readiness, and Upload Activity</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Permission Compliance</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">
                {locationsReportsQ.data.permissionCompliance.approved}/{locationsReportsQ.data.permissionCompliance.total}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {locationsReportsQ.data.permissionCompliance.expired} expired • {locationsReportsQ.data.permissionCompliance.submitted} submitted
              </p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Location Spend</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(locationsReportsQ.data.locationSpend.total, activeProject?.currency ?? 'INR')}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{locationsReportsQ.data.locationSpend.pendingApprovalCount} approvals pending</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Readiness Status</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                Ready {locationsReportsQ.data.readinessStatus.ready} • Almost {locationsReportsQ.data.readinessStatus.almostReady} • Not Ready {locationsReportsQ.data.readinessStatus.notReady}
              </p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Upload Activity</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                {locationsReportsQ.data.uploadActivity.mediaCount} media • {locationsReportsQ.data.uploadActivity.documentCount} documents
              </p>
            </div>
          </div>
        </Surface>
      )}
    </div>
  )
}
