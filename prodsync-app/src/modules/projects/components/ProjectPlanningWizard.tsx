import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CircleHelp, GripVertical } from 'lucide-react'
import { Surface } from '@/components/shared/Surface'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { showError, showSuccess } from '@/lib/toast'
import { projectsService } from '@/services/projects.service'
import { cn, formatCurrency } from '@/utils'
import type { PlanningSectionType, ProjectCurrency, ProjectPhase, ProjectPlanningSection } from '@/types'

type CrewRow = { id: string; department: string; estimatedCrew: number; estimatedDailyWage: number; estimatedDays: number }
type CastRow = { id: string; category: string; estimatedCount: number; estimatedRate: number; estimatedDays: number }
type ExpenseRow = { id: string; category: string; estimatedBudget: number; contingencyPercent: number; notes: string }
type PlanningAction = 'save-draft' | 'save-continue' | null
type ExpenseReorderHandler = (nextRows: ExpenseRow[], previousRows: ExpenseRow[]) => void | Promise<void>

const steps: Array<{ id: PlanningSectionType; title: string; help: string }> = [
  { id: 'project_information', title: 'Project Information', help: 'Add only what you know today. Everything except the project name can be completed later.' },
  { id: 'crew_planning', title: 'Crew Planning', help: 'Estimate department manpower and wage costs. Exact crew names can be added later in Crew & Wages.' },
  { id: 'cast_planning', title: 'Cast Planning', help: 'Estimate casting costs without creating operational actor records yet.' },
  { id: 'expense_planning', title: 'Expense Planning', help: 'Create a first budget draft by estimating broad expense categories. This is planning, not accounting.' },
  { id: 'budget_review', title: 'Budget Review', help: 'Review the current estimate. Actual costs will replace estimates as production progresses.' },
]

const phaseOptions: Array<{ value: ProjectPhase; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'pre_production', label: 'Pre Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post Production' },
  { value: 'completed', label: 'Completed' },
]

const defaultCrewDepartments = ['Camera', 'Art', 'Direction', 'Production', 'Transport', 'Food', 'Makeup', 'Costume', 'Editing', 'Sound', 'Lighting', 'VFX']
const defaultCastCategories = ['Lead Actors', 'Supporting Actors', 'Junior Artists', 'Child Artists', 'Special Performers']
const defaultExpenseCategories = ['Crew & Wages', 'Cast', 'Transport', 'Accommodation', 'Food & Beverages', 'Camera & Equipment', 'Art Department', 'Costume', 'Makeup', 'Permissions', 'Locations', 'Post Production', 'Miscellaneous']

const numberValue = (value: unknown) => Number(value ?? 0) || 0
const rowTotal = (row: CrewRow | CastRow) => numberValue('estimatedCrew' in row ? row.estimatedCrew : row.estimatedCount) * numberValue('estimatedDailyWage' in row ? row.estimatedDailyWage : row.estimatedRate) * numberValue(row.estimatedDays)
const expenseTotal = (row: ExpenseRow) => numberValue(row.estimatedBudget) * (1 + numberValue(row.contingencyPercent) / 100)

function newCrewRow(department = 'Department'): CrewRow {
  return { id: crypto.randomUUID(), department, estimatedCrew: 0, estimatedDailyWage: 0, estimatedDays: 0 }
}
function newCastRow(category = 'Category'): CastRow {
  return { id: crypto.randomUUID(), category, estimatedCount: 0, estimatedRate: 0, estimatedDays: 0 }
}
function newExpenseRow(category = 'Category'): ExpenseRow {
  return { id: crypto.randomUUID(), category, estimatedBudget: 0, contingencyPercent: 0, notes: '' }
}

function sortRowsByProjectedOrder<T extends { id: string }>(rows: T[], activeId: string, overId: string) {
  const oldIndex = rows.findIndex(row => row.id === activeId)
  const newIndex = rows.findIndex(row => row.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return rows
  }
  return arrayMove(rows, oldIndex, newIndex)
}

