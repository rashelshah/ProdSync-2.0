import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { SectionSelectorSheet } from '@/components/shared/SectionSelectorSheet'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showSuccess } from '@/lib/toast'
import { formatCurrency, formatDate, timeAgo } from '@/utils'
import { LiquidGlassNavbar } from '@/components/shared/LiquidGlassNavbar'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'
import type { ProjectCurrency } from '@/types'
import { foodBeveragesService } from '../service'
import type {
  FoodBeverageForecastInput,
  FoodBeverageForecastRecord,
  FoodBeverageInvoiceInput,
  FoodBeverageMealLogInput,
  FoodBeveragesTabId,
} from '../types'

const TAB_CONFIG: Array<{
  id: FoodBeveragesTabId
  label: string
  mobileLabel: string
  icon: string
  description: string
}> = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Overview', icon: 'dashboard', description: 'Daily forecast, waste, and cost snapshot.' },
  { id: 'forecasting', label: 'Forecasting', mobileLabel: 'Forecast', icon: 'schedule', description: 'Next-day meal counts and vendor details.' },
  { id: 'meal-logs', label: 'Meal Logs', mobileLabel: 'Meals', icon: 'restaurant', description: 'Actual consumption with linked forecast data.' },
  { id: 'invoices', label: 'Invoices', mobileLabel: 'Invoices', icon: 'receipt_long', description: 'Generated invoices, approvals, and PDF attachments.' },
  { id: 'analytics', label: 'Analytics', mobileLabel: 'Analytics', icon: 'analytics', description: 'Forecast coverage, waste, and cost trends.' },
  { id: 'timeline', label: 'Timeline', mobileLabel: 'Timeline', icon: 'timeline', description: 'Action history and variance alerts.' },
]

