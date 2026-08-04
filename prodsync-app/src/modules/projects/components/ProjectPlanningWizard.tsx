import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, CircleHelp, GripVertical } from 'lucide-react'
import { Surface } from '@/components/shared/Surface'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { showError, showSuccess } from '@/lib/toast'
import {
  buildDefaultCrewPlanningDepartments,
  crewPlanningDepartmentTotal,
  crewPlanningRoleTotal,
  flattenCrewPlanningDepartments,
  normalizeCrewPlanningDepartments,
  PLANNING_TEMPLATE_SEED_VERSION,
  planningDepartmentTemplates,
  summarizeCrewPlanningDepartments,
  type CrewPlanningDepartment,
  type CrewPlanningRole,
} from '@/modules/projects/planningTemplates'
import { projectsService } from '@/services/projects.service'
import { cn, formatCurrency } from '@/utils'
import type { PlanningSectionType, ProjectCurrency, ProjectPhase, ProjectPlanningSection, ProjectRecord, ProjectStage } from '@/types'

type CastRow = { id: string; category: string; estimatedCount: number; estimatedRate: number; estimatedDays: number }
type ExpenseItem = { id: string; item: string; qty: number; unit: string; rate: number; numberOfDays: number; bufferPercent: number; notes: string; sortOrder: number; isPlanned: boolean }
type ExpenseDepartment = { id: string; name: string; moduleKey: string; isCustom: boolean; sortOrder: number; items: ExpenseItem[] }
type PlanningAction = 'save-draft' | 'save-continue' | null

const steps: Array<{ id: PlanningSectionType; title: string; help: string }> = [
  { id: 'project_information', title: 'Project Information', help: 'Create the project here. This is the official setup screen and only the project name is required.' },
  { id: 'crew_planning', title: 'Crew Planning', help: 'Estimate department manpower and wage costs. Exact crew names can be added later in Crew & Wages.' },
  { id: 'cast_planning', title: 'Cast Planning', help: 'Estimate casting costs without creating operational actor records yet.' },
  { id: 'expense_planning', title: 'Expense Planning', help: 'Build department-level budget estimates with expandable line items. This is planning, not accounting.' },
  { id: 'budget_review', title: 'Budget Review', help: 'Review the current estimate. Actual costs will replace estimates as production progresses.' },
]

const phaseOptions: Array<{ value: ProjectPhase; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'pre_production', label: 'Pre Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post Production' },
  { value: 'completed', label: 'Completed' },
]

const defaultCastCategories = ['Lead Actors', 'Supporting Actors', 'Junior Artists', 'Child Artists', 'Special Performers']

const legacyExpenseCategoryToDepartmentId: Record<string, string> = {
  'Crew & Wages': 'crew-wages',
  Cast: 'actor-juniors',
  Transport: 'transport-logistics',
  Accommodation: 'accommodation-travel',
  'Food & Beverages': 'food-beverages',
  'Camera & Equipment': 'camera-assets',
  'Camera & Assets': 'camera-assets',
  'Art Department': 'art-department',
  Costume: 'wardrobe-makeup',
  Makeup: 'wardrobe-makeup',
  Permissions: 'locations',
  Locations: 'locations',
  'Post Production': 'post-production',
  Miscellaneous: 'miscellaneous',
}

