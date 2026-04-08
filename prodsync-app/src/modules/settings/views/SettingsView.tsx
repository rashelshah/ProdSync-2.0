import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/system/SystemStates'
import { Surface } from '@/components/shared/Surface'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { projectsService } from '@/services/projects.service'
import { cn, formatCurrency } from '@/utils'
import type { ProjectCurrency, ProjectDepartment, ProjectStage } from '@/types'

const PROJECT_STATUSES: ProjectStage[] = ['pre-production', 'shooting', 'post']
const PROJECT_CURRENCIES: ProjectCurrency[] = ['INR', 'USD', 'EUR']
const DEPARTMENTS: { id: ProjectDepartment; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'art', label: 'Art' },
  { id: 'transport', label: 'Transport' },
  { id: 'production', label: 'Production' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'post', label: 'Post' },
]

export function SettingsView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const setActiveProject = useProjectsStore(state => state.setActiveProject)
  const { activeProject, activeProjectId } = useResolvedProjectContext()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<ProjectStage>('pre-production')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState<ProjectCurrency>('INR')
  const [crewCount, setCrewCount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [otRulesLabel, setOtRulesLabel] = useState('')
  const [enabledDepartments, setEnabledDepartments] = useState<ProjectDepartment[]>([])

  const canEditProject = user?.role === 'EP'

  useEffect(() => {
    if (!activeProject) {
      return
    }

    setName(activeProject.name)
    setLocation(activeProject.location)
    setStatus(activeProject.status)
    setBudget(String(activeProject.budgetUSD ?? 0))
    setCurrency(activeProject.currency)
    setCrewCount(String(activeProject.activeCrew ?? 0))
    setStartDate(activeProject.startDate ?? '')
    setEndDate(activeProject.endDate ?? '')
    setOtRulesLabel(activeProject.otRulesLabel ?? '')
    setEnabledDepartments(activeProject.enabledDepartments ?? [])
  }, [activeProject])

  const updateProjectMutation = useMutation({
    mutationFn: projectsService.updateProject,
    onSuccess: async (project) => {
      if (project) {
        setActiveProject(project.id, project.currency)
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accessible-projects', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['discoverable-projects'] }),
      ])
    },
  })

  function toggleDepartment(department: ProjectDepartment) {
    setEnabledDepartments(current =>
      current.includes(department) ? current.filter(item => item !== department) : [...current, department],
    )
  }

  async function saveProjectSettings() {
    if (!activeProjectId || !activeProject) {
      return
    }

    if (!name.trim()) {
      showError('Project name is required.', { id: 'project-settings-save' })
      return
    }

    showLoading('Saving project settings...', { id: 'project-settings-save' })

    try {
      await updateProjectMutation.mutateAsync({
        projectId: activeProjectId,
        name: name.trim(),
        location: location.trim(),
        status,
        budgetUSD: Number(budget) || 0,
        currency,
        activeCrew: Number(crewCount) || 0,
        startDate,
        endDate,
        enabledDepartments,
        otRulesLabel: otRulesLabel.trim(),
      })
      showSuccess('Project settings updated.', { id: 'project-settings-save' })
    } catch (error) {
      showError(resolveErrorMessage(error, 'Unable to save project settings.'), { id: 'project-settings-save' })
    }
  }

  if (!activeProject) {
    return (
      <div className="page-shell page-shell-narrow">
        <Surface variant="table" padding="lg">
          <EmptyState icon="settings" title="No active project selected" description="Choose a project in the Projects Hub before editing project settings." />
        </Surface>
      </div>
    )
  }

  return (
    <div className="page-shell page-shell-narrow space-y-6">
      <header>
        <span className="page-kicker">Project Configuration</span>
        <h1 className="page-title page-title-compact">Settings</h1>
        <p className="page-subtitle">Currency, schedules, and project controls are now driven from the active project instead of placeholder settings cards.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Surface variant="table" padding="lg">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Project Settings</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Only the Executive Producer can edit project details and currency.</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${canEditProject ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 dark:bg-white/8 dark:text-zinc-300'}`}>
              {canEditProject ? 'EP Control' : 'Read Only'}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Project Name">
              <input value={name} onChange={event => setName(event.target.value)} className="project-modal-input" disabled={!canEditProject} />
            </Field>
            <Field label="Location">
              <input value={location} onChange={event => setLocation(event.target.value)} className="project-modal-input" disabled={!canEditProject} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={event => setStatus(event.target.value as ProjectStage)} className="project-modal-select" disabled={!canEditProject}>
                {PROJECT_STATUSES.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={event => setCurrency(event.target.value as ProjectCurrency)} className="project-modal-select" disabled={!canEditProject}>
                {PROJECT_CURRENCIES.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Budget">
              <input value={budget} onChange={event => setBudget(event.target.value)} className="project-modal-input" disabled={!canEditProject} />
            </Field>
            <Field label="Active Crew">
              <input value={crewCount} onChange={event => setCrewCount(event.target.value)} className="project-modal-input" disabled={!canEditProject} />
            </Field>
            <Field label="Start Date">
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="project-modal-select" disabled={!canEditProject} />
            </Field>
            <Field label="End Date">
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="project-modal-select" disabled={!canEditProject} />
            </Field>
          </div>

          <Field label="OT Rules / FEFSI Settings" className="mt-4">
            <input value={otRulesLabel} onChange={event => setOtRulesLabel(event.target.value)} className="project-modal-input" disabled={!canEditProject} />
          </Field>

          <div className="mt-4 space-y-2">
            <p className="auth-field-label">Enabled Departments</p>
            <div className="flex flex-wrap gap-3">
              {DEPARTMENTS.map(department => (
                <button
                  key={department.id}
                  type="button"
                  onClick={() => toggleDepartment(department.id)}
                  disabled={!canEditProject}
                  className={cn('clay-chip', enabledDepartments.includes(department.id) && 'is-selected', !canEditProject && 'cursor-not-allowed opacity-70')}
                >
                  {department.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={saveProjectSettings} className="btn-primary" disabled={!canEditProject || updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? 'Saving...' : 'Save Project Settings'}
            </button>
            {!canEditProject && (
              <p className="self-center text-sm text-zinc-500 dark:text-zinc-400">Line Producers can review settings here, but edits stay locked to the EP.</p>
            )}
          </div>
        </Surface>

        <div className="space-y-6">
          <Surface variant="table" padding="lg">
            <p className="section-title">Current Financial Context</p>
            <div className="mt-5 space-y-4">
              <SummaryRow label="Project" value={activeProject.name} />
              <SummaryRow label="Currency" value={currency} />
              <SummaryRow label="Budget" value={formatCurrency(Number(budget) || 0, currency)} />
              <SummaryRow label="Crew" value={`${Number(crewCount) || 0}`} />
              <SummaryRow label="Departments" value={`${enabledDepartments.length}`} />
            </div>
          </Surface>

          <Surface variant="table" padding="lg">
            <p className="section-title">Access Reminder</p>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Crew currency formatting now follows the active project setting. Once the EP changes currency here, active-project dashboards and financial cards will render with the updated symbol.
            </p>
          </Surface>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('auth-field', className)}>
      <span className="auth-field-label">{label}</span>
      {children}
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-white">{value}</p>
    </div>
  )
}