export function ProjectPlanningWizard() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const [activeAction, setActiveAction] = useState<PlanningAction>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = steps[stepIndex]
  const lastSavedSignatureRef = useRef('')
  const pendingSaveSignatureRef = useRef('')

  const planningQ = useQuery({
    queryKey: ['project-planning', projectId],
    queryFn: () => projectsService.getProjectPlanning(projectId),
    enabled: Boolean(projectId),
    staleTime: 15_000,
  })

  const planning = planningQ.data
  const section = planning?.sections.find(item => item.sectionType === currentStep.id)

  const saveMutation = useMutation({
    mutationFn: (input: { sectionType: PlanningSectionType; payload: Record<string, unknown>; isCompleted?: boolean; isSkipped?: boolean }) =>
      projectsService.savePlanningSection(projectId, input),
    onSuccess: async result => {
      queryClient.setQueryData(['project-planning', projectId], result)
      queryClient.setQueryData(['project', projectId], result.project)

      if (user?.id) {
        queryClient.setQueryData(['accessible-projects', user.id], (current: unknown) => {
          if (!current || typeof current !== 'object') {
            return current
          }

          const snapshot = current as { projects?: Array<{ id: string }>; projectMembers?: unknown[] }
          return {
            ...snapshot,
            projects: (snapshot.projects ?? []).map(project => project.id === result.project.id ? result.project : project),
          }
        })
      }

      if (currentStep.id === 'project_information') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reports-summary', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['reports-burn-chart', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['reports-departments', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['budget-allocations', projectId] }),
        ])
      }

      lastSavedSignatureRef.current = pendingSaveSignatureRef.current

      if (planning?.project.projectPhase === 'planning' && result.project.projectPhase === 'pre_production') {
        showSuccess('Project Planning completed. Project has moved to Pre-Production.')
        navigate('/projects')
      }
    },
    onError: () => {
      pendingSaveSignatureRef.current = ''
    },
  })

  const infoDefaults = useMemo(() => ({
    name: planning?.project.name ?? '',
    projectType: planning?.project.projectType ?? '',
    productionHouse: planning?.project.productionHouse ?? '',
    client: planning?.project.client ?? '',
    director: planning?.project.director ?? '',
    startDate: planning?.project.startDate ?? '',
    endDate: planning?.project.endDate ?? '',
    language: planning?.project.language ?? '',
    location: planning?.project.location === 'Location pending' ? '' : planning?.project.location ?? '',
    description: planning?.project.description ?? '',
    projectPhase: planning?.project.projectPhase ?? 'planning',
    budgetUSD: planning?.project.budgetUSD ?? 0,
    currency: planning?.project.currency ?? 'INR',
  }), [planning?.project])

  const [info, setInfo] = useState<Record<string, string | number>>(infoDefaults)
  const [crewRows, setCrewRows] = useState<CrewRow[]>([])
  const [castRows, setCastRows] = useState<CastRow[]>([])
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([])

  const hydratedProjectIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!planning) return
    if (hydratedProjectIdRef.current === planning.project.id) return
    hydratedProjectIdRef.current = planning.project.id
    setInfo(infoDefaults)
    setCrewRows(readRows<CrewRow>(planning.sections, 'crew_planning', 'departments', defaultCrewDepartments.map(newCrewRow)))
    setCastRows(readRows<CastRow>(planning.sections, 'cast_planning', 'categories', defaultCastCategories.map(newCastRow)))
    setExpenseRows(readRows<ExpenseRow>(planning.sections, 'expense_planning', 'categories', defaultExpenseCategories.map(newExpenseRow)))
    lastSavedSignatureRef.current = ''
    pendingSaveSignatureRef.current = ''
  }, [infoDefaults, planning, planning?.project.id])

  const currentSignature = useMemo(() => JSON.stringify({
    step: currentStep.id,
    info,
    crewRows,
    castRows,
    expenseRows,
    completed: Boolean(section?.isCompleted),
    skipped: Boolean(section?.isSkipped),
  }), [castRows, crewRows, currentStep.id, expenseRows, info, section?.isCompleted, section?.isSkipped])

  useEffect(() => {
    if (!planning || activeAction) return
    if (!lastSavedSignatureRef.current && !pendingSaveSignatureRef.current) {
      lastSavedSignatureRef.current = currentSignature
      return
    }
    if (currentSignature === lastSavedSignatureRef.current || currentSignature === pendingSaveSignatureRef.current) return
    const timer = window.setTimeout(() => {
      pendingSaveSignatureRef.current = currentSignature
      const payload = getPayload()
      void saveMutation.mutateAsync({ sectionType: currentStep.id, payload, isCompleted: Boolean(section?.isCompleted), isSkipped: Boolean(section?.isSkipped) }).catch(() => undefined)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [activeAction, currentSignature, currentStep.id, planning, section?.isCompleted, section?.isSkipped])

  if (planningQ.isLoading) return <PageLoader open message="Loading project planning..." />
  if (planningQ.isError || !planning || !currentStep) return <ErrorState message="Project planning could not be loaded." />

  const crewCost = crewRows.reduce((sum, row) => sum + rowTotal(row), 0)
  const castCost = castRows.reduce((sum, row) => sum + rowTotal(row), 0)
  const expenseCost = expenseRows.reduce((sum, row) => sum + expenseTotal(row), 0)
  const crewCount = crewRows.reduce((sum, row) => sum + numberValue(row.estimatedCrew), 0)
  const castCount = castRows.reduce((sum, row) => sum + numberValue(row.estimatedCount), 0)
  const grandTotal = crewCost + castCost + expenseCost
  const currency = (info.currency || planning.project.currency) as ProjectCurrency

  function readRows<T>(sections: ProjectPlanningSection[], sectionType: PlanningSectionType, key: string, fallback: T[]) {
    const rows = sections.find(item => item.sectionType === sectionType)?.payload?.[key]
    return Array.isArray(rows) && rows.length > 0 ? rows as T[] : fallback
  }

  function getPayload(): Record<string, unknown> {
    if (currentStep.id === 'project_information') return info
    if (currentStep.id === 'crew_planning') return { departments: crewRows, estimatedCrew: crewCount, estimatedCost: crewCost }
    if (currentStep.id === 'cast_planning') return { categories: castRows, estimatedCast: castCount, estimatedCost: castCost }
    if (currentStep.id === 'expense_planning') return { categories: expenseRows, estimatedCost: expenseCost }
    return { crewCost, castCost, expenseCost, crewCount, castCount, departmentCount: crewRows.length, grandTotal }
  }

  async function saveStep(options: { completed?: boolean; skipped?: boolean; advance?: boolean; finish?: boolean }) {
    if (currentStep.id === 'project_information' && !String(info.name ?? '').trim()) {
      showError('Project name is the only required field.')
      return
    }
    pendingSaveSignatureRef.current = currentSignature
    try {
      const result = await saveMutation.mutateAsync({
        sectionType: currentStep.id,
        payload: getPayload(),
        isCompleted: options.completed ?? false,
        isSkipped: options.skipped ?? false,
      })
      if (result.project.projectPhase !== 'pre_production' && options.finish) {
        showSuccess('Project planning saved.')
        navigate('/projects')
      } else if (result.project.projectPhase !== 'pre_production' && options.advance) {
        setStepIndex(index => Math.min(index + 1, steps.length - 1))
      } else if (result.project.projectPhase !== 'pre_production') {
        showSuccess('Draft saved.')
      }
    } catch (error) {
      showError('Planning could not be saved right now.')
    }
  }

  async function handleExpenseReorder(nextRows: ExpenseRow[], previousRows: ExpenseRow[]) {
    if (!planning || currentStep.id !== 'expense_planning') return
    const nextSignature = JSON.stringify({
      step: currentStep.id,
      info,
      crewRows,
      castRows,
      expenseRows: nextRows,
      completed: Boolean(section?.isCompleted),
      skipped: Boolean(section?.isSkipped),
    })
    pendingSaveSignatureRef.current = nextSignature
    try {
      await saveMutation.mutateAsync({
        sectionType: 'expense_planning',
        payload: { categories: nextRows, estimatedCost: nextRows.reduce((sum, row) => sum + expenseTotal(row), 0) },
        isCompleted: Boolean(section?.isCompleted),
        isSkipped: Boolean(section?.isSkipped),
      })
      lastSavedSignatureRef.current = nextSignature
    } catch (error) {
      pendingSaveSignatureRef.current = ''
      setExpenseRows(previousRows)
      showError('Expense order could not be saved right now.')
    }
  }

  const actionBusy = activeAction !== null
  const isActionBusy = (action: Exclude<PlanningAction, null>) => activeAction === action
  const runAction = async (action: Exclude<PlanningAction, null>, handler: () => Promise<void> | void) => {
    if (activeAction) return
    setActiveAction(action)
    try {
      await handler()
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={120}>
      <div className="page-shell page-shell-narrow pb-12 max-md:pt-16">
      <header className="page-header page-header-card">
        <div>
          <span className="page-kicker">Project Planning</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title page-title-compact">{currentStep.title}</h1>
            <HelpMarker label={currentStep.title} content={currentStep.help} />
          </div>
          <p className="page-subtitle">{currentStep.help}</p>
        </div>
        <Surface variant="raised" className="min-w-[260px]" padding="md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Estimated Completion</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white">{planning.progressPercent}%</p>
          <div className="mt-3 h-2 rounded-full bg-zinc-200 dark:bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{ width: `${planning.progressPercent}%` }} /></div>
        </Surface>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => {
          const stepSection = planning.sections.find(item => item.sectionType === step.id)
          const state = index === stepIndex ? 'Current' : stepSection?.isCompleted ? 'Completed' : stepSection?.isSkipped ? 'Skipped' : 'Upcoming'
          return (
            <button key={step.id} type="button" disabled={actionBusy} onClick={() => setStepIndex(index)} className={cn('rounded-[24px] border px-4 py-4 text-left transition-all', index === stepIndex ? 'border-orange-300 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900', actionBusy && 'cursor-not-allowed opacity-75')}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Step {index + 1} · {state}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{step.title}</p>
                <HelpMarker label={step.title} content={step.help} />
              </div>
            </button>
          )
        })}
      </section>

      <Surface variant="raised" padding="lg" className="overflow-hidden">
        {currentStep.id === 'project_information' && <ProjectInfoStep info={info} setInfo={setInfo} />}
        {currentStep.id === 'crew_planning' && <CrewStep rows={crewRows} setRows={setCrewRows} currency={currency} />}
        {currentStep.id === 'cast_planning' && <CastStep rows={castRows} setRows={setCastRows} currency={currency} />}
        {currentStep.id === 'expense_planning' && <ExpenseStep rows={expenseRows} setRows={setExpenseRows} currency={currency} onReorder={handleExpenseReorder} />}
        {currentStep.id === 'budget_review' && <BudgetReview crewCost={crewCost} castCost={castCost} expenseCost={expenseCost} crewCount={crewCount} castCount={castCount} departmentCount={crewRows.length} currency={currency} />}
      </Surface>

      <section className="rounded-[30px] border border-zinc-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button type="button" className="btn-soft md:w-fit" disabled={stepIndex === 0 || actionBusy} onClick={() => setStepIndex(index => Math.max(0, index - 1))}>Back</button>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              className="btn-ghost min-w-36"
              disabled={isActionBusy('save-draft')}
              onClick={() => void runAction('save-draft', () => saveStep({ completed: false }))}
            >
              {activeAction === 'save-draft' ? <span className="ui-spinner" /> : null}
              {activeAction === 'save-draft' ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn-primary min-w-40"
              disabled={isActionBusy('save-continue')}
              onClick={() => void runAction('save-continue', () => saveStep({ completed: true, advance: stepIndex < steps.length - 1, finish: stepIndex === steps.length - 1 }))}
            >
              {activeAction === 'save-continue' ? <span className="ui-spinner" /> : null}
              {activeAction === 'save-continue' ? 'Saving...' : (stepIndex === steps.length - 1 ? 'Finish Planning' : 'Save & Continue')}
            </button>
          </div>
        </div>
      </section>
      </div>
    </Tooltip.Provider>
  )
}

function ProjectInfoStep({ info, setInfo }: { info: Record<string, string | number>; setInfo: React.Dispatch<React.SetStateAction<Record<string, string | number>>> }) {
  const update = (key: string, value: string | number) => setInfo(current => ({ ...current, [key]: value }))
  return <div className="grid gap-5"><p className="rounded-[22px] bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Only Project Name is required. Everything else can be completed later.</p><div className="grid gap-4 md:grid-cols-2"><Field label="Project Name" value={info.name} onChange={v => update('name', v)} required /><Field label="Project Type" value={info.projectType} onChange={v => update('projectType', v)} /><Field label="Production House" value={info.productionHouse} onChange={v => update('productionHouse', v)} /><Field label="Client" value={info.client} onChange={v => update('client', v)} /><Field label="Director" value={info.director} onChange={v => update('director', v)} /><Field label="Language" value={info.language} onChange={v => update('language', v)} /><Field label="Location" value={info.location} onChange={v => update('location', v)} /><label className="auth-field"><span className="auth-field-label">Project Phase</span><select className="project-modal-select" value={String(info.projectPhase)} onChange={e => update('projectPhase', e.target.value)}>{phaseOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><Field type="date" label="Start Date" value={info.startDate} onChange={v => update('startDate', v)} /><Field type="date" label="End Date" value={info.endDate} onChange={v => update('endDate', v)} /><Field type="number" label="Estimated Budget" value={info.budgetUSD} onChange={v => update('budgetUSD', Number(v) || 0)} /><label className="auth-field"><span className="auth-field-label">Currency</span><select className="project-modal-select" value={String(info.currency)} onChange={e => update('currency', e.target.value)}><option>INR</option><option>USD</option><option>EUR</option></select></label></div><label className="auth-field"><span className="auth-field-label">Description</span><textarea className="project-modal-textarea min-h-28 py-3" value={String(info.description ?? '')} onChange={e => update('description', e.target.value)} placeholder="Can be completed later." /></label></div>
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="auth-field"><span className="auth-field-label">{label}{required ? ' *' : ''}</span><input type={type} className="project-modal-control" value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={required ? '' : 'Can be completed later.'} /></label>
}

function HelpMarker({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 3600)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <span
          role="img"
          aria-hidden="true"
          className="inline-flex size-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-orange-500 dark:text-zinc-500 dark:hover:text-orange-400"
          aria-label={`${label} help`}
        >
          <CircleHelp className="h-4 w-4" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="center"
          sideOffset={8}
          className="max-w-72 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-700 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
        >
          {content}
          <Tooltip.Arrow className="fill-white dark:fill-zinc-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function PlanningColumnHeader({ children, help }: { children: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
      {children}
      {help ? <HelpMarker label={children} content={help} /> : null}
    </span>
  )
}

function PlanningCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:hidden dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function CrewStep({ rows, setRows, currency }: { rows: CrewRow[]; setRows: React.Dispatch<React.SetStateAction<CrewRow[]>>; currency: ProjectCurrency }) {
  return <PlanningRows title="Estimated Departments" empty="No crew estimates yet. Add departments or skip this step." rows={rows} setRows={setRows} currency={currency} kind="crew" />
}
function CastStep({ rows, setRows, currency }: { rows: CastRow[]; setRows: React.Dispatch<React.SetStateAction<CastRow[]>>; currency: ProjectCurrency }) {
  return <PlanningRows title="Estimated Cast" empty="No cast estimates yet. Add categories or skip this step." rows={rows} setRows={setRows} currency={currency} kind="cast" />
}

function PlanningRows<T extends CrewRow | CastRow>({ title, empty, rows, setRows, currency, kind }: { title: string; empty: string; rows: T[]; setRows: React.Dispatch<React.SetStateAction<T[]>>; currency: ProjectCurrency; kind: 'crew' | 'cast' }) {
  const nameKey = kind === 'crew' ? 'department' : 'category'
  const countKey = kind === 'crew' ? 'estimatedCrew' : 'estimatedCount'
  const rateKey = kind === 'crew' ? 'estimatedDailyWage' : 'estimatedRate'
  const columns = kind === 'crew'
    ? ['Department', 'Estimated People', 'Estimated Days', 'Daily Rate', 'Estimated Cost', 'Actions']
    : ['Category', 'Estimated Artists', 'Shoot Days', 'Per Day Cost', 'Estimated Cost', 'Actions']
  const gridClass = kind === 'crew'
    ? 'md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_1fr_auto]'
    : 'md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_1fr_auto]'

  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 className="section-title">{title}</h2>
          <HelpMarker
            label={title}
            content={kind === 'crew'
              ? 'Estimate how many people and how many days this department needs.'
              : 'Estimate how many artists are needed and what each shoot day may cost.'}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => setRows(current => [...current, (kind === 'crew' ? newCrewRow() : newCastRow()) as T])}>
          Add {kind === 'crew' ? 'Department' : 'Category'}
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="edit_note" title={empty} />
      ) : (
        <div className="space-y-3">
          <div className={cn('hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:gap-3 dark:border-zinc-800 dark:bg-zinc-900', gridClass)}>
            <PlanningColumnHeader help="The team or department being planned.">Department</PlanningColumnHeader>
            <PlanningColumnHeader help="How many people are expected in this group.">Estimated People</PlanningColumnHeader>
            <PlanningColumnHeader help="Approximate number of working days expected for this department.">Estimated Days</PlanningColumnHeader>
            <PlanningColumnHeader help="Cost for one person for one working day.">Daily Rate</PlanningColumnHeader>
            <PlanningColumnHeader help="Estimated total cost for this row.">Estimated Cost</PlanningColumnHeader>
            <PlanningColumnHeader>Actions</PlanningColumnHeader>
          </div>
          {rows.map(row => (
            <div key={row.id} className={cn('grid gap-3 rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900', gridClass)}>
              <PlanningCell label={columns[0]}>
                <input
                  className="project-modal-control"
                  value={String((row as unknown as Record<string, string | number>)[nameKey])}
                  onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, [nameKey]: e.target.value } : item))}
                />
              </PlanningCell>
              <PlanningCell label={columns[1]}>
                <input
                  className="project-modal-control"
                  type="number"
                  value={Number((row as unknown as Record<string, string | number>)[countKey])}
                  onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, [countKey]: Number(e.target.value) || 0 } : item))}
                />
              </PlanningCell>
              <PlanningCell label={columns[2]}>
                <input
                  className="project-modal-control"
                  type="number"
                  value={row.estimatedDays}
                  onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, estimatedDays: Number(e.target.value) || 0 } : item))}
                />
              </PlanningCell>
              <PlanningCell label={columns[3]}>
                <input
                  className="project-modal-control"
                  type="number"
                  value={Number((row as unknown as Record<string, string | number>)[rateKey])}
                  onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, [rateKey]: Number(e.target.value) || 0 } : item))}
                />
              </PlanningCell>
              <div className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold dark:bg-zinc-950">
                <span className="md:hidden block text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{columns[4]}</span>
                <span className="mt-1 block">{formatCurrency(rowTotal(row), currency)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-soft px-3" onClick={() => setRows(cur => [...cur, { ...row, id: crypto.randomUUID() }])}>Copy</button>
                <button type="button" className="btn-ghost px-3" onClick={() => setRows(cur => cur.filter(item => item.id !== row.id))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <SummaryTotal label="Grand Total" amount={rows.reduce((sum, row) => sum + rowTotal(row), 0)} currency={currency} />
    </div>
  )
}