const numberValue = (value: unknown) => Number(value ?? 0) || 0
const normalizeExpenseDays = (value: unknown) => {
  const parsed = Number(value ?? 1)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const castRowTotal = (row: CastRow) => numberValue(row.estimatedCount) * numberValue(row.estimatedRate) * numberValue(row.estimatedDays)
const itemBaseTotal = (item: ExpenseItem) => numberValue(item.qty) * numberValue(item.rate) * numberValue(item.numberOfDays)
const itemTotal = (item: ExpenseItem) => itemBaseTotal(item) * (1 + numberValue(item.bufferPercent) / 100)
const departmentBaseTotal = (department: ExpenseDepartment) => department.items.reduce((sum, item) => sum + itemBaseTotal(item), 0)
const departmentBufferTotal = (department: ExpenseDepartment) => department.items.reduce((sum, item) => sum + (itemBaseTotal(item) * numberValue(item.bufferPercent) / 100), 0)
const departmentTotal = (department: ExpenseDepartment) => department.items.reduce((sum, item) => sum + itemTotal(item), 0)

function upsertAccessibleProjectCache(current: unknown, project: ProjectRecord) {
  if (!current || typeof current !== 'object') {
    return current
  }

  const snapshot = current as { projects?: ProjectRecord[]; projectMembers?: unknown[] }
  const projects = snapshot.projects ?? []
  const nextProjects = projects.some(existing => existing.id === project.id)
    ? projects.map(existing => existing.id === project.id ? project : existing)
    : [project, ...projects]

  return {
    ...snapshot,
    projects: nextProjects,
  }
}

function newExpenseItem(label = 'Line Item', sortOrder = 0): ExpenseItem {
  return {
    id: `item-${crypto.randomUUID()}`,
    item: label,
    qty: 0,
    unit: 'Nos',
    rate: 0,
    numberOfDays: 1,
    bufferPercent: 0,
    notes: '',
    sortOrder,
    isPlanned: false,
  }
}

function buildLegacyExpenseDepartments(): ExpenseDepartment[] {
  return planningDepartmentTemplates.map((template, index) => ({
    id: `dept-${template.id}`,
    name: template.name,
    moduleKey: template.moduleKey,
    isCustom: false,
    sortOrder: index,
    items: [],
  }))
}

function normalizeExpenseDepartments(payload: Record<string, unknown> | undefined | null): ExpenseDepartment[] {
  if (payload && Array.isArray(payload.departments) && payload.departments.length > 0) {
    return payload.departments.map((department, departmentIndex) => {
      const departmentRecord = isRecord(department) ? department : {}
      const rawItems = Array.isArray(departmentRecord.items) ? departmentRecord.items : []

      return {
        id: String(departmentRecord.id ?? `dept-${departmentIndex}`),
        name: String(departmentRecord.name ?? 'Department'),
        moduleKey: String(departmentRecord.moduleKey ?? 'custom'),
        isCustom: Boolean(departmentRecord.isCustom),
        sortOrder: Number(departmentRecord.sortOrder ?? departmentIndex),
        items: rawItems.map((item, itemIndex) => {
          const itemRecord = isRecord(item) ? item : {}

          return {
            id: String(itemRecord.id ?? `item-${departmentIndex}-${itemIndex}`),
            item: String(itemRecord.item ?? 'Line Item'),
            qty: numberValue(itemRecord.qty),
            unit: String(itemRecord.unit ?? 'Nos'),
            rate: numberValue(itemRecord.rate),
            numberOfDays: normalizeExpenseDays(itemRecord.numberOfDays ?? itemRecord.dailyWagePerDay ?? itemRecord.dailyWage),
            bufferPercent: numberValue(itemRecord.bufferPercent),
            notes: String(itemRecord.notes ?? ''),
            sortOrder: Number(itemRecord.sortOrder ?? itemIndex),
            isPlanned: Boolean(itemRecord.isPlanned),
          }
        }),
      }
    }).sort((left, right) => left.sortOrder - right.sortOrder).map(department => ({
      ...department,
      items: department.items.sort((left, right) => left.sortOrder - right.sortOrder),
    }))
  }

  if (payload && Array.isArray(payload.categories) && payload.categories.length > 0) {
    const legacyDepartments = buildLegacyExpenseDepartments().map(department => {
      const items: ExpenseItem[] = []
      return {
        ...department,
        items,
      }
    })

    for (const [index, row] of payload.categories.entries()) {
      const rowRecord = isRecord(row) ? row : {}
      const legacyName = String(rowRecord.category ?? rowRecord.item ?? rowRecord.name ?? 'Line Item')
      const departmentId = legacyExpenseCategoryToDepartmentId[legacyName] ?? 'miscellaneous'
      const department = legacyDepartments.find(item => item.id === `dept-${departmentId}`)
      if (!department) continue
      department.items.push({
        id: String(rowRecord.id ?? `legacy-${index}`),
        item: legacyName,
        qty: numberValue(rowRecord.qty ?? rowRecord.quantity ?? 0),
        unit: String(rowRecord.unit ?? 'Nos'),
        rate: numberValue(rowRecord.rate ?? rowRecord.estimatedBudget ?? 0),
        numberOfDays: normalizeExpenseDays(rowRecord.numberOfDays ?? rowRecord.dailyWagePerDay ?? rowRecord.dailyWage),
        bufferPercent: numberValue(rowRecord.bufferPercent ?? rowRecord.contingencyPercent ?? 0),
        notes: String(rowRecord.notes ?? ''),
        sortOrder: index,
        isPlanned: Boolean(rowRecord.isPlanned ?? rowRecord.planned ?? false),
      })
    }

    return legacyDepartments.map(department => ({
      ...department,
      items: department.items.sort((left, right) => left.sortOrder - right.sortOrder),
    }))
  }

  return []
}

function flattenExpenseDepartments(departments: ExpenseDepartment[]) {
  return departments.flatMap(department =>
    department.items.map(item => ({
      id: item.id,
      departmentId: department.id,
      departmentName: department.name,
      moduleKey: department.moduleKey,
      item: item.item,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
      numberOfDays: item.numberOfDays,
      bufferPercent: item.bufferPercent,
      notes: item.notes,
      sortOrder: item.sortOrder,
      isPlanned: item.isPlanned,
    })),
  )
}
function newCastRow(category = 'Category'): CastRow {
  return { id: crypto.randomUUID(), category, estimatedCount: 0, estimatedRate: 0, estimatedDays: 0 }
}

export function ProjectPlanningWizard() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const setActiveProject = useProjectsStore(state => state.setActiveProject)
  const [activeAction, setActiveAction] = useState<PlanningAction>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const isDraftMode = projectId === 'new'
  const currentStep = steps[stepIndex]
  const lastSavedSignatureRef = useRef('')
  const pendingSaveSignatureRef = useRef('')

  const planningQ = useQuery({
    queryKey: ['project-planning', projectId],
    queryFn: () => projectsService.getProjectPlanning(projectId),
    enabled: Boolean(projectId) && !isDraftMode,
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
          return upsertAccessibleProjectCache(current, result.project)
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
    name: isDraftMode ? '' : (planning?.project.name ?? ''),
    projectType: isDraftMode ? '' : (planning?.project.projectType ?? ''),
    productionHouse: isDraftMode ? '' : (planning?.project.productionHouse ?? ''),
    client: isDraftMode ? '' : (planning?.project.client ?? ''),
    director: isDraftMode ? '' : (planning?.project.director ?? ''),
    startDate: isDraftMode ? '' : (planning?.project.startDate ?? ''),
    endDate: isDraftMode ? '' : (planning?.project.endDate ?? ''),
    language: isDraftMode ? '' : (planning?.project.language ?? ''),
    location: isDraftMode ? '' : (planning?.project.location === 'Location pending' ? '' : planning?.project.location ?? ''),
    description: isDraftMode ? '' : (planning?.project.description ?? ''),
    projectPhase: isDraftMode ? 'planning' : (planning?.project.projectPhase ?? 'planning'),
    budgetUSD: isDraftMode ? 0 : (planning?.project.budgetUSD ?? 0),
    currency: isDraftMode ? 'INR' : (planning?.project.currency ?? 'INR'),
  }), [isDraftMode, planning?.project])

  const [info, setInfo] = useState<Record<string, string | number>>(infoDefaults)
  const [crewDepartments, setCrewDepartments] = useState<CrewPlanningDepartment[]>([])
  const [castRows, setCastRows] = useState<CastRow[]>([])
  const [expenseDepartments, setExpenseDepartments] = useState<ExpenseDepartment[]>([])
  const [expandedCrewDepartmentId, setExpandedCrewDepartmentId] = useState<string | null>(null)
  const [expandedDepartmentId, setExpandedDepartmentId] = useState<string | null>(null)
  const currency = (String(info.currency ?? infoDefaults.currency ?? 'INR') as ProjectCurrency)

  const hydratedProjectIdRef = useRef<string | null>(null)
  const hydratedDraftRef = useRef(false)
  const crewAccordionHydratedRef = useRef(false)
  const expenseAccordionHydratedRef = useRef(false)
  useEffect(() => {
    if (isDraftMode) {
      if (hydratedDraftRef.current) return
      hydratedDraftRef.current = true
      setInfo(infoDefaults)
      setCrewDepartments(buildDefaultCrewPlanningDepartments())
      setCastRows(defaultCastCategories.map(newCastRow))
      setExpenseDepartments([])
      setExpandedCrewDepartmentId(null)
      setExpandedDepartmentId(null)
      crewAccordionHydratedRef.current = true
      expenseAccordionHydratedRef.current = true
      lastSavedSignatureRef.current = ''
      pendingSaveSignatureRef.current = ''
      return
    }

    if (!planning) return
    if (hydratedProjectIdRef.current === planning.project.id) return
    hydratedProjectIdRef.current = planning.project.id
    setInfo(infoDefaults)
    setCrewDepartments(normalizeCrewPlanningDepartments(planning.sections.find(item => item.sectionType === 'crew_planning')?.payload as Record<string, unknown> | undefined))
    setCastRows(readRows<CastRow>(planning.sections, 'cast_planning', 'categories', defaultCastCategories.map(newCastRow)))
    setExpenseDepartments(normalizeExpenseDepartments(planning.sections.find(item => item.sectionType === 'expense_planning')?.payload as Record<string, unknown> | undefined))
    crewAccordionHydratedRef.current = false
    expenseAccordionHydratedRef.current = false
    lastSavedSignatureRef.current = ''
    pendingSaveSignatureRef.current = ''
  }, [infoDefaults, isDraftMode, planning, planning?.project.id])

  useEffect(() => {
    if (isDraftMode) return
    if (!crewDepartments.length) return
    if (crewAccordionHydratedRef.current) return

    const storageKey = `prodsync.crew.expanded.${projectId}`
    const storedDepartmentId = window.localStorage.getItem(storageKey)
    if (storedDepartmentId && crewDepartments.some(department => department.id === storedDepartmentId)) {
      setExpandedCrewDepartmentId(storedDepartmentId)
    } else {
      setExpandedCrewDepartmentId(crewDepartments[0]?.id ?? null)
    }
    crewAccordionHydratedRef.current = true
  }, [crewDepartments, isDraftMode, projectId])

  useEffect(() => {
    if (isDraftMode) return
    const storageKey = `prodsync.crew.expanded.${projectId}`
    if (expandedCrewDepartmentId) {
      window.localStorage.setItem(storageKey, expandedCrewDepartmentId)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  }, [expandedCrewDepartmentId, isDraftMode, projectId])

  useEffect(() => {
    if (isDraftMode) return
    if (!expenseDepartments.length) return
    if (expenseAccordionHydratedRef.current) return

    const storageKey = `prodsync.expense.expanded.${projectId}`
    const storedDepartmentId = window.localStorage.getItem(storageKey)
    if (storedDepartmentId && expenseDepartments.some(department => department.id === storedDepartmentId)) {
      setExpandedDepartmentId(storedDepartmentId)
    } else {
      setExpandedDepartmentId(expenseDepartments[0]?.id ?? null)
    }
    expenseAccordionHydratedRef.current = true
  }, [expenseDepartments, isDraftMode, projectId])

  useEffect(() => {
    if (isDraftMode) return
    const storageKey = `prodsync.expense.expanded.${projectId}`
    if (expandedDepartmentId) {
      window.localStorage.setItem(storageKey, expandedDepartmentId)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  }, [expandedDepartmentId, isDraftMode, projectId])

  const currentSignature = useMemo(() => JSON.stringify({
    step: currentStep.id,
    info,
    crewDepartments,
    castRows,
    expenseDepartments,
    completed: Boolean(section?.isCompleted),
    skipped: Boolean(section?.isSkipped),
  }), [castRows, crewDepartments, currentStep.id, expenseDepartments, info, section?.isCompleted, section?.isSkipped])

  useEffect(() => {
    if (isDraftMode || !planning || activeAction) return
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
  }, [activeAction, currentSignature, currentStep.id, isDraftMode, planning, section?.isCompleted, section?.isSkipped])

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

  useEffect(() => {
    if (isDraftMode || !planning) return
    const nextIndex = planning.sections.findIndex(sectionItem => !sectionItem.isCompleted && !sectionItem.isSkipped)
    setStepIndex(nextIndex >= 0 ? nextIndex : steps.length - 1)
  }, [isDraftMode, planning?.project.id])

  if (isDraftMode) {
    const draftProgressPercent = Math.round(((stepIndex + 1) / steps.length) * 100)
    return (
      <Tooltip.Provider delayDuration={350} skipDelayDuration={120}>
        <div className="page-shell page-shell-narrow pb-12 max-md:pt-16">
          <header className="page-header page-header-card">
            <div>
              <span className="page-kicker">Project Planning</span>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title page-title-compact">{currentStep.title}</h1>
                <HelpMarker label="Project Information" content="Create the project here. This becomes the official planning entry point." />
              </div>
              <p className="page-subtitle">{currentStep.help}</p>
            </div>
            <Surface variant="raised" className="min-w-[260px]" padding="md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Estimated Completion</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-zinc-900 dark:text-white">{draftProgressPercent}%</p>
              <div className="mt-3 h-2 rounded-full bg-zinc-200 dark:bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{ width: `${draftProgressPercent}%` }} /></div>
            </Surface>
          </header>

          <section className="grid gap-3 md:grid-cols-5">
            {steps.map((step, index) => {
              const state = index === stepIndex ? 'Current' : 'Upcoming'
              return (
                <div key={step.id} className={cn('rounded-[24px] border px-4 py-4 text-left transition-all', index === stepIndex ? 'border-orange-300 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900')}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Step {index + 1} of {steps.length} | {state}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{step.title}</p>
                    <HelpMarker label={step.title} content={step.help} />
                  </div>
                </div>
              )
            })}
          </section>

          <Surface variant="raised" padding="lg" className="overflow-hidden">
            <ProjectInfoStep info={info} setInfo={setInfo} />
          </Surface>

          <section className="rounded-[30px] border border-zinc-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button type="button" className="btn-soft md:w-fit" onClick={() => navigate('/projects')}>Back to Projects</button>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  className="btn-ghost min-w-36"
                  disabled={isActionBusy('save-draft')}
                  onClick={() => void runAction('save-draft', () => saveDraftProject(false))}
                >
                  {activeAction === 'save-draft' ? <span className="ui-spinner" /> : null}
                  {activeAction === 'save-draft' ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  className="btn-primary min-w-40"
                  disabled={isActionBusy('save-continue')}
                  onClick={() => void runAction('save-continue', () => saveDraftProject(true))}
                >
                  {activeAction === 'save-continue' ? <span className="ui-spinner" /> : null}
                  {activeAction === 'save-continue' ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </Tooltip.Provider>
    )
  }

  if (planningQ.isLoading) return <PageLoader open message="Loading project planning..." />
  if (planningQ.isError || !planning || !currentStep) return <ErrorState message="Project planning could not be loaded." />

  const crewSummary = summarizeCrewPlanningDepartments(crewDepartments)
  const crewCost = crewSummary.estimatedCost
  const castCost = castRows.reduce((sum, row) => sum + castRowTotal(row), 0)
  const expenseCost = expenseDepartments.reduce((sum, department) => sum + departmentTotal(department), 0)
  const crewCount = crewSummary.estimatedCrew
  const castCount = castRows.reduce((sum, row) => sum + numberValue(row.estimatedCount), 0)
  const grandTotal = crewCost + castCost + expenseCost

  function readRows<T>(sections: ProjectPlanningSection[], sectionType: PlanningSectionType, key: string, fallback: T[]) {
    const rows = sections.find(item => item.sectionType === sectionType)?.payload?.[key]
    return Array.isArray(rows) && rows.length > 0 ? rows as T[] : fallback
  }

  function getPayload(): Record<string, unknown> {
    if (currentStep.id === 'project_information') return { ...info, planningTemplateSeedVersion: PLANNING_TEMPLATE_SEED_VERSION }
    if (currentStep.id === 'crew_planning') return {
      departments: crewDepartments,
      roles: flattenCrewPlanningDepartments(crewDepartments),
      estimatedCrew: crewSummary.estimatedCrew,
      estimatedCost: crewSummary.estimatedCost,
      departmentCount: crewSummary.departmentCount,
      roleCount: crewSummary.roleCount,
      plannedRoleCount: crewSummary.plannedRoleCount,
    }
    if (currentStep.id === 'cast_planning') return { categories: castRows, estimatedCast: castCount, estimatedCost: castCost }
    if (currentStep.id === 'expense_planning') return { departments: expenseDepartments, categories: flattenExpenseDepartments(expenseDepartments), estimatedCost: expenseCost, departmentCount: expenseDepartments.length, itemCount: expenseDepartments.reduce((sum, department) => sum + department.items.length, 0), plannedItemCount: expenseDepartments.reduce((sum, department) => sum + department.items.filter(item => item.isPlanned).length, 0) }
    return { crewCost, castCost, expenseCost, crewCount, castCount, departmentCount: crewSummary.departmentCount, grandTotal }
  }

  function buildProjectCreateInput() {
    return {
      name: String(info.name ?? '').trim(),
      location: String(info.location ?? '').trim(),
      status: (String(info.projectPhase ?? 'planning') === 'shooting'
        ? 'shooting'
        : String(info.projectPhase ?? 'planning') === 'post'
          ? 'post'
          : 'pre-production') as ProjectStage,
      projectPhase: String(info.projectPhase ?? 'planning') as ProjectPhase,
      budgetUSD: Number(info.budgetUSD ?? 0) || 0,
      currency,
      activeCrew: 0,
      startDate: String(info.startDate ?? ''),
      endDate: String(info.endDate ?? ''),
      enabledDepartments: [],
      otRulesLabel: '',
      projectType: String(info.projectType ?? ''),
      productionHouse: String(info.productionHouse ?? ''),
      client: String(info.client ?? ''),
      director: String(info.director ?? ''),
      language: String(info.language ?? ''),
      description: String(info.description ?? ''),
    }
  }

  async function saveDraftProject(completeStepOne: boolean) {
    if (!String(info.name ?? '').trim()) {
      showError('Project name is the only required field.')
      return
    }

    let project: ProjectRecord | null = null
    try {
      project = await projectsService.createProject(buildProjectCreateInput())
      if (!project) {
        throw new Error('Project creation did not return a record.')
      }
      if (user?.id) {
        const createdProject = project
        queryClient.setQueryData(['accessible-projects', user.id], (current: unknown) => {
          return upsertAccessibleProjectCache(current, createdProject)
        })
      }
    } catch (error) {
      console.error('[projects][planning][draft] project creation failed', error)
      showError('Project could not be created right now.')
      return
    }

    if (!project) {
      showError('Project could not be created right now.')
      return
    }

    try {
      await projectsService.savePlanningSection(project.id, {
        sectionType: 'project_information',
        payload: { ...info, planningInitialized: true, planningTemplateSeedVersion: PLANNING_TEMPLATE_SEED_VERSION },
        isCompleted: completeStepOne,
        isSkipped: false,
      })
    } catch (error) {
      console.error('[projects][planning][draft] could not save step 1 section', error)
      showError('Project was created, but setup progress could not be saved. You can continue from Step 1.')
    }

    queryClient.setQueryData(['project', project.id], project)
    if (user?.id) {
      queryClient.setQueryData(['accessible-projects', user.id], (current: unknown) => {
        return upsertAccessibleProjectCache(current, project)
      })
    }
    await queryClient.invalidateQueries({ queryKey: ['project-planning', project.id] })
    setActiveProject(project.id, project.currency)
    navigate(`/projects/${project.id}/planning`)
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
            <div key={step.id} role="button" tabIndex={0} aria-disabled={actionBusy} onClick={() => !actionBusy && setStepIndex(index)} onKeyDown={event => { if (actionBusy) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setStepIndex(index) } }} className={cn('rounded-[24px] border px-4 py-4 text-left transition-all', index === stepIndex ? 'border-orange-300 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900', actionBusy && 'cursor-not-allowed opacity-75')}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Step {index + 1} | {state}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{step.title}</p>
                <HelpMarker label={step.title} content={step.help} />
              </div>
            </div>
          )
        })}
      </section>

      <Surface variant="raised" padding="lg" className="overflow-hidden">
        {currentStep.id === 'project_information' && <ProjectInfoStep info={info} setInfo={setInfo} />}
        {currentStep.id === 'crew_planning' && (
          <CrewStep
            departments={crewDepartments}
            setDepartments={setCrewDepartments}
            expandedDepartmentId={expandedCrewDepartmentId}
            setExpandedDepartmentId={setExpandedCrewDepartmentId}
            currency={currency}
            onPersist={async (nextDepartments, previousDepartments) => {
              if (!planning || currentStep.id !== 'crew_planning') return
              const nextSignature = JSON.stringify({
                step: currentStep.id,
                info,
                crewDepartments: nextDepartments,
                castRows,
                expenseDepartments,
                completed: Boolean(section?.isCompleted),
                skipped: Boolean(section?.isSkipped),
              })
              pendingSaveSignatureRef.current = nextSignature
              try {
                const nextSummary = summarizeCrewPlanningDepartments(nextDepartments)
                await saveMutation.mutateAsync({
                  sectionType: 'crew_planning',
                  payload: {
                    departments: nextDepartments,
                    roles: flattenCrewPlanningDepartments(nextDepartments),
                    estimatedCrew: nextSummary.estimatedCrew,
                    estimatedCost: nextSummary.estimatedCost,
                    departmentCount: nextSummary.departmentCount,
                    roleCount: nextSummary.roleCount,
                    plannedRoleCount: nextSummary.plannedRoleCount,
                  },
                  isCompleted: Boolean(section?.isCompleted),
                  isSkipped: Boolean(section?.isSkipped),
                })
                lastSavedSignatureRef.current = nextSignature
              } catch (error) {
                pendingSaveSignatureRef.current = ''
                setCrewDepartments(previousDepartments)
                setExpandedCrewDepartmentId(current => previousDepartments.some(department => department.id === current) ? current : previousDepartments[0]?.id ?? null)
                showError('Crew role order could not be saved right now.')
              }
            }}
          />
        )}
        {currentStep.id === 'cast_planning' && <CastStep rows={castRows} setRows={setCastRows} currency={currency} />}
        {currentStep.id === 'expense_planning' && (
          <ExpenseStep
            departments={expenseDepartments}
            setDepartments={setExpenseDepartments}
            expandedDepartmentId={expandedDepartmentId}
            setExpandedDepartmentId={setExpandedDepartmentId}
            currency={currency}
            onPersist={async (nextDepartments, previousDepartments) => {
              if (!planning || currentStep.id !== 'expense_planning') return
              const nextSignature = JSON.stringify({
                step: currentStep.id,
                info,
                crewDepartments,
                castRows,
                expenseDepartments: nextDepartments,
                completed: Boolean(section?.isCompleted),
                skipped: Boolean(section?.isSkipped),
              })
              pendingSaveSignatureRef.current = nextSignature
              try {
                await saveMutation.mutateAsync({
                  sectionType: 'expense_planning',
                  payload: {
                    departments: nextDepartments,
                    categories: flattenExpenseDepartments(nextDepartments),
                    estimatedCost: nextDepartments.reduce((sum, department) => sum + departmentTotal(department), 0),
                    departmentCount: nextDepartments.length,
                    itemCount: nextDepartments.reduce((sum, department) => sum + department.items.length, 0),
                  },
                  isCompleted: Boolean(section?.isCompleted),
                  isSkipped: Boolean(section?.isSkipped),
                })
                lastSavedSignatureRef.current = nextSignature
              } catch (error) {
                pendingSaveSignatureRef.current = ''
                setExpenseDepartments(previousDepartments)
                setExpandedDepartmentId(current => previousDepartments.some(department => department.id === current) ? current : previousDepartments[0]?.id ?? null)
                showError('Expense order could not be saved right now.')
              }
            }}
          />
        )}
        {currentStep.id === 'budget_review' && <BudgetReview crewCost={crewCost} castCost={castCost} expenseCost={expenseCost} crewCount={crewCount} castCount={castCount} departmentCount={crewSummary.departmentCount} currency={currency} />}
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


function PlanningDaysInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(() => String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  return (
    <input
      className="project-modal-control"
      type="number"
      min={1}
      step="any"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onChange={event => {
        const nextValue = event.target.value
        setDraft(nextValue)

        if (nextValue.trim() === '') {
          onChange(1)
          return
        }

        const parsed = Number(nextValue)
        if (!Number.isFinite(parsed) || parsed < 1) {
          return
        }

        onChange(parsed)
      }}
      onBlur={() => {
        if (draft.trim() === '') {
          setDraft('1')
        }
      }}
      onKeyDown={event => {
        if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
          event.preventDefault()
        }
      }}
    />
  )
}
function newCrewRole(role = 'Crew Role', sortOrder = 0): CrewPlanningRole {
  return {
    id: `crew-role-${crypto.randomUUID()}`,
    role,
    estimatedCount: 0,
    shootDays: 0,
    dailyWage: 0,
    notes: '',
    sortOrder,
    isPlanned: false,
    isPreset: false,
  }
}

function CrewStep({
  departments,
  setDepartments,
  expandedDepartmentId,
  setExpandedDepartmentId,
  currency,
  onPersist,
}: {
  departments: CrewPlanningDepartment[]
  setDepartments: React.Dispatch<React.SetStateAction<CrewPlanningDepartment[]>>
  expandedDepartmentId: string | null
  setExpandedDepartmentId: React.Dispatch<React.SetStateAction<string | null>>
  currency: ProjectCurrency
  onPersist: (nextDepartments: CrewPlanningDepartment[], previousDepartments: CrewPlanningDepartment[]) => void | Promise<void>
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const departmentRenameBaselineRef = useRef<Record<string, string>>({})
  const departmentNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [pendingDepartmentFocusId, setPendingDepartmentFocusId] = useState<string | null>(null)
  const cancelRenameCommitRef = useRef<string | null>(null)

  function normalizeDepartmentOrder(nextDepartments: CrewPlanningDepartment[]) {
    return nextDepartments.map((department, departmentIndex) => ({
      ...department,
      sortOrder: departmentIndex,
      roles: department.roles.map((role, roleIndex) => ({
        ...role,
        sortOrder: roleIndex,
      })),
    }))
  }

  function commitDepartments(nextDepartments: CrewPlanningDepartment[], previousDepartments: CrewPlanningDepartment[]) {
    const normalized = normalizeDepartmentOrder(nextDepartments)
    setDepartments(normalized)
    void Promise.resolve(onPersist(normalized, previousDepartments)).catch(() => undefined)
  }

  useEffect(() => {
    if (!pendingDepartmentFocusId) return
    const input = departmentNameInputRefs.current[pendingDepartmentFocusId]
    if (!input) return
    input.focus()
    input.select()
    setPendingDepartmentFocusId(null)
  }, [pendingDepartmentFocusId, departments])

  function uniqueDepartmentName(baseName: string, excludeId?: string) {
    const existingNames = new Set(
      departments
        .filter(department => department.id !== excludeId)
        .map(department => department.name.trim().toLowerCase()),
    )

    const trimmedBase = baseName.trim() || 'Custom Department'
    if (!existingNames.has(trimmedBase.toLowerCase())) {
      return trimmedBase
    }

    let suffix = 2
    while (existingNames.has(`${trimmedBase} ${suffix}`.toLowerCase())) {
      suffix += 1
    }

    return `${trimmedBase} ${suffix}`
  }

  function findDepartmentByRoleId(roleId: string) {
    return departments.find(department => department.roles.some(role => role.id === roleId)) ?? null
  }

  function moveDepartment(previousDepartments: CrewPlanningDepartment[], activeId: string, overId: string) {
    const oldIndex = previousDepartments.findIndex(department => department.id === activeId)
    const newIndex = previousDepartments.findIndex(department => department.id === overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return previousDepartments
    }
    return arrayMove(previousDepartments, oldIndex, newIndex)
  }

  function moveRolesWithinDepartment(previousDepartments: CrewPlanningDepartment[], departmentId: string, activeRoleId: string, overRoleId: string) {
    const departmentIndex = previousDepartments.findIndex(department => department.id === departmentId)
    if (departmentIndex < 0) return previousDepartments
    const department = previousDepartments[departmentIndex]
    const oldIndex = department.roles.findIndex(role => role.id === activeRoleId)
    const newIndex = department.roles.findIndex(role => role.id === overRoleId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return previousDepartments
    const nextDepartments = [...previousDepartments]
    nextDepartments[departmentIndex] = {
      ...department,
      roles: arrayMove(department.roles, oldIndex, newIndex),
    }
    return nextDepartments
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const previousDepartments = departments

    const activeDepartment = previousDepartments.find(department => department.id === activeId)
    const overDepartment = previousDepartments.find(department => department.id === overId)
    if (activeDepartment && overDepartment) {
      const nextDepartments = moveDepartment(previousDepartments, activeId, overId)
      if (nextDepartments !== previousDepartments) {
        commitDepartments(nextDepartments, previousDepartments)
      }
      return
    }

    const activeRoleDepartment = findDepartmentByRoleId(activeId)
    const overRoleDepartment = findDepartmentByRoleId(overId)
    if (!activeRoleDepartment || !overRoleDepartment || activeRoleDepartment.id !== overRoleDepartment.id) return

    const nextDepartments = moveRolesWithinDepartment(previousDepartments, activeRoleDepartment.id, activeId, overId)
    if (nextDepartments !== previousDepartments) {
      commitDepartments(nextDepartments, previousDepartments)
    }
  }

  function addDepartment() {
    const previousDepartments = departments
    const nextDepartmentId = `dept-custom-${crypto.randomUUID()}`
    const nextDepartmentName = uniqueDepartmentName('Custom Department')
    const nextDepartments = normalizeDepartmentOrder([
      ...previousDepartments,
      {
        id: nextDepartmentId,
        name: nextDepartmentName,
        moduleKey: 'custom',
        isCustom: true,
        sortOrder: previousDepartments.length,
        roles: [],
      },
    ])
    setExpandedDepartmentId(nextDepartmentId)
    setPendingDepartmentFocusId(nextDepartmentId)
    commitDepartments(nextDepartments, previousDepartments)
  }

  function addRole(departmentId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department =>
      department.id === departmentId
        ? { ...department, roles: [...department.roles, newCrewRole('Crew Role', department.roles.length)] }
        : department,
    ))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function duplicateRole(departmentId: string, roleId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department => {
      if (department.id !== departmentId) return department
      const roleIndex = department.roles.findIndex(role => role.id === roleId)
      if (roleIndex < 0) return department
      const source = department.roles[roleIndex]
      const clone: CrewPlanningRole = {
        ...source,
        id: `crew-role-${crypto.randomUUID()}`,
        isPreset: false,
        sortOrder: roleIndex + 1,
      }
      const nextRoles = [...department.roles]
      nextRoles.splice(roleIndex + 1, 0, clone)
      return { ...department, roles: nextRoles }
    }))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function removeRole(departmentId: string, roleId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department =>
      department.id === departmentId
        ? { ...department, roles: department.roles.filter(role => role.id !== roleId) }
        : department,
    ))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function removeDepartment(departmentId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.filter(department => department.id !== departmentId))
    delete departmentRenameBaselineRef.current[departmentId]
    delete departmentNameInputRefs.current[departmentId]
    setExpandedDepartmentId(current => current === departmentId ? null : current)
    commitDepartments(nextDepartments, previousDepartments)
  }

  function startDepartmentRename(departmentId: string) {
    const department = departments.find(item => item.id === departmentId)
    if (!department) return
    departmentRenameBaselineRef.current[departmentId] = department.name
    setPendingDepartmentFocusId(departmentId)
  }

  function commitDepartmentRename(departmentId: string) {
    const baselineName = departmentRenameBaselineRef.current[departmentId] ?? departments.find(item => item.id === departmentId)?.name ?? 'Department'
    const currentDepartment = departments.find(item => item.id === departmentId)
    if (!currentDepartment) return
    if (cancelRenameCommitRef.current === departmentId) {
      cancelRenameCommitRef.current = null
      return
    }

    const trimmedName = currentDepartment.name.trim()
    if (!trimmedName) {
      showError('Department name cannot be empty.')
      setDepartments(current => current.map(department =>
        department.id === departmentId ? { ...department, name: baselineName } : department,
      ))
      return
    }

    if (trimmedName === baselineName.trim()) {
      departmentRenameBaselineRef.current[departmentId] = trimmedName
      return
    }

    const duplicateExists = departments.some(department =>
      department.id !== departmentId && department.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
    if (duplicateExists) {
      showError('Department names must be unique.')
      setDepartments(current => current.map(department =>
        department.id === departmentId ? { ...department, name: baselineName } : department,
      ))
      return
    }

    const nextDepartments = departments.map(department =>
      department.id === departmentId ? { ...department, name: trimmedName } : department,
    )
    departmentRenameBaselineRef.current[departmentId] = trimmedName
    commitDepartments(nextDepartments, departments)
  }

  function cancelDepartmentRename(departmentId: string) {
    const baselineName = departmentRenameBaselineRef.current[departmentId]
    if (!baselineName) return
    cancelRenameCommitRef.current = departmentId
    const revertedDepartments = departments.map(department =>
      department.id === departmentId ? { ...department, name: baselineName } : department,
    )
    commitDepartments(revertedDepartments, departments)
  }

  function updateDepartmentName(departmentId: string, name: string) {
    setDepartments(current => current.map(department =>
      department.id === departmentId ? { ...department, name } : department,
    ))
  }

  function updateRoleField(departmentId: string, roleId: string, updates: Partial<CrewPlanningRole>) {
    setDepartments(current => current.map(department =>
      department.id === departmentId
        ? {
            ...department,
            roles: department.roles.map(role => role.id === roleId ? { ...role, ...updates } : role),
          }
        : department,
    ))
  }

  const crewSummary = summarizeCrewPlanningDepartments(departments)

  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 className="section-title">Crew Planning</h2>
          <HelpMarker label="Crew Planning" content="Plan department-wise crew roles, counts, wage assumptions, and shoot-day coverage without creating actual crew records." />
        </div>
        <button type="button" className="btn-primary" onClick={addDepartment}>+ Add Department</button>
      </div>

      {departments.length === 0 ? (
        <EmptyState icon="groups" title="No departments yet" description="Add a department to start planning roles." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={departments.map(department => department.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {departments.map(department => (
                <CrewDepartmentCard
                  key={department.id}
                  department={department}
                  currency={currency}
                  expanded={expandedDepartmentId === department.id}
                  onToggle={() => setExpandedDepartmentId(current => current === department.id ? null : department.id)}
                  onRenameStart={() => startDepartmentRename(department.id)}
                  onRenameCommit={() => commitDepartmentRename(department.id)}
                  onRenameCancel={() => cancelDepartmentRename(department.id)}
                  onRename={name => updateDepartmentName(department.id, name)}
                  nameInputRef={element => {
                    departmentNameInputRefs.current[department.id] = element
                  }}
                  onAddRole={() => addRole(department.id)}
                  onDuplicateRole={roleId => duplicateRole(department.id, roleId)}
                  onRemoveRole={roleId => removeRole(department.id, roleId)}
                  onDeleteDepartment={() => removeDepartment(department.id)}
                  onUpdateRole={(roleId, updates) => updateRoleField(department.id, roleId, updates)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Departments" value={String(crewSummary.departmentCount)} />
        <KpiCard label="Planning Progress" value={`${crewSummary.plannedRoleCount}/${crewSummary.roleCount}`} />
        <SummaryTotal label="Crew Estimate" amount={crewSummary.estimatedCost} currency={currency} />
      </div>
    </div>
  )
}

function CrewDepartmentCard({
  department,
  currency,
  expanded,
  onToggle,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onRename,
  nameInputRef,
  onAddRole,
  onDuplicateRole,
  onRemoveRole,
  onDeleteDepartment,
  onUpdateRole,
}: {
  department: CrewPlanningDepartment
  currency: ProjectCurrency
  expanded: boolean
  onToggle: () => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onRename: (name: string) => void
  nameInputRef: (element: HTMLInputElement | null) => void
  onAddRole: () => void
  onDuplicateRole: (roleId: string) => void
  onRemoveRole: (roleId: string) => void
  onDeleteDepartment: () => void
  onUpdateRole: (roleId: string, updates: Partial<CrewPlanningRole>) => void
}) {
  const sortable = useSortable({ id: department.id })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.9 : 1,
    boxShadow: sortable.isDragging ? '0 24px 44px rgba(15, 23, 42, 0.16)' : undefined,
  } as React.CSSProperties

  const plannedRoleCount = department.roles.filter(role => role.isPlanned).length
  const roleCount = department.roles.length
  const estimatedHeadcount = department.roles.reduce((sum, role) => sum + numberValue(role.estimatedCount), 0)
  const total = crewPlanningDepartmentTotal(department)
  const summaryLabel = roleCount > 0
    ? `${plannedRoleCount} / ${roleCount} Planned | Headcount ${estimatedHeadcount} | ${formatCurrency(total, currency)}`
    : 'No crew roles yet'

  return (
    <article ref={sortable.setNodeRef} style={style} className={cn('rounded-[24px] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950', sortable.isDragging && 'ring-1 ring-orange-300 dark:ring-orange-500/40')}>
      <div
        className="rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-900"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-0.5 inline-flex size-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-500 transition-colors hover:text-orange-500 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-orange-400"
            aria-label={`Drag to reorder ${department.name}`}
            onClick={event => event.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 select-none">
            <div className="flex items-center gap-2">
              {department.isCustom ? (
                <input
                  ref={nameInputRef}
                  value={department.name}
                  onFocus={onRenameStart}
                  onBlur={onRenameCommit}
                  onClick={event => event.stopPropagation()}
                  onChange={event => onRename(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      onRenameCancel()
                      event.currentTarget.blur()
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                  aria-label="Department name"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{department.name}</p>
              )}
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 dark:text-zinc-500', expanded && 'rotate-180')} />
            </div>
            <p className="mt-1 truncate text-xs leading-5 text-zinc-500 dark:text-zinc-400">{summaryLabel}</p>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2" onClick={event => event.stopPropagation()}>
            <button type="button" className="btn-primary px-3" onClick={onAddRole}>+ Add Crew Role</button>
            <button type="button" className="btn-ghost px-3" onClick={onToggle}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
            <button type="button" className="btn-danger px-3" onClick={onDeleteDepartment}>Delete</button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[auto_auto_1.2fr_0.7fr_0.7fr_0.8fr_1fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span />
            <span />
            <PlanningColumnHeader help="The crew role being planned inside this department.">Crew Role</PlanningColumnHeader>
            <PlanningColumnHeader help="How many people are needed for this role.">Estimated Count</PlanningColumnHeader>
            <PlanningColumnHeader help="Expected shoot days for this role.">Shoot Days</PlanningColumnHeader>
            <PlanningColumnHeader help="Expected daily wage for one person in this role.">Daily Wage</PlanningColumnHeader>
            <PlanningColumnHeader help="Automatically calculated estimate for this role.">Estimated Cost</PlanningColumnHeader>
            <PlanningColumnHeader help="Optional planning notes for the crew team.">Notes</PlanningColumnHeader>
            <PlanningColumnHeader>Actions</PlanningColumnHeader>
          </div>

          <SortableContext items={department.roles.map(role => role.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {department.roles.map(role => (
                <CrewRoleRow
                  key={role.id}
                  role={role}
                  currency={currency}
                  onDuplicate={() => onDuplicateRole(role.id)}
                  onRemove={() => onRemoveRole(role.id)}
                  onChange={updates => onUpdateRole(role.id, updates)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </article>
  )
}

function CrewRoleRow({
  role,
  currency,
  onDuplicate,
  onRemove,
  onChange,
}: {
  role: CrewPlanningRole
  currency: ProjectCurrency
  onDuplicate: () => void
  onRemove: () => void
  onChange: (updates: Partial<CrewPlanningRole>) => void
}) {
  const sortable = useSortable({ id: role.id })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.88 : 1,
    boxShadow: sortable.isDragging ? '0 18px 38px rgba(15, 23, 42, 0.16)' : undefined,
    zIndex: sortable.isDragging ? 10 : undefined,
  } as React.CSSProperties

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn('grid gap-3 rounded-[24px] bg-zinc-50 p-4 select-none dark:bg-zinc-900 md:grid-cols-[auto_auto_1.2fr_0.7fr_0.7fr_0.8fr_1fr_1fr_auto]', sortable.isDragging && 'ring-1 ring-orange-300 dark:ring-orange-500/40')}
    >
      <div className="flex items-center justify-center md:justify-start">
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40',
            role.isPlanned
              ? 'border-orange-500 bg-orange-500 text-black shadow-[0_0_0_1px_rgba(249,115,22,0.22)] hover:scale-[1.03]'
              : 'border-zinc-300 bg-white text-transparent hover:border-orange-300 hover:text-orange-500 dark:border-zinc-700 dark:bg-zinc-950',
          )}
          aria-pressed={role.isPlanned}
          aria-label={role.isPlanned ? `Mark ${role.role} as unplanned` : `Mark ${role.role} as planned`}
          onClick={event => {
            event.stopPropagation()
            onChange({ isPlanned: !role.isPlanned })
          }}
        >
          <span className="sr-only">{role.isPlanned ? 'Planned' : 'Not planned'}</span>
          {role.isPlanned ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
        </button>
      </div>
      <div className="flex items-center justify-center md:justify-start">
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          className="inline-flex size-10 shrink-0 touch-none cursor-grab items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-500 transition-colors hover:text-orange-500 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-orange-400"
          aria-label={`Drag to reorder ${role.role}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <PlanningCell label="Crew Role">
        <input className="project-modal-control" value={role.role} onChange={event => onChange({ role: event.target.value, isPreset: false })} />
      </PlanningCell>
      <PlanningCell label="Estimated Count">
        <input className="project-modal-control" type="number" inputMode="numeric" value={role.estimatedCount} onChange={event => onChange({ estimatedCount: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <PlanningCell label="Shoot Days">
        <input className="project-modal-control" type="number" inputMode="numeric" value={role.shootDays} onChange={event => onChange({ shootDays: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <PlanningCell label="Daily Wage">
        <input className="project-modal-control" type="number" inputMode="decimal" value={role.dailyWage} onChange={event => onChange({ dailyWage: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <div className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold dark:bg-zinc-950">
        <span className="md:hidden block text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Estimated Cost</span>
        <span className="mt-1 block">{formatCurrency(crewPlanningRoleTotal(role), currency)}</span>
      </div>
      <PlanningCell label="Notes">
        <input className="project-modal-control" value={role.notes} onChange={event => onChange({ notes: event.target.value })} placeholder="Optional notes" />
      </PlanningCell>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-duplicate px-3" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="btn-danger px-3" onClick={onRemove}>Remove</button>
      </div>
    </div>
  )
}

function CastStep({ rows, setRows, currency }: { rows: CastRow[]; setRows: React.Dispatch<React.SetStateAction<CastRow[]>>; currency: ProjectCurrency }) {
  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 className="section-title">Estimated Cast</h2>
          <HelpMarker label="Estimated Cast" content="Estimate how many artists are needed and what each shoot day may cost." />
        </div>
        <button type="button" className="btn-primary" onClick={() => setRows(current => [...current, newCastRow()])}>
          Add Category
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="theater_comedy" title="No cast estimates yet. Add categories or skip this step." />
      ) : (
        <div className="space-y-3">
          <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
            <PlanningColumnHeader help="The cast category being planned.">Category</PlanningColumnHeader>
            <PlanningColumnHeader help="How many artists are expected in this group.">Estimated Artists</PlanningColumnHeader>
            <PlanningColumnHeader help="Approximate number of working days expected for this category.">Shoot Days</PlanningColumnHeader>
            <PlanningColumnHeader help="Cost for one artist for one shoot day.">Per Day Cost</PlanningColumnHeader>
            <PlanningColumnHeader help="Estimated total cost for this category.">Estimated Cost</PlanningColumnHeader>
            <PlanningColumnHeader>Actions</PlanningColumnHeader>
          </div>
          {rows.map(row => (
            <div key={row.id} className="grid gap-3 rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_1fr_auto]">
              <PlanningCell label="Category">
                <input className="project-modal-control" value={row.category} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, category: e.target.value } : item))} />
              </PlanningCell>
              <PlanningCell label="Estimated Artists">
                <input className="project-modal-control" type="number" value={row.estimatedCount} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, estimatedCount: Number(e.target.value) || 0 } : item))} />
              </PlanningCell>
              <PlanningCell label="Shoot Days">
                <input className="project-modal-control" type="number" value={row.estimatedDays} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, estimatedDays: Number(e.target.value) || 0 } : item))} />
              </PlanningCell>
              <PlanningCell label="Per Day Cost">
                <input className="project-modal-control" type="number" value={row.estimatedRate} onChange={e => setRows(cur => cur.map(item => item.id === row.id ? { ...item, estimatedRate: Number(e.target.value) || 0 } : item))} />
              </PlanningCell>
              <div className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold dark:bg-zinc-950">
                <span className="md:hidden block text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Estimated Cost</span>
                <span className="mt-1 block">{formatCurrency(castRowTotal(row), currency)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-duplicate px-3" onClick={() => setRows(cur => {
                  const index = cur.findIndex(item => item.id === row.id)
                  if (index < 0) return cur
                  const next = [...cur]
                  next.splice(index + 1, 0, { ...row, id: crypto.randomUUID() })
                  return next
                })}>Duplicate</button>
                <button type="button" className="btn-danger px-3" onClick={() => setRows(cur => cur.filter(item => item.id !== row.id))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <SummaryTotal label="Grand Total" amount={rows.reduce((sum, row) => sum + castRowTotal(row), 0)} currency={currency} />
    </div>
  )
}

function ExpenseStep({
  departments,
  setDepartments,
  expandedDepartmentId,
  setExpandedDepartmentId,
  currency,
  onPersist,
}: {
  departments: ExpenseDepartment[]
  setDepartments: React.Dispatch<React.SetStateAction<ExpenseDepartment[]>>
  expandedDepartmentId: string | null
  setExpandedDepartmentId: React.Dispatch<React.SetStateAction<string | null>>
  currency: ProjectCurrency
  onPersist: (nextDepartments: ExpenseDepartment[], previousDepartments: ExpenseDepartment[]) => void | Promise<void>
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const departmentRenameBaselineRef = useRef<Record<string, string>>({})
  const departmentNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [pendingDepartmentFocusId, setPendingDepartmentFocusId] = useState<string | null>(null)
  const cancelRenameCommitRef = useRef<string | null>(null)

  function normalizeDepartmentOrder(nextDepartments: ExpenseDepartment[]) {
    return nextDepartments.map((department, departmentIndex) => ({
      ...department,
      sortOrder: departmentIndex,
      items: department.items.map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex,
      })),
    }))
  }

  function commitDepartments(nextDepartments: ExpenseDepartment[], previousDepartments: ExpenseDepartment[]) {
    const normalized = normalizeDepartmentOrder(nextDepartments)
    setDepartments(normalized)
    void Promise.resolve(onPersist(normalized, previousDepartments)).catch(() => undefined)
  }

  useEffect(() => {
    if (!pendingDepartmentFocusId) return
    const input = departmentNameInputRefs.current[pendingDepartmentFocusId]
    if (!input) return
    input.focus()
    input.select()
    setPendingDepartmentFocusId(null)
  }, [pendingDepartmentFocusId, departments])

  function findDepartmentByItemId(itemId: string) {
    return departments.find(department => department.items.some(item => item.id === itemId)) ?? null
  }

  function moveDepartment(previousDepartments: ExpenseDepartment[], activeId: string, overId: string) {
    const oldIndex = previousDepartments.findIndex(department => department.id === activeId)
    const newIndex = previousDepartments.findIndex(department => department.id === overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return previousDepartments
    }
    return arrayMove(previousDepartments, oldIndex, newIndex)
  }

  function moveItemsWithinDepartment(previousDepartments: ExpenseDepartment[], departmentId: string, activeItemId: string, overItemId: string) {
    const departmentIndex = previousDepartments.findIndex(department => department.id === departmentId)
    if (departmentIndex < 0) return previousDepartments
    const department = previousDepartments[departmentIndex]
    const oldIndex = department.items.findIndex(item => item.id === activeItemId)
    const newIndex = department.items.findIndex(item => item.id === overItemId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return previousDepartments
    const nextDepartments = [...previousDepartments]
    nextDepartments[departmentIndex] = {
      ...department,
      items: arrayMove(department.items, oldIndex, newIndex),
    }
    return nextDepartments
  }

  function uniqueDepartmentName(baseName: string, excludeId?: string) {
    const existingNames = new Set(
      departments
        .filter(department => department.id !== excludeId)
        .map(department => department.name.trim().toLowerCase()),
    )

    const trimmedBase = baseName.trim() || 'Custom Department'
    if (!existingNames.has(trimmedBase.toLowerCase())) {
      return trimmedBase
    }

    let suffix = 2
    while (existingNames.has(`${trimmedBase} ${suffix}`.toLowerCase())) {
      suffix += 1
    }

    return `${trimmedBase} ${suffix}`
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const previousDepartments = departments

    const activeDepartment = previousDepartments.find(department => department.id === activeId)
    const overDepartment = previousDepartments.find(department => department.id === overId)
    if (activeDepartment && overDepartment) {
      const nextDepartments = moveDepartment(previousDepartments, activeId, overId)
      if (nextDepartments !== previousDepartments) {
        commitDepartments(nextDepartments, previousDepartments)
      }
      return
    }

    const activeItemDepartment = findDepartmentByItemId(activeId)
    const overItemDepartment = findDepartmentByItemId(overId)
    if (!activeItemDepartment || !overItemDepartment || activeItemDepartment.id !== overItemDepartment.id) return

    const nextDepartments = moveItemsWithinDepartment(previousDepartments, activeItemDepartment.id, activeId, overId)
    if (nextDepartments !== previousDepartments) {
      commitDepartments(nextDepartments, previousDepartments)
    }
  }

  function addDepartment() {
    const previousDepartments = departments
    const nextDepartmentId = `dept-custom-${crypto.randomUUID()}`
    const nextDepartmentName = uniqueDepartmentName('Custom Department')
    const nextDepartments = normalizeDepartmentOrder([
      ...previousDepartments,
      {
        id: nextDepartmentId,
        name: nextDepartmentName,
        moduleKey: 'custom',
        isCustom: true,
        sortOrder: previousDepartments.length,
        items: [],
      },
    ])
    setExpandedDepartmentId(nextDepartmentId)
    setPendingDepartmentFocusId(nextDepartmentId)
    commitDepartments(nextDepartments, previousDepartments)
  }

  function addItem(departmentId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department =>
      department.id === departmentId
        ? { ...department, items: [...department.items, newExpenseItem('Line Item', department.items.length)] }
        : department,
    ))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function duplicateItem(departmentId: string, itemId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department => {
      if (department.id !== departmentId) return department
      const itemIndex = department.items.findIndex(item => item.id === itemId)
      if (itemIndex < 0) return department
      const source = department.items[itemIndex]
      const clone: ExpenseItem = {
        ...source,
        id: `item-${crypto.randomUUID()}`,
        sortOrder: itemIndex + 1,
      }
      const nextItems = [...department.items]
      nextItems.splice(itemIndex + 1, 0, clone)
      return { ...department, items: nextItems }
    }))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function removeItem(departmentId: string, itemId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.map(department =>
      department.id === departmentId
        ? { ...department, items: department.items.filter(item => item.id !== itemId) }
        : department,
    ))
    commitDepartments(nextDepartments, previousDepartments)
  }

  function removeDepartment(departmentId: string) {
    const previousDepartments = departments
    const nextDepartments = normalizeDepartmentOrder(previousDepartments.filter(department => department.id !== departmentId))
    delete departmentRenameBaselineRef.current[departmentId]
    delete departmentNameInputRefs.current[departmentId]
    setExpandedDepartmentId(current => current === departmentId ? null : current)
    commitDepartments(nextDepartments, previousDepartments)
  }

  function startDepartmentRename(departmentId: string) {
    const department = departments.find(item => item.id === departmentId)
    if (!department) return
    departmentRenameBaselineRef.current[departmentId] = department.name
    setPendingDepartmentFocusId(departmentId)
  }

  function commitDepartmentRename(departmentId: string) {
    const baselineName = departmentRenameBaselineRef.current[departmentId] ?? departments.find(item => item.id === departmentId)?.name ?? 'Department'
    const currentDepartment = departments.find(item => item.id === departmentId)
    if (!currentDepartment) return
    if (cancelRenameCommitRef.current === departmentId) {
      cancelRenameCommitRef.current = null
      return
    }

    const trimmedName = currentDepartment.name.trim()
    if (!trimmedName) {
      showError('Department name cannot be empty.')
      setDepartments(current => current.map(department =>
        department.id === departmentId ? { ...department, name: baselineName } : department,
      ))
      return
    }

    if (trimmedName === baselineName.trim()) {
      departmentRenameBaselineRef.current[departmentId] = trimmedName
      return
    }

    const duplicateExists = departments.some(department =>
      department.id !== departmentId && department.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
    if (duplicateExists) {
      showError('Department names must be unique.')
      setDepartments(current => current.map(department =>
        department.id === departmentId ? { ...department, name: baselineName } : department,
      ))
      return
    }

    const nextDepartments = departments.map(department =>
      department.id === departmentId ? { ...department, name: trimmedName } : department,
    )
    departmentRenameBaselineRef.current[departmentId] = trimmedName
    commitDepartments(nextDepartments, departments)
  }

  function cancelDepartmentRename(departmentId: string) {
    const baselineName = departmentRenameBaselineRef.current[departmentId]
    if (!baselineName) return
    cancelRenameCommitRef.current = departmentId
    const revertedDepartments = departments.map(department =>
      department.id === departmentId ? { ...department, name: baselineName } : department,
    )
    commitDepartments(revertedDepartments, departments)
  }

  function updateDepartmentName(departmentId: string, name: string) {
    setDepartments(current => current.map(department =>
      department.id === departmentId ? { ...department, name } : department,
    ))
  }

  function updateItemField(departmentId: string, itemId: string, updates: Partial<ExpenseItem>) {
    setDepartments(current => current.map(department =>
      department.id === departmentId
        ? {
            ...department,
            items: department.items.map(item => item.id === itemId ? { ...item, ...updates } : item),
          }
        : department,
    ))
  }

  const totalExpense = departments.reduce((sum, department) => sum + departmentTotal(department), 0)
  const totalDepartments = departments.length

  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 className="section-title">Expense Planning</h2>
          <HelpMarker label="Expense Planning" content="Organize the budget by department first, then add the detailed line items underneath each section." />
        </div>
        <button type="button" className="btn-primary" onClick={addDepartment}>+ Create Department</button>
      </div>

      {departments.length === 0 ? (
        <EmptyState icon="receipt_long" title="No departments yet" description="Add a department to start building the budget." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={departments.map(department => department.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {departments.map(department => (
                <ExpenseDepartmentCard
                  key={department.id}
                  department={department}
                  currency={currency}
                  expanded={expandedDepartmentId === department.id}
                  onToggle={() => setExpandedDepartmentId(current => current === department.id ? null : department.id)}
                  onRenameStart={() => startDepartmentRename(department.id)}
                  onRenameCommit={() => commitDepartmentRename(department.id)}
                  onRenameCancel={() => cancelDepartmentRename(department.id)}
                  onRename={name => updateDepartmentName(department.id, name)}
                  nameInputRef={element => {
                    departmentNameInputRefs.current[department.id] = element
                  }}
                  onAddItem={() => addItem(department.id)}
                  onDuplicateItem={itemId => duplicateItem(department.id, itemId)}
                  onRemoveItem={itemId => removeItem(department.id, itemId)}
                  onDeleteDepartment={() => removeDepartment(department.id)}
                  onUpdateItem={(itemId, updates) => updateItemField(department.id, itemId, updates)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Departments" value={String(totalDepartments)} />
        <KpiCard
          label="Planning Progress"
          value={`${departments.reduce((sum, department) => sum + department.items.filter(item => item.isPlanned).length, 0)}/${departments.reduce((sum, department) => sum + department.items.length, 0)}`}
        />
        <SummaryTotal label="Expense Estimate" amount={totalExpense} currency={currency} />
      </div>
    </div>
  )
}

function ExpenseDepartmentCard({
  department,
  currency,
  expanded,
  onToggle,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onRename,
  nameInputRef,
  onAddItem,
  onDuplicateItem,
  onRemoveItem,
  onDeleteDepartment,
  onUpdateItem,
}: {
  department: ExpenseDepartment
  currency: ProjectCurrency
  expanded: boolean
  onToggle: () => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onRename: (name: string) => void
  nameInputRef: (element: HTMLInputElement | null) => void
  onAddItem: () => void
  onDuplicateItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onDeleteDepartment: () => void
  onUpdateItem: (itemId: string, updates: Partial<ExpenseItem>) => void
}) {
  const sortable = useSortable({ id: department.id })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.9 : 1,
    boxShadow: sortable.isDragging ? '0 24px 44px rgba(15, 23, 42, 0.16)' : undefined,
  } as React.CSSProperties

  const bufferCost = departmentBufferTotal(department)
  const total = departmentTotal(department)
  const plannedItemCount = department.items.filter(item => item.isPlanned).length
  const averageItemCost = department.items.length > 0 ? department.items.reduce((sum, item) => sum + itemBaseTotal(item), 0) / department.items.length : 0
  const checklistLabel = department.items.length > 0 ? `Planned ${plannedItemCount}/${department.items.length}` : 'No items yet'
  const summaryLabel = `${formatCurrency(total, currency)} | ${checklistLabel} | Avg ${formatCurrency(averageItemCost, currency)} | Buffer ${formatCurrency(bufferCost, currency)}`

  return (
    <article ref={sortable.setNodeRef} style={style} className={cn('rounded-[24px] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950', sortable.isDragging && 'ring-1 ring-orange-300 dark:ring-orange-500/40')}>
      <div
        className="rounded-[20px] bg-zinc-50 px-4 py-3 dark:bg-zinc-900"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-0.5 inline-flex size-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-500 transition-colors hover:text-orange-500 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-orange-400"
            aria-label={`Drag to reorder ${department.name}`}
            onClick={event => event.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 select-none">
            <div className="flex items-center gap-2">
              {department.isCustom ? (
                <input
                  ref={nameInputRef}
                  value={department.name}
                  onFocus={onRenameStart}
                  onBlur={onRenameCommit}
                  onClick={event => event.stopPropagation()}
                  onChange={event => onRename(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      onRenameCancel()
                      event.currentTarget.blur()
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                  aria-label="Department name"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{department.name}</p>
              )}
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 dark:text-zinc-500', expanded && 'rotate-180')} />
            </div>
            <p className="mt-1 truncate text-xs leading-5 text-zinc-500 dark:text-zinc-400">{summaryLabel}</p>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2" onClick={event => event.stopPropagation()}>
            <button type="button" className="btn-primary px-3" onClick={onAddItem}>Add Item</button>
            <button type="button" className="btn-ghost px-3" onClick={onToggle}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
            <button type="button" className="btn-danger px-3" onClick={onDeleteDepartment}>Delete</button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_0.75fr_1fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span />
            <span />
            <PlanningColumnHeader help="The specific line item inside this department.">Item</PlanningColumnHeader>
            <PlanningColumnHeader help="Number of units expected.">Qty</PlanningColumnHeader>
            <PlanningColumnHeader help="Unit of measurement such as Nos, Days, Hours, or Sets.">Unit</PlanningColumnHeader>
            <PlanningColumnHeader help="Estimated cost per unit.">Rate</PlanningColumnHeader>
            <PlanningColumnHeader help="Number of days the item is rented or used.">No. of Days</PlanningColumnHeader>
            <PlanningColumnHeader help="Extra contingency percentage for this line.">Buffer %</PlanningColumnHeader>
            <PlanningColumnHeader help="Automatically calculated estimate for this line item.">Estimated Total</PlanningColumnHeader>
            <PlanningColumnHeader help="Optional production notes.">Notes</PlanningColumnHeader>
            <PlanningColumnHeader>Actions</PlanningColumnHeader>
          </div>

          <SortableContext items={department.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {department.items.map(item => (
                <ExpenseItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  onDuplicate={() => onDuplicateItem(item.id)}
                  onRemove={() => onRemoveItem(item.id)}
                  onChange={updates => onUpdateItem(item.id, updates)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </article>
  )
}

function ExpenseItemRow({
  item,
  currency,
  onDuplicate,
  onRemove,
  onChange,
}: {
  item: ExpenseItem
  currency: ProjectCurrency
  onDuplicate: () => void
  onRemove: () => void
  onChange: (updates: Partial<ExpenseItem>) => void
}) {
  const sortable = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.88 : 1,
    boxShadow: sortable.isDragging ? '0 18px 38px rgba(15, 23, 42, 0.16)' : undefined,
    zIndex: sortable.isDragging ? 10 : undefined,
  } as React.CSSProperties

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn('grid gap-3 rounded-[24px] bg-zinc-50 p-4 select-none dark:bg-zinc-900 md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_0.75fr_1fr_1fr_auto]', sortable.isDragging && 'ring-1 ring-orange-300 dark:ring-orange-500/40')}
    >
      <div className="flex items-center justify-center md:justify-start">
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40',
            item.isPlanned
              ? 'border-orange-500 bg-orange-500 text-black shadow-[0_0_0_1px_rgba(249,115,22,0.22)] hover:scale-[1.03]'
              : 'border-zinc-300 bg-white text-transparent hover:border-orange-300 hover:text-orange-500 dark:border-zinc-700 dark:bg-zinc-950',
          )}
          aria-pressed={item.isPlanned}
          aria-label={item.isPlanned ? `Mark ${item.item} as unplanned` : `Mark ${item.item} as planned`}
          onClick={event => {
            event.stopPropagation()
            onChange({ isPlanned: !item.isPlanned })
          }}
        >
          <span className="sr-only">{item.isPlanned ? 'Planned' : 'Not planned'}</span>
          {item.isPlanned ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
        </button>
      </div>
      <div className="flex items-center justify-center md:justify-start">
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="inline-flex size-10 shrink-0 touch-none cursor-grab items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-500 transition-colors hover:text-orange-500 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-orange-400"
            aria-label={`Drag to reorder ${item.item}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      <PlanningCell label="Item">
        <input className="project-modal-control" value={item.item} onChange={event => onChange({ item: event.target.value })} />
      </PlanningCell>
      <PlanningCell label="Qty">
        <input className="project-modal-control" type="number" inputMode="decimal" value={item.qty} onChange={event => onChange({ qty: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <PlanningCell label="Unit">
        <input className="project-modal-control" value={item.unit} onChange={event => onChange({ unit: event.target.value })} />
      </PlanningCell>
      <PlanningCell label="Rate">
        <input className="project-modal-control" type="number" inputMode="decimal" value={item.rate} onChange={event => onChange({ rate: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <PlanningCell label="No. of Days">
        <PlanningDaysInput
          value={item.numberOfDays}
          ariaLabel="No. of Days"
          onChange={numberOfDays => onChange({ numberOfDays })}
        />
      </PlanningCell>
      <PlanningCell label="Buffer %">
        <input className="project-modal-control" type="number" inputMode="decimal" value={item.bufferPercent} onChange={event => onChange({ bufferPercent: Number(event.target.value) || 0 })} />
      </PlanningCell>
      <div className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold dark:bg-zinc-950">
        <span className="md:hidden block text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Estimated Total</span>
        <span className="mt-1 block">{formatCurrency(itemTotal(item), currency)}</span>
      </div>
      <PlanningCell label="Notes">
        <input className="project-modal-control" value={item.notes} onChange={event => onChange({ notes: event.target.value })} placeholder="Optional notes" />
      </PlanningCell>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-duplicate px-3" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="btn-danger px-3" onClick={onRemove}>Remove</button>
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

