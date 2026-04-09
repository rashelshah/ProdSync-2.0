import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/system/SystemStates'
import { Surface } from '@/components/shared/Surface'
import { useProject } from '@/context/ProjectContext'
import { invalidateProjectData } from '@/context/project-sync'
import { useAuthStore } from '@/features/auth/auth.store'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { projectsService } from '@/services/projects.service'
import { cn, formatCurrency } from '@/utils'
import type { BudgetAllocationDepartment, ProjectBudgetAllocation, ProjectCurrency, ProjectDepartment, ProjectStage } from '@/types'

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
const ALLOCATION_DEPARTMENTS: { id: BudgetAllocationDepartment; label: string }[] = [
  { id: 'transport', label: 'Transport' },
  { id: 'crew', label: 'Crew & Wages' },
  { id: 'camera', label: 'Camera' },
  { id: 'art', label: 'Art' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'post', label: 'Post' },
  { id: 'production', label: 'Production' },
]

interface AllocationRowState {
  department: BudgetAllocationDepartment
  allocatedAmount: string
  allocatedPercentage: string
}

function mapAllocationState(row: ProjectBudgetAllocation): AllocationRowState {
  return {
    department: row.department,
    allocatedAmount: row.allocatedAmount ? String(row.allocatedAmount) : '',
    allocatedPercentage: row.allocatedPercentage ? String(row.allocatedPercentage) : '',
  }
}

export function SettingsView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { project: activeProject, activeProjectId, projectProgress } = useProject()
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
  const [allocationRows, setAllocationRows] = useState<AllocationRowState[]>([])

  const canEditProject = user?.role === 'EP'
  const budgetValue = Math.max(Number(budget) || 0, 0)

  const budgetAllocationsQ = useQuery({
    queryKey: ['budget-allocations', activeProjectId],
    queryFn: () => projectsService.getBudgetAllocations(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 30_000,
  })

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

  useEffect(() => {
    if (!budgetAllocationsQ.data) {
      return
    }

    setAllocationRows(ALLOCATION_DEPARTMENTS.map(({ id }) =>
      mapAllocationState(
        budgetAllocationsQ.data?.find(row => row.department === id) ?? {
          id: `${activeProjectId}-${id}`,
          projectId: activeProjectId ?? '',
          department: id,
          allocatedAmount: 0,
          allocatedPercentage: 0,
          createdAt: new Date(0).toISOString(),
        },
      ),
    ))
  }, [activeProjectId, budgetAllocationsQ.data])

  const updateProjectMutation = useMutation({
    mutationFn: projectsService.updateProject,
    onSuccess: async (project) => {
      await invalidateProjectData(queryClient, {
        projectId: project?.id ?? activeProjectId,
        userId: user?.id,
      })
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
      await projectsService.saveBudgetAllocations(
        activeProjectId,
        allocationRows.map(row => ({
          department: row.department,
          allocatedAmount: Number(row.allocatedAmount) || 0,
          allocatedPercentage: Number(row.allocatedPercentage) || 0,
        })),
      )
      await invalidateProjectData(queryClient, {
        projectId: activeProjectId,
        userId: user?.id,
      })
      showSuccess('Project settings updated.', { id: 'project-settings-save' })
    } catch (error) {
      showError(resolveErrorMessage(error, 'Unable to save project settings.'), { id: 'project-settings-save' })
    }
  }

  function updateAllocationAmount(department: BudgetAllocationDepartment, value: string) {
    setAllocationRows(current => current.map(row => {
      if (row.department !== department) {
        return row
      }

      const amount = Math.max(Number(value) || 0, 0)
      const percentage = budgetValue > 0 ? Number(((amount / budgetValue) * 100).toFixed(2)) : 0

      return {
        ...row,
        allocatedAmount: value,
        allocatedPercentage: amount > 0 || value === '0' ? String(percentage) : '',
      }
    }))
  }

  function updateAllocationPercentage(department: BudgetAllocationDepartment, value: string) {
    setAllocationRows(current => current.map(row => {
      if (row.department !== department) {
        return row
      }

      const percentage = Math.max(Number(value) || 0, 0)
      const amount = budgetValue > 0 ? Number(((percentage / 100) * budgetValue).toFixed(2)) : 0

      return {
        ...row,
        allocatedPercentage: value,
        allocatedAmount: percentage > 0 || value === '0' ? String(amount) : '',
      }
    }))
  }

  const allocationTotalAmount = allocationRows.reduce((sum, row) => sum + (Number(row.allocatedAmount) || 0), 0)
  const allocationTotalPercentage = allocationRows.reduce((sum, row) => sum + (Number(row.allocatedPercentage) || 0), 0)
  const allocationRemaining = Math.max(budgetValue - allocationTotalAmount, 0)

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
              <input value={crewCount} onChange={event => setCrewCount(event.target.value)} className="project-modal-input" disabled />
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
                  className={cn('project-department-chip', enabledDepartments.includes(department.id) && 'is-selected', !canEditProject && 'cursor-not-allowed opacity-70')}
                >
                  {department.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4">
              <p className="section-title">Budget Allocation</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Distribute the project budget across modules. Enter either amount or percentage and the other field auto-calculates.
              </p>
            </div>

            <div className="grid gap-3">
              {ALLOCATION_DEPARTMENTS.map(item => {
                const row = allocationRows.find(entry => entry.department === item.id) ?? {
                  department: item.id,
                  allocatedAmount: '',
                  allocatedPercentage: '',
                }

                return (
                  <div key={item.id} className="grid gap-3 rounded-[18px] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60 md:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{item.label}</span>
                    </div>
                    <Field label="Amount" className="gap-2">
                      <input
                        value={row.allocatedAmount}
                        onChange={event => updateAllocationAmount(item.id, event.target.value)}
                        className="project-modal-input"
                        disabled={!canEditProject}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Percentage" className="gap-2">
                      <input
                        value={row.allocatedPercentage}
                        onChange={event => updateAllocationPercentage(item.id, event.target.value)}
                        className="project-modal-input"
                        disabled={!canEditProject}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryRow label="Allocated" value={formatCurrency(allocationTotalAmount, currency)} />
              <SummaryRow label="Remaining" value={formatCurrency(allocationRemaining, currency)} />
              <SummaryRow label="Percentage" value={`${allocationTotalPercentage.toFixed(2)}%`} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={saveProjectSettings}
              className="btn-primary"
              disabled={!canEditProject || updateProjectMutation.isPending || allocationTotalAmount > budgetValue + 0.01 || allocationTotalPercentage > 100.01}
            >
              {updateProjectMutation.isPending ? 'Saving...' : 'Save Project Settings'}
            </button>
            {allocationTotalAmount > budgetValue + 0.01 && (
              <p className="self-center text-sm text-red-500 dark:text-red-400">Allocation total exceeds the project budget.</p>
            )}
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
              <SummaryRow label="Spent" value={formatCurrency(projectProgress?.spent ?? activeProject.spentAmount ?? 0, currency)} />
              <SummaryRow label="Progress" value={`${projectProgress?.progress ?? activeProject.progressPercent ?? 0}%`} />
              <SummaryRow label="Allocated" value={formatCurrency(allocationTotalAmount, currency)} />
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