function ExpenseStep({ rows, setRows, currency, onReorder }: { rows: ExpenseRow[]; setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>; currency: ProjectCurrency; onReorder?: ExpenseReorderHandler }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const previousRows = rows
    const nextRows = sortRowsByProjectedOrder(rows, String(active.id), String(over.id))
    if (nextRows === previousRows) return
    setRows(nextRows)
    if (!onReorder) return

    void Promise.resolve(onReorder(nextRows, previousRows)).catch(() => undefined)
  }

  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 className="section-title">Estimated Expenses</h2>
          <HelpMarker label="Estimated Expenses" content="List broad cost buckets first. Detailed spending will come later through invoices and transactions." />
        </div>
        <button type="button" className="btn-primary" onClick={() => setRows(current => [...current, newExpenseRow()])}>Add Category</button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="receipt_long" title="No expenses estimated. You can return later." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(row => row.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[1.05fr_0.75fr_0.7fr_0.85fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
                <PlanningColumnHeader help="The broad expense category you want to estimate.">Category</PlanningColumnHeader>
                <PlanningColumnHeader help="The estimated amount you expect to spend in this category.">Estimated Amount</PlanningColumnHeader>
                <PlanningColumnHeader help="A small buffer added to the estimate to cover changes.">Buffer %</PlanningColumnHeader>
                <PlanningColumnHeader help="The final estimate after buffer is added.">Calculated Total</PlanningColumnHeader>
                <PlanningColumnHeader help="Optional note for this estimate.">Notes</PlanningColumnHeader>
                <PlanningColumnHeader>Actions</PlanningColumnHeader>
              </div>
              {rows.map((row, index) => (
                <SortableExpenseRow
                  key={row.id}
                  row={row}
                  index={index}
                  currency={currency}
                  setRows={setRows}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <SummaryTotal label="Expense Estimate" amount={rows.reduce((sum, row) => sum + expenseTotal(row), 0)} currency={currency} />
    </div>
  )
}

function SortableExpenseRow({
  row,
  index,
  currency,
  setRows,
}: {
  row: ExpenseRow
  index: number
  currency: ProjectCurrency
  setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>
}) {
  const sortable = useSortable({ id: row.id })
  const style = {
    transform: `${CSS.Transform.toString(sortable.transform)}${sortable.isDragging ? ' scale(1.015)' : ''}`,
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.88 : 1,
    boxShadow: sortable.isDragging ? '0 18px 38px rgba(15, 23, 42, 0.16)' : undefined,
  } as React.CSSProperties

  return (
    <div ref={sortable.setNodeRef} style={style} className={cn('grid gap-3 rounded-[24px] bg-zinc-50 p-4 select-none dark:bg-zinc-900 md:grid-cols-[1.05fr_0.75fr_0.7fr_0.85fr_1fr_auto]', sortable.isDragging && 'ring-1 ring-orange-300 dark:ring-orange-500/40')}>
      <PlanningCell label="Category">
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="inline-flex size-10 shrink-0 touch-none cursor-grab items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-500 transition-colors hover:text-orange-500 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-orange-400"
            aria-label="Drag to reorder expense row"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <input className="project-modal-control" value={row.category} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, category: e.target.value } : item))} />
        </div>
      </PlanningCell>
      <PlanningCell label="Estimated Amount">
        <input className="project-modal-control" type="number" value={row.estimatedBudget} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, estimatedBudget: Number(e.target.value) || 0 } : item))} />
      </PlanningCell>
      <PlanningCell label="Buffer %">
        <input className="project-modal-control" type="number" value={row.contingencyPercent} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, contingencyPercent: Number(e.target.value) || 0 } : item))} />
      </PlanningCell>
      <div className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold dark:bg-zinc-950">
        <span className="md:hidden block text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Calculated Total</span>
        <span className="mt-1 block">{formatCurrency(expenseTotal(row), currency)}</span>
      </div>
      <PlanningCell label="Notes">
        <input className="project-modal-control" value={row.notes} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, notes: e.target.value } : item))} placeholder="Optional notes" />
      </PlanningCell>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-soft px-3" onClick={() => setRows(cur => [...cur, { ...row, id: crypto.randomUUID() }])}>Copy</button>
        <button type="button" className="btn-ghost px-3" onClick={() => setRows(cur => cur.filter(item => item.id !== row.id))}>Remove</button>
      </div>
    </div>
  )
}

