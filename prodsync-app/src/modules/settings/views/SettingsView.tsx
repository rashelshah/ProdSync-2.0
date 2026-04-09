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
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [showAllDepartments, setShowAllDepartments] = useState(false)
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
    <>
    {/* DESKTOP UI */}
    <div className="hidden xl:block page-shell page-shell-narrow space-y-6">
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

    {/* MOBILE UI */}
    <div className="md:hidden mt-2 px-1 pb-[140px] min-h-screen">
      {/* Header */}
      <header className="px-3 mb-6">
        <div className="flex items-center justify-between overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <div>
            <span className="page-kicker text-orange-500">Project Configuration</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white tracking-tight leading-none">Settings <span className="ml-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest align-middle">EP Control</span></h1>
          </div>

        </div>
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 px-3 pt-6 pb-[240px]">
        <section className="space-y-4 px-1 pb-2">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 dark:text-zinc-300 uppercase">PROJECT FOUNDATIONS</h2>
          
          <div className="space-y-4">
             <div className="space-y-1.5">
               <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Project Name</label>
               <input value={name} onChange={event => setName(event.target.value)} disabled={!canEditProject} className="w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/5 rounded-xl p-3.5 text-sm focus:ring-1 focus:ring-orange-500 shadow-sm" />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                 <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Location</label>
                 <input value={location} onChange={event => setLocation(event.target.value)} disabled={!canEditProject} className="w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/5 rounded-xl p-3.5 text-sm focus:ring-1 focus:ring-orange-500 shadow-sm" />
               </div>
               <div className="space-y-1.5 relative">
                 <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Status</label>
                 <select value={status} onChange={event => setStatus(event.target.value as ProjectStage)} disabled={!canEditProject} className="w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/5 rounded-xl p-3.5 text-sm focus:ring-1 focus:ring-orange-500 appearance-none shadow-sm capitalize">
                   {PROJECT_STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
                 </select>
                 <span className="material-symbols-outlined absolute right-3 bottom-3 text-[18px] text-zinc-500 pointer-events-none">expand_more</span>
               </div>
             </div>

             <div className="pt-5 pb-1 space-y-1.5">
               <div className="flex items-center justify-between">
                 <label className="text-[8px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase ml-1">Total Budget</label>
                 <button onClick={() => setIsEditingBudget(!isEditingBudget)} className="text-[9px] text-orange-500 font-bold tracking-widest uppercase">{isEditingBudget ? 'DONE' : 'EDIT'}</button>
               </div>
               <div className="flex items-center">
                 {isEditingBudget ? (
                   <div className="relative w-full">
                     <span className="absolute left-0 top-1 text-xl font-bold text-zinc-400">₹</span>
                     <input type="number" value={budget} onChange={e => setBudget(e.target.value)} disabled={!canEditProject} className="text-xl font-bold font-headline tracking-tight text-zinc-900 dark:text-white leading-none bg-transparent border-b border-orange-500 outline-none w-full pl-6 pb-1" autoFocus />
                   </div>
                 ) : (
                   <div className="text-xl font-bold font-headline tracking-tight text-zinc-900 dark:text-white leading-none">{formatCurrency(budgetValue)}</div>
                 )}
               </div>
             </div>

             <div className="grid grid-cols-2 gap-3 py-2">
               <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[16px] p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
                 <span className="material-symbols-outlined text-[18px] text-orange-500">groups</span>
                 <div>
                   <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.15em]">Active Crew</div>
                   <div className="text-[13px] font-bold text-zinc-900 dark:text-white mt-0.5">{crewCount} members</div>
                 </div>
               </div>
               <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[16px] p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                 <span className="material-symbols-outlined text-[18px] text-orange-500">update</span>
                 <div className="min-w-0 flex-1">
                   <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.15em]">OT Rules</div>
                   <div className="text-[13px] font-bold text-zinc-900 dark:text-white mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={otRulesLabel || 'Standard (1.5x)'}>{otRulesLabel || 'Standard (1.5x)'}</div>
                 </div>
               </div>
             </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-300">ACTIVE DEPARTMENTS</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar snap-x">
             {DEPARTMENTS.map(dept => (
               <button
                 key={dept.id}
                 onClick={() => toggleDepartment(dept.id)}
                 disabled={!canEditProject}
                 className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border text-xs font-bold whitespace-nowrap transition-colors snap-start flex-shrink-0 ${enabledDepartments.includes(dept.id) ? 'bg-[#3B1F0F]/20 dark:bg-[#3B1F0F] text-orange-500 border-orange-500/30' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-white/5'} ${!canEditProject && 'opacity-70'}`}
               >
                 {dept.label} {enabledDepartments.includes(dept.id) && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
               </button>
             ))}
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.15em]">Progress</span>
              <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{projectProgress?.progress ?? activeProject?.progressPercent ?? 0}%</div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.15em]">Spent</span>
              <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: String(projectProgress?.spent ?? 0).length > 8 ? '1.5rem' : '2rem' }}>{formatCurrency(projectProgress?.spent ?? activeProject?.spentAmount ?? 0)}</div>
            </div>
            <div className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.15em]">Allocated</span>
              <div className="text-4xl font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: '2rem' }}>{formatCurrency(allocationTotalAmount)}</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-300">DEPARTMENTAL ALLOCATION</h2>
            <button onClick={() => setShowAllDepartments(!showAllDepartments)} className="text-[8px] text-orange-500 font-bold tracking-widest uppercase">MANAGE</button>
          </div>
          <div className="space-y-3">
               {ALLOCATION_DEPARTMENTS.slice(0, showAllDepartments ? undefined : 3).map(item => {
                   const row = allocationRows.find(entry => entry.department === item.id) ?? {
                        department: item.id,
                        allocatedAmount: '',
                        allocatedPercentage: '',
                   }
                   return (
                     <div key={item.id} className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-white/5 flex gap-4 items-center shadow-sm">
                       <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="material-symbols-outlined text-orange-500 text-[20px]">
                            {item.id === 'transport' ? 'local_shipping' : item.id === 'crew' ? 'groups' : item.id === 'camera' ? 'videocam' : item.id === 'wardrobe' ? 'styler' : item.id === 'post' ? 'movie_edit' : item.id === 'production' ? 'corporate_fare' : 'category'}
                          </span>
                       </div>
                       <div className="flex-1 space-y-2">
                         <div className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{item.label}</div>
                         <div className="flex gap-2">
                           <div className="relative flex-1">
                             <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-medium">₹</span>
                             <input value={row.allocatedAmount} onChange={event => updateAllocationAmount(item.id, event.target.value)} disabled={!canEditProject} className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/5 rounded-lg pl-7 p-2.5 text-xs focus:ring-1 focus:ring-orange-500 shadow-sm" placeholder="Amount" />
                           </div>
                           <div className="relative w-[76px]">
                             <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-medium">%</span>
                             <input value={row.allocatedPercentage} onChange={event => updateAllocationPercentage(item.id, event.target.value)} disabled={!canEditProject} className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/5 rounded-lg pl-7 p-2.5 text-xs focus:ring-1 focus:ring-orange-500 shadow-sm" placeholder="" />
                           </div>
                         </div>
                       </div>
                     </div>
                   )
               })}
               {ALLOCATION_DEPARTMENTS.length > 3 && (
                 <button onClick={() => setShowAllDepartments(!showAllDepartments)} className="w-full py-3 text-[9px] font-bold tracking-[0.2em] text-zinc-400 uppercase text-center flex items-center justify-center gap-1 active:text-zinc-600 dark:active:text-zinc-300">
                   {showAllDepartments ? "SHOW LESS" : `SHOW ${ALLOCATION_DEPARTMENTS.length - 3} MORE DEPARTMENTS`}
                   <span className="material-symbols-outlined text-[14px]">{showAllDepartments ? "expand_less" : "expand_more"}</span>
                 </button>
               )}
          </div>

          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-[16px] p-4 grid grid-cols-2 shadow-sm">
             <div>
               <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Allocated</div>
               <div className="text-[15px] font-bold text-zinc-900 dark:text-white mt-1.5 tracking-tight font-headline">{formatCurrency(allocationTotalAmount)}</div>
             </div>
             <div className="text-right">
               <div className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Remaining</div>
               <div className="text-[15px] font-bold text-orange-500 mt-1.5 tracking-tight font-headline">{formatCurrency(allocationRemaining)}</div>
             </div>
          </div>
        </section>

        <div className="bg-[#FFF4ED] dark:bg-zinc-900 border border-orange-500/30 rounded-[20px] p-4 flex gap-4 mt-8 shadow-sm">
          <span className="material-symbols-outlined text-orange-500 text-[20px] mt-0.5">shield</span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pr-2">
            <strong className="text-zinc-900 dark:text-white block mb-1">EP Level Access:</strong> These settings control global project defaults. Changes will propagate to all department heads and affect financial calculations immediately.
          </p>
        </div>

        <button
          onClick={saveProjectSettings}
          className="w-full bg-orange-500 text-white font-bold text-sm tracking-widest uppercase py-3.5 rounded-[16px] disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"
          disabled={!canEditProject || updateProjectMutation.isPending || allocationTotalAmount > budgetValue + 0.01 || allocationTotalPercentage > 100.01}
        >
          {updateProjectMutation.isPending ? 'Saving...' : 'Save Project Settings'}
        </button>
        {allocationTotalAmount > budgetValue + 0.01 && (
          <p className="text-center text-xs text-red-500">Allocation exceeds budget.</p>
        )}
      </div>
    </div>

    </>
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