const DEPARTMENT_OPTIONS = ['camera', 'art', 'transport', 'direction', 'production', 'wardrobe', 'actors', 'post']
const MEAL_PERIOD_OPTIONS: Array<FoodBeverageMealLogInput['mealPeriod']> = ['breakfast', 'lunch', 'dinner', 'snacks']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowIso() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function labelize(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mealPeriodLabel(value: string | null) {
  return value ? labelize(value) : 'All Day'
}

function badgeVariant(status: string) {
  switch (status) {
    case 'approved':
    case 'submitted':
      return 'approved'
    case 'estimated':
    case 'warning':
      return 'warning'
    case 'critical':
    case 'rejected':
      return 'rejected'
    default:
      return 'stable'
  }
}

function resolveProjectCurrency(value: string | null | undefined): ProjectCurrency | undefined {
  if (value === 'INR' || value === 'USD' || value === 'EUR') return value
  return undefined
}

function tabFromValue(value: string | null, visibleTabs: FoodBeveragesTabId[]) {
  const candidate = value as FoodBeveragesTabId | null
  if (candidate && visibleTabs.includes(candidate)) return candidate
  return visibleTabs[0]
}

function toPositiveNumber(value: number | null | undefined) {
  return Math.max(0, Number.isFinite(value ?? NaN) ? Number(value) : 0)
}

function Field({
  label,
  children,
  hint,
  required = false,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <label className="space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
        {label}
        {required && <span className="ml-1 text-red-500 dark:text-red-400">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs leading-5 text-[color:var(--app-muted)]">{hint}</p>}
    </label>
  )
}

function LoadingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
    </span>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`} />
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`} />
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-orange-500 ${props.className ?? ''}`} />
}

function ActionButton({
  label,
  icon,
  onClick,
  loading = false,
  disabled = false,
  tone = 'default',
  type = 'button',
}: {
  label: string
  icon: string
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  tone?: 'default' | 'danger'
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
        tone === 'danger'
          ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-orange-200 hover:bg-orange-50 dark:hover:bg-zinc-900'
      } ${(disabled || loading) ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {loading ? (
        <LoadingDots />
      ) : (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
      {label}
    </button>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Surface variant="raised" padding="md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{title}</p>
            {subtitle && <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </Surface>
  )
}

export function FoodBeveragesView() {
  const queryClient = useQueryClient()
  const { activeProjectId, activeProject, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const user = useAuthStore(state => state.user)
  const isForecastOnly = user?.role === 'HOD'
  const visibleTabs = useMemo(() => (isForecastOnly ? ['forecasting'] as FoodBeveragesTabId[] : TAB_CONFIG.map(tab => tab.id)), [isForecastOnly])
  const visibleTabConfig = useMemo(() => TAB_CONFIG.filter(tab => visibleTabs.includes(tab.id)), [visibleTabs])
  const [searchParams, setSearchParams] = useSearchParams()
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false)
  const [switchingTab, setSwitchingTab] = useState<FoodBeveragesTabId | null>(null)
  const [forecastDraft, setForecastDraft] = useState<FoodBeverageForecastInput>({
    projectId: activeProjectId ?? '',
    forecastDate: tomorrowIso(),
    department: 'production',
    expectedCrewCount: 0,
    vegCount: 0,
    nonVegCount: 0,
    eggCount: 0,
    jainCount: 0,
    veganCount: 0,
    medicalCount: 0,
    vendorName: '',
    vendorContactNumber: '',
    mealPeriod: null,
    notes: '',
  })
  const [mealDraft, setMealDraft] = useState<FoodBeverageMealLogInput>({
    projectId: activeProjectId ?? '',
    mealDate: todayIso(),
    department: 'production',
    mealPeriod: 'lunch',
    forecastId: null,
    forecastCount: 0,
    actualPeopleServed: 0,
    mealsServed: 0,
    unusedPlates: 0,
    wasteCount: 0,
    wastedMeals: 0,
    plateCost: 0,
    extraExpense: 0,
    expenseNotes: '',
    vendorId: null,
    vendorName: '',
    vendorContactNumber: '',
    notes: '',
  })
  const [invoiceDraft, setInvoiceDraft] = useState<FoodBeverageInvoiceInput>({
    projectId: activeProjectId ?? '',
    mealLogId: null,
    forecastId: null,
    vendorId: null,
    vendorName: '',
    vendorContactNumber: '',
    department: '',
    mealPeriod: null,
    forecastCount: 0,
    actualPeopleServed: 0,
    plateCost: 0,
    extraCost: 0,
    totalCost: 0,
    varianceCount: 0,
    invoiceNumber: '',
    invoiceDate: todayIso(),
    amount: 0,
    currencyCode: 'INR',
    approvalRequested: true,
    status: 'submitted',
    notes: '',
    expenseNotes: '',
    generatedFromMealLog: false,
  })
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null)
  const [invoiceEditingId, setInvoiceEditingId] = useState<string | null>(null)
  const [invoicePreview, setInvoicePreview] = useState<{
    invoiceId: string
    invoiceNumber: string
    url: string | null
    loading: boolean
    error: string | null
  } | null>(null)
  const invoicePreviewFrameRef = useRef<HTMLIFrameElement | null>(null)
  const invoicePreviewRequestRef = useRef(0)

  const { navRef: bottomNavRef, companionRef: floatingActionsRef } = useMobileScrollHide()

  useEffect(() => {
    if (!activeProjectId) return
    setForecastDraft(current => ({ ...current, projectId: activeProjectId }))
    setMealDraft(current => ({ ...current, projectId: activeProjectId }))
    setInvoiceDraft(current => ({ ...current, projectId: activeProjectId }))
  }, [activeProjectId])

  const selectedTab = tabFromValue(searchParams.get('tab'), visibleTabs)

  useEffect(() => {
    const rawTab = searchParams.get('tab')
    if (!rawTab || !visibleTabs.includes(rawTab as FoodBeveragesTabId)) {
      setSearchParams(params => {
        params.set('tab', visibleTabs[0])
        return params
      }, { replace: true })
    }
  }, [searchParams, setSearchParams, visibleTabs])

  useEffect(() => {
    if (!switchingTab) return
    const timer = window.setTimeout(() => setSwitchingTab(null), 180)
    return () => window.clearTimeout(timer)
  }, [switchingTab, selectedTab])

  const overviewQ = useQuery({
    queryKey: ['food-beverages-overview', activeProjectId],
    queryFn: () => foodBeveragesService.getOverview(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const forecastsQ = useQuery({
    queryKey: ['food-beverages-forecasts', activeProjectId, forecastDraft.forecastDate],
    queryFn: () => foodBeveragesService.getForecasts(activeProjectId!, forecastDraft.forecastDate),
    enabled: Boolean(activeProjectId),
    staleTime: 20_000,
  })
  const mealForecastsQ = useQuery({
    queryKey: ['food-beverages-forecasts', activeProjectId, mealDraft.mealDate],
    queryFn: () => foodBeveragesService.getForecasts(activeProjectId!, mealDraft.mealDate),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const mealLogsQ = useQuery({
    queryKey: ['food-beverages-meal-logs', activeProjectId, mealDraft.mealDate],
    queryFn: () => foodBeveragesService.getMealLogs(activeProjectId!, mealDraft.mealDate),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const analyticsQ = useQuery({
    queryKey: ['food-beverages-analytics', activeProjectId],
    queryFn: () => foodBeveragesService.getAnalytics(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 30_000,
  })
  const timelineQ = useQuery({
    queryKey: ['food-beverages-timeline', activeProjectId],
    queryFn: () => foodBeveragesService.getTimeline(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const alertsQ = useQuery({
    queryKey: ['food-beverages-alerts', activeProjectId],
    queryFn: () => foodBeveragesService.getAlerts(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const invoicesQ = useQuery({
    queryKey: ['food-beverages-invoices', activeProjectId],
    queryFn: () => foodBeveragesService.getInvoices(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })

  const createForecastMutation = useMutation({
    mutationFn: (payload: FoodBeverageForecastInput) => foodBeveragesService.createForecast(payload),
    onSuccess: async forecast => {
      queryClient.setQueryData<FoodBeverageForecastRecord[]>(
        ['food-beverages-forecasts', activeProjectId, forecast.forecastDate],
        current => {
          const next = (current ?? []).filter(row => row.id !== forecast.id)
          next.push(forecast)
          return next.sort((left, right) => left.department.localeCompare(right.department))
        },
      )
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-forecasts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
      showSuccess('Forecast submitted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not submit the forecast.')),
  })
  const createMealLogMutation = useMutation({
    mutationFn: (payload: FoodBeverageMealLogInput) => foodBeveragesService.createMealLog(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-meal-logs', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-invoices', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
      showSuccess('Meal log saved.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save the meal log.')),
  })
  const createInvoiceMutation = useMutation({
    mutationFn: ({ payload, file, invoiceId }: { payload: FoodBeverageInvoiceInput; file?: File | null; invoiceId?: string | null }) => (
      invoiceId
        ? foodBeveragesService.updateInvoice(invoiceId, payload, file)
        : foodBeveragesService.createInvoice(payload, file)
    ),
    onSuccess: async () => {
      setInvoiceEditingId(null)
      setSelectedInvoiceFile(null)
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-invoices', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
      showSuccess(invoiceEditingId ? 'Invoice updated.' : 'Invoice submitted.')
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save the invoice.')),
  })

  const canManage = !isForecastOnly
  const handleTabSwitch = (tabId: FoodBeveragesTabId) => {
    setSwitchingTab(tabId)
    setSearchParams(params => {
      params.set('tab', tabId)
      return params
    })
  }

  const forecastRows = forecastsQ.data ?? []
  const mealForecastRows = mealForecastsQ.data ?? []
  const mealLogs = mealLogsQ.data ?? []
  const alerts = alertsQ.data ?? []
  const invoices = invoicesQ.data ?? []
  const selectedMealForecast = useMemo(() => {
    if (mealDraft.forecastId) return mealForecastRows.find(forecast => forecast.id === mealDraft.forecastId) ?? null
    return null
  }, [mealDraft.forecastId, mealForecastRows])

  useEffect(() => {
    if (!selectedMealForecast) return
    setMealDraft(current => ({
      ...current,
      forecastId: selectedMealForecast.id,
      department: selectedMealForecast.department,
      mealPeriod: selectedMealForecast.mealPeriod ?? current.mealPeriod,
      forecastCount: selectedMealForecast.expectedCrewCount ?? selectedMealForecast.mealCount,
      vendorName: selectedMealForecast.vendorName ?? '',
      vendorContactNumber: selectedMealForecast.vendorContactNumber ?? '',
    }))
  }, [selectedMealForecast])

  const handleMealForecastChange = (forecastId: string) => {
    const nextForecast = mealForecastRows.find(forecast => forecast.id === forecastId) ?? null
    setMealDraft(current => {
      if (!nextForecast) {
        return { ...current, forecastId: null }
      }

      return {
        ...current,
        forecastId: nextForecast.id,
        department: nextForecast.department,
        mealPeriod: nextForecast.mealPeriod ?? current.mealPeriod,
        forecastCount: nextForecast.expectedCrewCount ?? nextForecast.mealCount,
        vendorName: nextForecast.vendorName ?? '',
        vendorContactNumber: nextForecast.vendorContactNumber ?? '',
      }
    })
  }

  const selectedInvoiceRecord = invoiceEditingId ? invoices.find(invoice => invoice.id === invoiceEditingId) ?? null : null
  const forecastCrewCount = toPositiveNumber(forecastDraft.expectedCrewCount)
  const forecastDietaryTotal = toPositiveNumber(forecastDraft.vegCount) + toPositiveNumber(forecastDraft.nonVegCount) + toPositiveNumber(forecastDraft.eggCount) + toPositiveNumber(forecastDraft.jainCount) + toPositiveNumber(forecastDraft.veganCount) + toPositiveNumber(forecastDraft.medicalCount)
  const forecastOverflow = Math.max(forecastDietaryTotal - forecastCrewCount, 0)
  const forecastRemaining = Math.max(forecastCrewCount - forecastDietaryTotal, 0)
  const loadingTabs = selectedTab === 'overview'
    ? overviewQ.isLoading
    : selectedTab === 'forecasting'
      ? forecastsQ.isLoading
      : selectedTab === 'meal-logs'
        ? mealLogsQ.isLoading
        : selectedTab === 'invoices'
          ? invoicesQ.isLoading
          : selectedTab === 'analytics'
            ? analyticsQ.isLoading
            : timelineQ.isLoading
  const isRequestPending = createForecastMutation.isPending || createMealLogMutation.isPending || createInvoiceMutation.isPending

  useEffect(() => {
    return () => {
      if (invoicePreview?.url) {
        window.URL.revokeObjectURL(invoicePreview.url)
      }
    }
  }, [invoicePreview?.url])

  const openInvoicePreview = async (invoiceId: string, invoiceNumber: string) => {
    if (!activeProjectId) return
    const requestId = invoicePreviewRequestRef.current + 1
    invoicePreviewRequestRef.current = requestId
    setInvoicePreview({ invoiceId, invoiceNumber, url: null, loading: true, error: null })

    try {
      const { blob } = await foodBeveragesService.getInvoicePdf(invoiceId, activeProjectId)
      if (invoicePreviewRequestRef.current !== requestId) return
      const url = window.URL.createObjectURL(blob)
      setInvoicePreview({ invoiceId, invoiceNumber, url, loading: false, error: null })
    } catch (error) {
      if (invoicePreviewRequestRef.current !== requestId) return
      setInvoicePreview({ invoiceId, invoiceNumber, url: null, loading: false, error: resolveErrorMessage(error, 'Could not load the invoice PDF.') })
    }
  }

  const closeInvoicePreview = () => {
    setInvoicePreview(current => {
      if (current?.url) {
        window.URL.revokeObjectURL(current.url)
      }
      return null
    })
  }

  const downloadInvoicePreview = async (invoiceId: string) => {
    if (!activeProjectId) return
    try {
      await foodBeveragesService.downloadInvoicePdf(invoiceId, activeProjectId)
    } catch (error) {
      showError(resolveErrorMessage(error, 'Could not download the invoice PDF.'))
    }
  }

  if (isLoadingProjectContext) {
    return <PageLoader open message="Loading food and beverages workspace..." />
  }

  if (isErrorProjectContext || !activeProjectId) {
    return <ErrorState message="Project context is unavailable." retry={() => window.location.reload()} />
  }

  if (overviewQ.isError || forecastsQ.isError || mealLogsQ.isError || analyticsQ.isError || timelineQ.isError || alertsQ.isError || invoicesQ.isError) {
    return <ErrorState message="Could not load the Food & Beverages workspace." retry={() => window.location.reload()} />
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] pb-56 md:pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between hidden md:flex">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-muted)]">Food &amp; Beverages</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[color:var(--app-text)]">Catering control, forecasting, and cost accountability.</h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
              Keep the catering team honest, prevent waste, and give production a clear forecast before the next meal is cooked for {activeProject?.name ?? 'this project'}.
            </p>
          </div>
        </div>

        <div className="md:hidden w-full relative z-10 pt-2 pb-2">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
            <span className="page-kicker text-orange-500">Food & Beverages</span>
            <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Catering & Costs</h1>
            <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">Manage daily forecasts, actuals, and vendor invoices.</p>
          </div>
        </div>

        <Surface variant="table" padding="md" className="mt-6 hidden md:block">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Workspace Sections</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Switch tabs without sticky navigation or horizontal scroll.</p>
              </div>
                <button
                  type="button"
                  onClick={() => setSectionSheetOpen(true)}
                  disabled={isRequestPending}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text)] transition hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
                >
                <span className="material-symbols-outlined text-[16px]">{TAB_CONFIG.find(tab => tab.id === selectedTab)?.icon ?? 'dashboard'}</span>
                {TAB_CONFIG.find(tab => tab.id === selectedTab)?.mobileLabel ?? 'Overview'}
                <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 md:flex">
              {visibleTabConfig.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    selectedTab === tab.id
                      ? 'bg-orange-50 text-orange-600 shadow-[0_10px_24px_rgba(249,115,22,0.14)] dark:bg-orange-500/12 dark:text-orange-400'
                      : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface)]'
                  }`}
                  disabled={switchingTab !== null || isRequestPending}
                >
                  {switchingTab === tab.id ? <LoadingDots /> : <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>}
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingTabs && (
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                <LoadingDots />
                Loading section...
              </div>
            )}
          </div>
        </Surface>

        {selectedTab === 'overview' && canManage && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <KpiCard label="Today's Forecast" value={String(overviewQ.data?.todaysForecast ?? 0)} subLabel="Meals scheduled" />
              <KpiCard label="Meals Served" value={String(overviewQ.data?.mealsServed ?? 0)} subLabel="Actual consumption" />
              <KpiCard label="Variance" value={String(overviewQ.data?.variance ?? 0)} subLabel="Forecast minus served" />
              <KpiCard label="Waste %" value={`${overviewQ.data?.wastePercent?.toFixed(1) ?? '0.0'}%`} subLabel="Waste reduction tracker" />
              <KpiCard label="Cost Today" value={formatCurrency(overviewQ.data?.costToday ?? 0, activeProject?.currency ?? 'INR')} subLabel="Invoice cost today" />
              <KpiCard label="Monthly Burn" value={formatCurrency(overviewQ.data?.monthlyBurn ?? 0, activeProject?.currency ?? 'INR')} subLabel="Invoice spend this month" />
            </div>

            <SectionCard title="Production Alerts" subtitle="Highlight the issues that need attention before the next meal window.">
              {overviewQ.data?.alerts.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {overviewQ.data.alerts.map(alert => (
                    <Surface key={alert.id} variant="muted" padding="md">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.title}</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{alert.message}</p>
                        </div>
                        <StatusBadge variant={badgeVariant(alert.severity)} label={labelize(alert.severity)} />
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="verified" title="No active alerts" description="Forecasts and meal logs are aligned right now." />
              )}
            </SectionCard>

            <SectionCard title="Recent Activity" subtitle="Audit-safe timeline of the latest food operations.">
              {overviewQ.data?.recentActivity.length ? (
                <div className="space-y-3">
                  {overviewQ.data.recentActivity.map(entry => (
                    <Surface key={entry.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{entry.summary}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{entry.actorUserName ?? 'ProdSync User'} - {timeAgo(entry.createdAt)}</p>
                        </div>
                        <StatusBadge variant="stable" label={labelize(entry.action)} />
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="timeline" title="No activity yet" description="Forecasts, meal logs, and invoice changes will appear here." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'forecasting' && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Next-Day Forecast" subtitle="Department heads should be able to submit in under 10 seconds.">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Forecast Date" required>
                  <Input type="date" value={forecastDraft.forecastDate} onChange={event => setForecastDraft(current => ({ ...current, forecastDate: event.target.value }))} />
                </Field>
                <Field label="Department" required>
                  <Select value={forecastDraft.department} onChange={event => setForecastDraft(current => ({ ...current, department: event.target.value }))}>
                    {DEPARTMENT_OPTIONS.map(option => <option key={option} value={option}>{labelize(option)}</option>)}
                  </Select>
                </Field>
                <Field label="Expected Crew Count">
                  <Input type="number" min="0" value={forecastDraft.expectedCrewCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, expectedCrewCount: Number(event.target.value) }))} />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Vegetarian"><Input type="number" min="0" value={forecastDraft.vegCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, vegCount: Number(event.target.value) }))} /></Field>
                <Field label="Non-Veg"><Input type="number" min="0" value={forecastDraft.nonVegCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, nonVegCount: Number(event.target.value) }))} /></Field>
                <Field label="Egg"><Input type="number" min="0" value={forecastDraft.eggCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, eggCount: Number(event.target.value) }))} /></Field>
                <Field label="Jain"><Input type="number" min="0" value={forecastDraft.jainCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, jainCount: Number(event.target.value) }))} /></Field>
                <Field label="Vegan"><Input type="number" min="0" value={forecastDraft.veganCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, veganCount: Number(event.target.value) }))} /></Field>
                <Field label="Medical / Special"><Input type="number" min="0" value={forecastDraft.medicalCount ?? 0} onChange={event => setForecastDraft(current => ({ ...current, medicalCount: Number(event.target.value) }))} /></Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-2">
                <Field label="Vendor Name"><Input value={forecastDraft.vendorName ?? ''} onChange={event => setForecastDraft(current => ({ ...current, vendorName: event.target.value }))} /></Field>
                <Field label="Vendor Contact Number"><Input value={forecastDraft.vendorContactNumber ?? ''} onChange={event => setForecastDraft(current => ({ ...current, vendorContactNumber: event.target.value }))} /></Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Notes" hint="Optional context for catering and production management.">
                  <Textarea rows={3} value={forecastDraft.notes ?? ''} onChange={event => setForecastDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <div className="hidden md:flex items-end">
                  <ActionButton
                    label="Submit Forecast"
                    icon="send"
                    loading={createForecastMutation.isPending}
                    disabled={forecastOverflow > 0}
                    onClick={() => {
                      if (!forecastDraft.forecastDate.trim() || !forecastDraft.department.trim() || !Number.isFinite(forecastCrewCount) || forecastCrewCount <= 0) {
                        showError('Please fill the required fields before submitting the forecast.')
                        return
                      }
                      if (forecastOverflow > 0) {
                        showError('Dietary counts must not exceed the expected crew count.')
                        return
                      }
                      createForecastMutation.mutate({
                        ...forecastDraft,
                        projectId: activeProjectId,
                        expectedCrewCount: forecastCrewCount,
                        vegCount: Number(forecastDraft.vegCount) || 0,
                        nonVegCount: Number(forecastDraft.nonVegCount) || 0,
                        eggCount: Number(forecastDraft.eggCount) || 0,
                        jainCount: Number(forecastDraft.jainCount) || 0,
                        veganCount: Number(forecastDraft.veganCount) || 0,
                        medicalCount: Number(forecastDraft.medicalCount) || 0,
                        vendorName: forecastDraft.vendorName?.trim() || undefined,
                        vendorContactNumber: forecastDraft.vendorContactNumber?.trim() || undefined,
                        notes: forecastDraft.notes?.trim() || undefined,
                      })
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                <Surface variant="muted" padding="sm" className="md:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Crew Count</p>
                  <p className="mt-1 md:mt-2 text-xl md:text-2xl font-semibold text-zinc-900 dark:text-white">{forecastCrewCount}</p>
                </Surface>
                <Surface variant="muted" padding="sm" className="md:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Dietary Total</p>
                  <p className={`mt-1 md:mt-2 text-xl md:text-2xl font-semibold ${forecastOverflow > 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{forecastDietaryTotal}</p>
                </Surface>
                <Surface variant="muted" padding="sm" className="md:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Remaining</p>
                  <p className="mt-1 md:mt-2 text-xl md:text-2xl font-semibold text-zinc-900 dark:text-white">{forecastRemaining}</p>
                </Surface>
                <Surface variant="muted" padding="sm" className="md:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Validation</p>
                  <p className={`mt-1 md:mt-2 text-xs md:text-sm font-semibold ${forecastOverflow > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{forecastOverflow > 0 ? `${forecastOverflow} over limit` : 'Within crew count'}</p>
                </Surface>
              </div>
            </SectionCard>

            <SectionCard title="Forecast Ledger" subtitle="Submitted forecasts and estimated fallback values for the next meal cycle.">
              {forecastRows.length ? (
                <>
                  <div className="hidden md:block overflow-hidden rounded-[26px] border border-zinc-200 dark:border-zinc-800">
                    <div className="grid grid-cols-12 bg-zinc-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      <div className="col-span-3">Department</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Crew</div>
                      <div className="col-span-2">Period</div>
                      <div className="col-span-3">Status</div>
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {forecastRows.map(row => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                          <div className="col-span-3 font-medium text-zinc-900 dark:text-white">{labelize(row.department)}</div>
                          <div className="col-span-2 text-zinc-500 dark:text-zinc-400">{formatDate(row.forecastDate)}</div>
                          <div className="col-span-2 text-zinc-900 dark:text-white">{row.expectedCrewCount ?? row.mealCount}</div>
                          <div className="col-span-2 text-zinc-500 dark:text-zinc-400">{mealPeriodLabel(row.mealPeriod)}</div>
                          <div className="col-span-3 flex flex-wrap items-center gap-2">
                            <StatusBadge variant={row.isEstimated ? 'warning' : 'approved'} label={row.isEstimated ? 'Estimated' : 'Submitted'} />
                            <span className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{row.submittedByName ?? 'System'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:hidden grid grid-cols-2 gap-3">
                    {forecastRows.map(row => (
                      <Surface key={row.id} variant="muted" padding="sm" className="md:p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1.5 items-start justify-between">
                            <span className="font-semibold text-zinc-900 dark:text-white">{labelize(row.department)}</span>
                            <StatusBadge variant={row.isEstimated ? 'warning' : 'approved'} label={row.isEstimated ? 'Estimated' : 'Submitted'} />
                          </div>
                          <div className="flex flex-col gap-1 items-start justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            <span>{formatDate(row.forecastDate)}</span>
                            <span>{mealPeriodLabel(row.mealPeriod)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
                            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">Crew/By</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-medium text-sm text-zinc-900 dark:text-white">{row.expectedCrewCount ?? row.mealCount}</span>
                              <span className="text-[9px] uppercase text-zinc-400">{row.submittedByName ?? 'System'}</span>
                            </div>
                          </div>
                        </div>
                      </Surface>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon="schedule" title="No forecasts yet" description="The next forecast will appear here once it is submitted or estimated." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'meal-logs' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Meal Log Entry" subtitle="Record what was actually served and how much was wasted.">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Meal Date" required><Input type="date" value={mealDraft.mealDate} onChange={event => setMealDraft(current => ({ ...current, mealDate: event.target.value }))} /></Field>
                <Field label="Department" required><Select value={mealDraft.department} onChange={event => setMealDraft(current => ({ ...current, department: event.target.value }))}>{DEPARTMENT_OPTIONS.map(option => <option key={option} value={option}>{labelize(option)}</option>)}</Select></Field>
                <Field label="Meal Period" required><Select value={mealDraft.mealPeriod} onChange={event => setMealDraft(current => ({ ...current, mealPeriod: event.target.value as FoodBeverageMealLogInput['mealPeriod'] }))}>{MEAL_PERIOD_OPTIONS.map(option => <option key={option} value={option}>{mealPeriodLabel(option)}</option>)}</Select></Field>
                <Field label="Forecast Link">
                  <Select value={mealDraft.forecastId ?? ''} onChange={event => handleMealForecastChange(event.target.value)}>
                    <option value="">Select a forecast to sync fields</option>
                    {mealForecastRows.map(forecast => (
                      <option key={forecast.id} value={forecast.id}>
                        {formatDate(forecast.forecastDate)} - {labelize(forecast.department)} - {forecast.expectedCrewCount ?? forecast.mealCount}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Forecast Count" required><Input type="number" min="0" value={mealDraft.forecastCount ?? 0} onChange={event => setMealDraft(current => ({ ...current, forecastCount: Number(event.target.value) }))} /></Field>
                <Field label="Actual People Served" required><Input type="number" min="0" value={mealDraft.actualPeopleServed} onChange={event => setMealDraft(current => ({ ...current, actualPeopleServed: Number(event.target.value), mealsServed: Number(event.target.value) }))} /></Field>
                <Field label="Unused Plates"><Input type="number" min="0" value={mealDraft.unusedPlates ?? 0} onChange={event => setMealDraft(current => ({ ...current, unusedPlates: Number(event.target.value) }))} /></Field>
                <Field label="Wasted Meals"><Input type="number" min="0" value={mealDraft.wastedMeals ?? 0} onChange={event => setMealDraft(current => ({ ...current, wastedMeals: Number(event.target.value), wasteCount: Number(event.target.value) }))} /></Field>
                <Field label="Plate Cost"><Input type="number" min="0" value={mealDraft.plateCost ?? 0} onChange={event => setMealDraft(current => ({ ...current, plateCost: Number(event.target.value) }))} /></Field>
                <Field label="Tea / Coffee Expense"><Input type="number" min="0" value={mealDraft.extraExpense ?? 0} onChange={event => setMealDraft(current => ({ ...current, extraExpense: Number(event.target.value) }))} /></Field>
                <Field label="Vendor Name"><Input value={mealDraft.vendorName ?? ''} onChange={event => setMealDraft(current => ({ ...current, vendorName: event.target.value }))} /></Field>
                <Field label="Vendor Contact Number"><Input value={mealDraft.vendorContactNumber ?? ''} onChange={event => setMealDraft(current => ({ ...current, vendorContactNumber: event.target.value }))} /></Field>
              </div>

              {selectedMealForecast && (
                <Surface variant="muted" padding="sm" className="md:p-4 mt-4">
                  <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Forecast Date</p>
                      <p className="mt-1 md:mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatDate(selectedMealForecast.forecastDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Crew Count</p>
                      <p className="mt-1 md:mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedMealForecast.expectedCrewCount ?? selectedMealForecast.mealCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Vendor</p>
                      <p className="mt-1 md:mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedMealForecast.vendorName ?? 'No vendor linked'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Contact</p>
                      <p className="mt-1 md:mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedMealForecast.vendorContactNumber ?? 'Unavailable'}</p>
                    </div>
                  </div>
                </Surface>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Expense Notes">
                  <Textarea rows={3} value={mealDraft.expenseNotes ?? ''} onChange={event => setMealDraft(current => ({ ...current, expenseNotes: event.target.value }))} />
                </Field>
                <div className="hidden md:flex items-end">
                  <ActionButton
                    label="Save Meal Log"
                    icon="save"
                    loading={createMealLogMutation.isPending}
                    onClick={() => {
                      const actualPeopleServed = Number(mealDraft.actualPeopleServed)
                      if (!mealDraft.mealDate.trim() || !mealDraft.department.trim() || !mealDraft.mealPeriod || !Number.isFinite(actualPeopleServed) || actualPeopleServed <= 0) {
                        showError('Please fill the required fields before saving the meal log.')
                        return
                      }

                      createMealLogMutation.mutate({
                        ...mealDraft,
                        projectId: activeProjectId,
                        mealDate: mealDraft.mealDate,
                        department: mealDraft.department,
                        mealPeriod: mealDraft.mealPeriod,
                        forecastId: mealDraft.forecastId ?? null,
                        forecastCount: Number(mealDraft.forecastCount) || 0,
                        actualPeopleServed: Number(mealDraft.actualPeopleServed) || 0,
                        mealsServed: Number(mealDraft.actualPeopleServed) || 0,
                        unusedPlates: Number(mealDraft.unusedPlates) || 0,
                        wasteCount: Number(mealDraft.wastedMeals) || 0,
                        wastedMeals: Number(mealDraft.wastedMeals) || 0,
                        plateCost: Number(mealDraft.plateCost) || 0,
                        extraExpense: Number(mealDraft.extraExpense) || 0,
                        expenseNotes: mealDraft.expenseNotes?.trim() || undefined,
                        notes: mealDraft.notes?.trim() || undefined,
                      })
                    }}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Meal History" subtitle="What the crew actually ate and how much was wasted.">
              {mealLogs.length ? (
                <div className="space-y-3">
                  {mealLogs.map(row => (
                    <Surface key={row.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{labelize(row.department)} - {mealPeriodLabel(row.mealPeriod)}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(row.mealDate)} - {row.vendorName ?? 'No vendor linked'} - {row.createdByName ?? 'ProdSync User'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge variant="approved" label={`${row.mealsServed} served`} />
                          <StatusBadge variant={row.wasteCount > 10 ? 'warning' : 'stable'} label={`${row.wasteCount} waste`} />
                        </div>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="restaurant" title="No meal logs yet" description="Meal logs appear after catering counts are saved." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'invoices' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Generated Invoices" subtitle="Meal logs automatically create draft invoices that can be reviewed, approved, rejected, exported, or updated with a PDF attachment.">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Meal Log">
                  <Select
                    value={invoiceDraft.mealLogId ?? ''}
                    onChange={event => {
                      const mealLog = mealLogs.find(row => row.id === event.target.value) ?? null
                      setInvoiceDraft(current => ({
                        ...current,
                        mealLogId: event.target.value || null,
                        forecastId: mealLog?.forecastId ?? current.forecastId ?? null,
                        vendorId: mealLog?.vendorId ?? current.vendorId ?? null,
                        vendorName: mealLog?.vendorName ?? current.vendorName ?? '',
                        vendorContactNumber: mealLog?.vendorContactNumber ?? current.vendorContactNumber ?? '',
                        department: mealLog?.department ?? current.department ?? '',
                        mealPeriod: mealLog?.mealPeriod ?? current.mealPeriod ?? null,
                        forecastCount: mealLog?.forecastCount ?? current.forecastCount ?? 0,
                        actualPeopleServed: mealLog?.actualPeopleServed ?? current.actualPeopleServed ?? 0,
                        plateCost: mealLog?.plateCost ?? current.plateCost ?? 0,
                        extraCost: mealLog?.extraCost ?? current.extraCost ?? 0,
                        totalCost: mealLog?.totalMealCost ?? current.totalCost ?? 0,
                        varianceCount: mealLog?.varianceCount ?? current.varianceCount ?? 0,
                        invoiceDate: mealLog?.mealDate ?? current.invoiceDate,
                        amount: mealLog?.totalMealCost ?? current.amount ?? 0,
                        generatedFromMealLog: Boolean(mealLog),
                        approvalRequested: true,
                        status: 'submitted',
                        invoiceNumber: mealLog ? `INV-${mealLog.mealDate.replace(/-/g, '')}-${mealLog.department.slice(0, 4).toUpperCase()}-${mealLog.mealPeriod.slice(0, 3).toUpperCase()}-${mealLog.id.slice(0, 8).toUpperCase()}` : current.invoiceNumber,
                      }))
                    }}
                  >
                    <option value="">Select meal log</option>
                    {mealLogs.map(mealLog => (
                      <option key={mealLog.id} value={mealLog.id}>
                        {formatDate(mealLog.mealDate)} - {labelize(mealLog.department)} - {mealPeriodLabel(mealLog.mealPeriod)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Invoice Number" required><Input value={invoiceDraft.invoiceNumber} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceNumber: event.target.value }))} /></Field>
                <Field label="Invoice Date" required><Input type="date" value={invoiceDraft.invoiceDate} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceDate: event.target.value }))} /></Field>
                <Field label="Amount" required><Input type="number" min="0" value={invoiceDraft.amount} onChange={event => setInvoiceDraft(current => ({ ...current, amount: Number(event.target.value) }))} /></Field>
                <Field label="Currency"><Input value={invoiceDraft.currencyCode ?? 'INR'} onChange={event => setInvoiceDraft(current => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} /></Field>
                <Field label="Approval Requested">
                  <Select value={invoiceDraft.approvalRequested ? 'true' : 'false'} onChange={event => setInvoiceDraft(current => ({ ...current, approvalRequested: event.target.value === 'true' }))}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </Field>
                <Field label="Attachment">
                  <Input type="file" accept="application/pdf,image/*" onChange={event => setSelectedInvoiceFile(event.target.files?.[0] ?? null)} />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Notes">
                  <Textarea rows={3} value={invoiceDraft.notes ?? ''} onChange={event => setInvoiceDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <div className="hidden md:flex items-end">
                  <ActionButton
                    label={invoiceEditingId ? 'Update Invoice' : 'Submit Invoice'}
                    icon={invoiceEditingId ? 'save' : 'send'}
                    loading={createInvoiceMutation.isPending}
                    onClick={() => {
                      const amount = Number(invoiceDraft.amount)
                      if (!invoiceDraft.invoiceNumber.trim() || !invoiceDraft.invoiceDate.trim() || !Number.isFinite(amount) || amount < 0) {
                        showError('Please fill the required fields before submitting the invoice.')
                        return
                      }

                      createInvoiceMutation.mutate({
                        invoiceId: invoiceEditingId,
                        file: selectedInvoiceFile,
                        payload: {
                          ...invoiceDraft,
                          projectId: activeProjectId,
                          mealLogId: invoiceDraft.mealLogId || undefined,
                          forecastId: invoiceDraft.forecastId || undefined,
                          vendorId: invoiceDraft.vendorId || undefined,
                          vendorName: invoiceDraft.vendorName?.trim() || undefined,
                          vendorContactNumber: invoiceDraft.vendorContactNumber?.trim() || undefined,
                          department: invoiceDraft.department?.trim() || undefined,
                          notes: invoiceDraft.notes?.trim() || undefined,
                          expenseNotes: invoiceDraft.expenseNotes?.trim() || undefined,
                          currencyCode: (invoiceDraft.currencyCode ?? 'INR').toUpperCase(),
                        },
                      })
                    }}
                  />
                </div>
              </div>

              {invoiceEditingId && selectedInvoiceRecord && (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">Editing {selectedInvoiceRecord.invoiceNumber}</p>
                  <ActionButton
                    label="Cancel Edit"
                    icon="close"
                    onClick={() => {
                      setInvoiceEditingId(null)
                      setSelectedInvoiceFile(null)
                      setInvoiceDraft({
                        projectId: activeProjectId ?? '',
                        mealLogId: null,
                        forecastId: null,
                        vendorId: null,
                        vendorName: '',
                        vendorContactNumber: '',
                        department: '',
                        mealPeriod: null,
                        forecastCount: 0,
                        actualPeopleServed: 0,
                        plateCost: 0,
                        extraCost: 0,
                        totalCost: 0,
                        varianceCount: 0,
                        invoiceNumber: '',
                        invoiceDate: todayIso(),
                        amount: 0,
                        currencyCode: 'INR',
                        approvalRequested: true,
                        status: 'submitted',
                        notes: '',
                        expenseNotes: '',
                        generatedFromMealLog: false,
                      })
                    }}
                  />
                </div>
              )}

              <div className="mt-6 space-y-3">
                {invoices.length ? invoices.map(invoice => {
                  const currency = resolveProjectCurrency(invoice.currencyCode) ?? activeProject?.currency
                  return (
                    <Surface key={invoice.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{invoice.invoiceNumber}</p>
                            <StatusBadge variant={badgeVariant(invoice.status)} label={labelize(invoice.status)} />
                            <StatusBadge variant={invoice.approvalRequested ? 'warning' : 'stable'} label={invoice.approvalRequested ? 'Approval Requested' : 'No Approval'} />
                          </div>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            {invoice.vendorName ?? 'Unknown vendor'} - {formatDate(invoice.invoiceDate)} - {formatCurrency(invoice.amount, currency)}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                            {invoice.generatedFromMealLog ? 'Generated from meal log' : 'Manual invoice'} - {invoice.department ?? 'No department'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionButton
                            label="View"
                            icon="visibility"
                            disabled={invoicePreview?.loading === true}
                            onClick={() => void openInvoicePreview(invoice.id, invoice.invoiceNumber)}
                          />
                          <ActionButton
                            label="Download"
                            icon="download"
                            disabled={invoicePreview?.loading === true}
                            onClick={() => void downloadInvoicePreview(invoice.id)}
                          />
                          <ActionButton
                            label="Edit"
                            icon="edit"
                            disabled={createInvoiceMutation.isPending || isRequestPending}
                            onClick={() => {
                              setInvoiceEditingId(invoice.id)
                              setSelectedInvoiceFile(null)
                              setInvoiceDraft(current => ({
                                ...current,
                                mealLogId: invoice.mealLogId,
                                forecastId: invoice.forecastId,
                                vendorId: invoice.vendorId,
                                vendorName: invoice.vendorName ?? '',
                                vendorContactNumber: invoice.vendorContactNumber ?? '',
                                department: invoice.department ?? '',
                                mealPeriod: invoice.mealPeriod,
                                forecastCount: invoice.forecastCount,
                                actualPeopleServed: invoice.actualPeopleServed,
                                plateCost: invoice.plateCost,
                                extraCost: invoice.extraCost,
                                totalCost: invoice.totalCost,
                                varianceCount: invoice.varianceCount,
                                invoiceNumber: invoice.invoiceNumber,
                                invoiceDate: invoice.invoiceDate,
                                amount: invoice.amount,
                                currencyCode: invoice.currencyCode,
                                approvalRequested: invoice.approvalRequested,
                                status: invoice.status,
                                notes: invoice.notes ?? '',
                                expenseNotes: invoice.expenseNotes ?? '',
                                generatedFromMealLog: invoice.generatedFromMealLog,
                              }))
                            }}
                          />
                          <ActionButton
                            label="Approve"
                            icon="check"
                            disabled={createInvoiceMutation.isPending || invoice.status === 'approved'}
                            onClick={() => createInvoiceMutation.mutate({
                              invoiceId: invoice.id,
                              payload: {
                                projectId: activeProjectId,
                                mealLogId: invoice.mealLogId ?? undefined,
                                forecastId: invoice.forecastId ?? undefined,
                                vendorId: invoice.vendorId ?? undefined,
                                vendorName: invoice.vendorName ?? undefined,
                                vendorContactNumber: invoice.vendorContactNumber ?? undefined,
                                department: invoice.department ?? undefined,
                                mealPeriod: invoice.mealPeriod,
                                forecastCount: invoice.forecastCount,
                                actualPeopleServed: invoice.actualPeopleServed,
                                plateCost: invoice.plateCost,
                                extraCost: invoice.extraCost,
                                totalCost: invoice.totalCost,
                                varianceCount: invoice.varianceCount,
                                invoiceNumber: invoice.invoiceNumber,
                                invoiceDate: invoice.invoiceDate,
                                amount: invoice.amount,
                                currencyCode: invoice.currencyCode,
                                approvalRequested: true,
                                status: 'approved',
                                notes: invoice.notes ?? undefined,
                                expenseNotes: invoice.expenseNotes ?? undefined,
                                generatedFromMealLog: invoice.generatedFromMealLog,
                              },
                            })}
                          />
                          <ActionButton
                            label="Reject"
                            icon="close"
                            tone="danger"
                            disabled={createInvoiceMutation.isPending || invoice.status === 'rejected'}
                            onClick={() => createInvoiceMutation.mutate({
                              invoiceId: invoice.id,
                              payload: {
                                projectId: activeProjectId,
                                mealLogId: invoice.mealLogId ?? undefined,
                                forecastId: invoice.forecastId ?? undefined,
                                vendorId: invoice.vendorId ?? undefined,
                                vendorName: invoice.vendorName ?? undefined,
                                vendorContactNumber: invoice.vendorContactNumber ?? undefined,
                                department: invoice.department ?? undefined,
                                mealPeriod: invoice.mealPeriod,
                                forecastCount: invoice.forecastCount,
                                actualPeopleServed: invoice.actualPeopleServed,
                                plateCost: invoice.plateCost,
                                extraCost: invoice.extraCost,
                                totalCost: invoice.totalCost,
                                varianceCount: invoice.varianceCount,
                                invoiceNumber: invoice.invoiceNumber,
                                invoiceDate: invoice.invoiceDate,
                                amount: invoice.amount,
                                currencyCode: invoice.currencyCode,
                                approvalRequested: true,
                                status: 'rejected',
                                notes: invoice.notes ?? undefined,
                                expenseNotes: invoice.expenseNotes ?? undefined,
                                generatedFromMealLog: invoice.generatedFromMealLog,
                              },
                            })}
                          />
                        </div>
                      </div>
                    </Surface>
                  )
                }) : (
                  <EmptyState icon="receipt_long" title="No invoices yet" description="Submitted meal logs generate invoices here for approval, export, and attachment management." />
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {selectedTab === 'analytics' && canManage && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <KpiCard label="Coverage Submitted" value={String(analyticsQ.data?.forecastCoverage.submitted ?? 0)} subLabel="Forecast rows" />
              <KpiCard label="Estimated Rows" value={String(analyticsQ.data?.forecastCoverage.estimated ?? 0)} subLabel="Fallback values" />
              <KpiCard label="Forecast Accuracy" value={`${analyticsQ.data?.forecastAccuracy.averageVariancePercent?.toFixed(1) ?? '0.0'}%`} subLabel="Average variance" />
              <KpiCard label="Waste % Avg" value={`${analyticsQ.data?.wasteSummary.averageWastePercent?.toFixed(1) ?? '0.0'}%`} subLabel="Average waste" />
              <KpiCard label="Monthly Burn" value={formatCurrency(analyticsQ.data?.costSummary.monthlyBurn ?? 0, activeProject?.currency ?? 'INR')} subLabel="Food spend this month" />
              <KpiCard label="Cost / Person" value={formatCurrency(analyticsQ.data?.costSummary.costPerPerson ?? 0, activeProject?.currency ?? 'INR')} subLabel="Blended cost per person" />
            </div>

            <SectionCard title="Department Consumption" subtitle="Crew planning and actual consumption side by side.">
              {analyticsQ.data?.departmentConsumption.length ? (
                <div className="space-y-3">
                  {analyticsQ.data.departmentConsumption.map(item => (
                    <Surface key={item.department} variant="muted" padding="md">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{labelize(item.department)}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Cost {formatCurrency(item.totalCost, activeProject?.currency ?? 'INR')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Forecast</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{item.forecastCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Served</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{item.servedCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Variance</p>
                          <p className={`mt-2 text-base font-semibold ${item.varianceCount > 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{item.varianceCount}</p>
                        </div>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="analytics" title="No analytics yet" description="Analytics will populate as forecasts, meal logs, and invoices come in." />
              )}
            </SectionCard>

            <SectionCard title="Vendor Performance" subtitle="Use this to check whether a vendor is keeping up with demand.">
              {analyticsQ.data?.vendorPerformance.length ? (
                <div className="space-y-3">
                  {analyticsQ.data.vendorPerformance.map(vendor => (
                    <Surface key={vendor.vendorName} variant="muted" padding="md">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{vendor.vendorName}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Invoices: {formatCurrency(vendor.invoiceTotal, activeProject?.currency ?? 'INR')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Forecast</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{vendor.forecastCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Served</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{vendor.servedCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Variance</p>
                          <p className={`mt-2 text-base font-semibold ${vendor.variancePercent > 10 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{vendor.variancePercent.toFixed(1)}%</p>
                        </div>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="analytics" title="No vendor performance yet" description="Performance data appears once forecasts, meal logs, and invoices exist." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'timeline' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Variance Alerts" subtitle="Most recent discrepancies from meal forecasting and actual consumption.">
              {alerts.length ? (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <Surface key={alert.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{labelize(alert.department)}</p>
                            <StatusBadge variant={badgeVariant(alert.severity)} label={labelize(alert.severity)} />
                          </div>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{alert.message} {formatDate(alert.alertDate)}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{alert.variancePercent.toFixed(1)}%</p>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="warning" title="No variance alerts" description="If catering starts missing the forecast, it will show up here." />
              )}
            </SectionCard>

            <SectionCard title="Activity Timeline" subtitle="Forecast submitted, meal logged, invoice generated, and approval activity all land here.">
              {timelineQ.data?.length ? (
                <div className="space-y-3">
                  {timelineQ.data.map(item => (
                    <Surface key={item.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.summary}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.actorUserName ?? 'ProdSync User'} - {timeAgo(item.createdAt)}</p>
                        </div>
                        <StatusBadge variant="stable" label={labelize(item.action)} />
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="timeline" title="No activity yet" description="Forecasts, meal logs, vendors, and invoices will show up here." />
              )}
            </SectionCard>
          </div>
        )}

        {isForecastOnly && (
          <Surface variant="muted" padding="lg" className="mt-6">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Your access is limited to forecast submission only. Production leadership can review meal logs, invoices, analytics, and timeline activity for the full workflow.
            </p>
          </Surface>
        )}

        {invoicePreview && (
          <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[color:rgba(9,9,11,0.72)] px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6">
            <div className="flex h-full w-full flex-col overflow-hidden bg-[color:var(--app-bg)] shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:h-[min(92vh,980px)] sm:max-w-6xl sm:rounded-[32px]">
              <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">Invoice Preview</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-text)]">{invoicePreview.invoiceNumber}</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-muted)]">Review, print, or download the generated accounting PDF without leaving the workflow.</p>
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    label="Print"
                    icon="print"
                    disabled={invoicePreview.loading || !invoicePreview.url}
                    onClick={() => {
                      invoicePreviewFrameRef.current?.contentWindow?.focus()
                      invoicePreviewFrameRef.current?.contentWindow?.print()
                    }}
                  />
                  <ActionButton
                    label="Download"
                    icon="download"
                    disabled={invoicePreview.loading}
                    onClick={() => void downloadInvoicePreview(invoicePreview.invoiceId)}
                  />
                  <button
                    type="button"
                    onClick={closeInvoicePreview}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-muted)] transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
                {invoicePreview.error ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
                    {invoicePreview.error}
                  </div>
                ) : invoicePreview.loading || !invoicePreview.url ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-sm text-[color:var(--app-muted)]">
                    Loading invoice PDF...
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
                    <iframe
                      ref={invoicePreviewFrameRef}
                      title={`Invoice preview ${invoicePreview.invoiceNumber}`}
                      src={invoicePreview.url}
                      className="h-full w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sticky Actions */}
      <div ref={floatingActionsRef} className="fixed bottom-[88px] left-1/2 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 z-40 md:hidden transition-transform duration-300">
        {(selectedTab === 'forecasting' || (selectedTab === 'meal-logs' && canManage) || (selectedTab === 'invoices' && canManage)) && (
          <div className="bg-[#111111] border border-[#222222] rounded-[32px] p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            {selectedTab === 'forecasting' && (
              <button
                disabled={forecastOverflow > 0 || createForecastMutation.isPending}
                onClick={() => {
                  if (!forecastDraft.forecastDate.trim() || !forecastDraft.department.trim() || !Number.isFinite(forecastCrewCount) || forecastCrewCount <= 0) {
                    showError('Please fill the required fields before submitting the forecast.')
                    return
                  }
                  if (forecastOverflow > 0) {
                    showError('Dietary counts must not exceed the expected crew count.')
                    return
                  }
                  createForecastMutation.mutate({
                    ...forecastDraft,
                    projectId: activeProjectId,
                    expectedCrewCount: forecastCrewCount,
                    vegCount: Number(forecastDraft.vegCount) || 0,
                    nonVegCount: Number(forecastDraft.nonVegCount) || 0,
                    eggCount: Number(forecastDraft.eggCount) || 0,
                    jainCount: Number(forecastDraft.jainCount) || 0,
                    veganCount: Number(forecastDraft.veganCount) || 0,
                    medicalCount: Number(forecastDraft.medicalCount) || 0,
                    vendorName: forecastDraft.vendorName?.trim() || undefined,
                    vendorContactNumber: forecastDraft.vendorContactNumber?.trim() || undefined,
                    notes: forecastDraft.notes?.trim() || undefined,
                  })
                }}
                className="w-full flex items-center justify-center rounded-[24px] bg-orange-500 py-3 font-bold text-zinc-950 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createForecastMutation.isPending ? <LoadingDots /> : <span className="material-symbols-outlined mr-2 text-[20px]">send</span>}
                SUBMIT FORECAST
              </button>
            )}
            {selectedTab === 'meal-logs' && canManage && (
              <button
                disabled={createMealLogMutation.isPending}
                onClick={() => {
                  const actualPeopleServed = Number(mealDraft.actualPeopleServed)
                  if (!mealDraft.mealDate.trim() || !mealDraft.department.trim() || !mealDraft.mealPeriod || !Number.isFinite(actualPeopleServed) || actualPeopleServed <= 0) {
                    showError('Please fill the required fields before saving the meal log.')
                    return
                  }
                  createMealLogMutation.mutate({
                    ...mealDraft,
                    projectId: activeProjectId,
                    mealDate: mealDraft.mealDate,
                    department: mealDraft.department,
                    mealPeriod: mealDraft.mealPeriod,
                    forecastId: mealDraft.forecastId ?? null,
                    forecastCount: Number(mealDraft.forecastCount) || 0,
                    actualPeopleServed: Number(mealDraft.actualPeopleServed) || 0,
                    mealsServed: Number(mealDraft.actualPeopleServed) || 0,
                    unusedPlates: Number(mealDraft.unusedPlates) || 0,
                    wasteCount: Number(mealDraft.wastedMeals) || 0,
                    wastedMeals: Number(mealDraft.wastedMeals) || 0,
                    plateCost: Number(mealDraft.plateCost) || 0,
                    extraExpense: Number(mealDraft.extraExpense) || 0,
                    expenseNotes: mealDraft.expenseNotes?.trim() || undefined,
                    notes: mealDraft.notes?.trim() || undefined,
                  })
                }}
                className="w-full flex items-center justify-center rounded-[24px] bg-orange-500 py-3 font-bold text-zinc-950 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createMealLogMutation.isPending ? <LoadingDots /> : <span className="material-symbols-outlined mr-2 text-[20px]">save</span>}
                SAVE MEAL LOG
              </button>
            )}
            {selectedTab === 'invoices' && canManage && (
              <button
                disabled={createInvoiceMutation.isPending}
                onClick={() => {
                  const amount = Number(invoiceDraft.amount)
                  if (!invoiceDraft.invoiceNumber.trim() || !invoiceDraft.invoiceDate.trim() || !Number.isFinite(amount) || amount < 0) {
                    showError('Please fill the required fields before submitting the invoice.')
                    return
                  }
                  createInvoiceMutation.mutate({
                    invoiceId: invoiceEditingId,
                    file: selectedInvoiceFile,
                    payload: {
                      ...invoiceDraft,
                      projectId: activeProjectId,
                      mealLogId: invoiceDraft.mealLogId || undefined,
                      forecastId: invoiceDraft.forecastId || undefined,
                      vendorId: invoiceDraft.vendorId || undefined,
                      vendorName: invoiceDraft.vendorName?.trim() || undefined,
                      vendorContactNumber: invoiceDraft.vendorContactNumber?.trim() || undefined,
                      department: invoiceDraft.department?.trim() || undefined,
                      notes: invoiceDraft.notes?.trim() || undefined,
                      expenseNotes: invoiceDraft.expenseNotes?.trim() || undefined,
                      currencyCode: (invoiceDraft.currencyCode ?? 'INR').toUpperCase(),
                    },
                  })
                }}
                className="w-full flex items-center justify-center rounded-[24px] bg-orange-500 py-3 font-bold text-zinc-950 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createInvoiceMutation.isPending ? <LoadingDots /> : <span className="material-symbols-outlined mr-2 text-[20px]">{invoiceEditingId ? 'save' : 'send'}</span>}
                {invoiceEditingId ? 'UPDATE INVOICE' : 'SUBMIT INVOICE'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="md:hidden">
        <LiquidGlassNavbar
          ref={bottomNavRef}
          activeTabId={selectedTab}
          onTabChange={(id) => handleTabSwitch(id as FoodBeveragesTabId)}
          tabs={visibleTabConfig.map(tab => ({
            id: tab.id,
            icon: tab.icon,
            label: tab.label
          }))}
        />
      </div>

      <SectionSelectorSheet
        open={sectionSheetOpen}
        title="Select Section"
        description="Switch workspace sections without horizontal scrolling."
        selectedId={selectedTab}
        options={visibleTabConfig}
        onSelect={tab => {
          setSectionSheetOpen(false)
          handleTabSwitch(tab as FoodBeveragesTabId)
        }}
        onClose={() => setSectionSheetOpen(false)}
      />
    </div>
  )
}