function SummaryTotal({ label, amount, currency }: { label: string; amount: number; currency: ProjectCurrency }) {
  return <div className="rounded-[24px] bg-zinc-900 px-5 py-4 text-white dark:bg-white dark:text-zinc-900"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-0.04em]">{formatCurrency(amount, currency)}</p></div>
}

function BudgetReview({ crewCost, castCost, expenseCost, crewCount, castCount, departmentCount, currency }: { crewCost: number; castCost: number; expenseCost: number; crewCount: number; castCount: number; departmentCount: number; currency: ProjectCurrency }) {
  const grandTotal = crewCost + castCost + expenseCost
  if (grandTotal <= 0) return <EmptyState icon="account_balance_wallet" title="No planning information available yet." description="Budget estimates will appear once planning begins." />
  return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-3"><KpiCard label="Crew Estimated Cost" value={formatCurrency(crewCost, currency)} /><KpiCard label="Cast Estimated Cost" value={formatCurrency(castCost, currency)} /><KpiCard label="Expense Estimated Cost" value={formatCurrency(expenseCost, currency)} /></div><Surface variant="inverse" padding="lg"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">Estimated Grand Total</p><p className="mt-3 text-5xl font-bold tracking-[-0.06em]">{formatCurrency(grandTotal, currency)}</p><div className="mt-6 grid gap-3 md:grid-cols-3"><p>{departmentCount} departments</p><p>{crewCount} estimated crew</p><p>{castCount} estimated cast</p></div></Surface><p className="text-sm text-zinc-500 dark:text-zinc-400">This is only an estimate. Actual costs will automatically replace estimates as project activity progresses.</p></div>
}
