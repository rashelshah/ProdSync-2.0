import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, LoadingState } from '@/components/system/SystemStates'
import { SectionSelectorSheet } from '@/components/shared/SectionSelectorSheet'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showSuccess } from '@/lib/toast'
import { formatCurrency, formatDate, timeAgo } from '@/utils'
import type { ProjectCurrency } from '@/types'
import { foodBeveragesService } from '../service'
import type {
  FoodBeverageDietaryProfileInput,
  FoodBeverageForecastInput,
  FoodBeverageInvoiceInput,
  FoodBeverageMealLogInput,
  FoodBeverageVendorInput,
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
  { id: 'forecasting', label: 'Forecasting', mobileLabel: 'Forecasting', icon: 'schedule', description: 'Next-day meal counts and estimated fallback.' },
  { id: 'meal-logs', label: 'Meal Logs', mobileLabel: 'Meal Logs', icon: 'restaurant', description: 'Served meals, waste, and vendor accountability.' },
  { id: 'vendor-ledger', label: 'Vendor Ledger', mobileLabel: 'Vendor Ledger', icon: 'receipt_long', description: 'Vendors, invoices, and approval tracking.' },
  { id: 'dietary', label: 'Dietary', mobileLabel: 'Dietary', icon: 'person_raised_hand', description: 'Dietary counts and allergy readiness.' },
  { id: 'analytics', label: 'Analytics', mobileLabel: 'Analytics', icon: 'analytics', description: 'Forecast coverage, waste, and vendor performance.' },
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
  if (!value) return 'All Day'
  return labelize(value)
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
  if (value === 'INR' || value === 'USD' || value === 'EUR') {
    return value
  }
  return undefined
}

function tabFromValue(value: string | null, visibleTabs: FoodBeveragesTabId[]) {
  const candidate = value as FoodBeveragesTabId | null
  if (candidate && visibleTabs.includes(candidate)) return candidate
  return visibleTabs[0]
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      {children}
      {hint && <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white ${props.className ?? ''}`} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white ${props.className ?? ''}`} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white ${props.className ?? ''}`} />
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
          : 'border border-zinc-200 bg-white text-zinc-900 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-300'
      } ${(disabled || loading) ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {loading ? <span className="ui-spinner" /> : <span className="material-symbols-outlined text-[16px]">{icon}</span>}
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
  children: React.ReactNode
  action?: React.ReactNode
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false)
  const [switchingTab, setSwitchingTab] = useState<FoodBeveragesTabId | null>(null)
  const [forecastDraft, setForecastDraft] = useState<FoodBeverageForecastInput>({
    projectId: activeProjectId ?? '',
    forecastDate: tomorrowIso(),
    department: 'production',
    mealCount: 0,
    mealPeriod: null,
    notes: '',
  })
  const [mealDraft, setMealDraft] = useState<FoodBeverageMealLogInput>({
    projectId: activeProjectId ?? '',
    mealDate: todayIso(),
    department: 'production',
    mealPeriod: 'lunch',
    mealsServed: 0,
    wasteCount: 0,
    vendorId: null,
    notes: '',
  })
  const [vendorDraft, setVendorDraft] = useState<FoodBeverageVendorInput>({
    projectId: activeProjectId ?? '',
    name: '',
    category: '',
    contactName: '',
    email: '',
    phone: '',
    paymentTerms: '',
    notes: '',
    active: true,
  })
  const [invoiceDraft, setInvoiceDraft] = useState<FoodBeverageInvoiceInput>({
    projectId: activeProjectId ?? '',
    vendorId: null,
    invoiceNumber: '',
    invoiceDate: todayIso(),
    amount: 0,
    currencyCode: 'INR',
    approvalRequested: true,
    status: 'submitted',
    notes: '',
  })
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null)
  const [invoiceEditingId, setInvoiceEditingId] = useState<string | null>(null)
  const [dietaryDraft, setDietaryDraft] = useState<FoodBeverageDietaryProfileInput>({
    projectId: activeProjectId ?? '',
    department: 'production',
    vegetarianCount: 0,
    veganCount: 0,
    jainCount: 0,
    glutenFreeCount: 0,
    allergenNotes: '',
    contactName: '',
    contactPhone: '',
    notes: '',
  })

  useEffect(() => {
    if (!activeProjectId) return
    setForecastDraft(current => ({ ...current, projectId: activeProjectId }))
    setMealDraft(current => ({ ...current, projectId: activeProjectId }))
    setVendorDraft(current => ({ ...current, projectId: activeProjectId }))
    setInvoiceDraft(current => ({ ...current, projectId: activeProjectId }))
    setDietaryDraft(current => ({ ...current, projectId: activeProjectId }))
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
  const mealLogsQ = useQuery({
    queryKey: ['food-beverages-meal-logs', activeProjectId, mealDraft.mealDate],
    queryFn: () => foodBeveragesService.getMealLogs(activeProjectId!, mealDraft.mealDate),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 20_000,
  })
  const vendorsQ = useQuery({
    queryKey: ['food-beverages-vendors', activeProjectId],
    queryFn: () => foodBeveragesService.getVendors(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 30_000,
  })
  const dietaryQ = useQuery({
    queryKey: ['food-beverages-dietary', activeProjectId],
    queryFn: () => foodBeveragesService.getDietaryProfiles(activeProjectId!),
    enabled: Boolean(activeProjectId && !isForecastOnly),
    staleTime: 30_000,
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
    onSuccess: async () => {
      showSuccess('Forecast submitted.')
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-forecasts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not submit the forecast.')),
  })
  const createMealLogMutation = useMutation({
    mutationFn: (payload: FoodBeverageMealLogInput) => foodBeveragesService.createMealLog(payload),
    onSuccess: async () => {
      showSuccess('Meal log saved.')
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-meal-logs', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save the meal log.')),
  })
  const createVendorMutation = useMutation({
    mutationFn: (payload: FoodBeverageVendorInput) => foodBeveragesService.createVendor(payload),
    onSuccess: async () => {
      showSuccess('Vendor saved.')
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-vendors', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save the vendor.')),
  })
  const saveDietaryMutation = useMutation({
    mutationFn: (payload: typeof dietaryDraft) => foodBeveragesService.upsertDietaryProfile(payload),
    onSuccess: async () => {
      showSuccess('Dietary profile saved.')
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-dietary', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-timeline', activeProjectId] })
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save dietary information.')),
  })
  const createInvoiceMutation = useMutation({
    mutationFn: ({ payload, file, invoiceId }: { payload: FoodBeverageInvoiceInput; file?: File | null; invoiceId?: string | null }) => (
      invoiceId
        ? foodBeveragesService.updateInvoice(invoiceId, payload)
        : foodBeveragesService.createInvoice(payload, file)
    ),
    onSuccess: async () => {
      showSuccess(invoiceEditingId ? 'Invoice updated.' : 'Invoice submitted.')
      setInvoiceEditingId(null)
      setSelectedInvoiceFile(null)
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-invoices', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-analytics', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-overview', activeProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['food-beverages-alerts', activeProjectId] })
    },
    onError: error => showError(resolveErrorMessage(error, 'Could not save the invoice.')),
  })

  const canManage = !isForecastOnly
  const visibleTabConfig = TAB_CONFIG.filter(tab => visibleTabs.includes(tab.id))

  const handleTabSwitch = (tabId: FoodBeveragesTabId) => {
    setSwitchingTab(tabId)
    setSearchParams(params => {
      params.set('tab', tabId)
      return params
    })
  }

  const forecastRows = forecastsQ.data ?? []
  const mealLogs = mealLogsQ.data ?? []
  const vendors = vendorsQ.data ?? []
  const dietaryProfiles = dietaryQ.data ?? []
  const alerts = alertsQ.data ?? []
  const invoices = invoicesQ.data ?? []

  const loadingTabs = selectedTab === 'overview'
    ? overviewQ.isLoading
    : selectedTab === 'forecasting'
      ? forecastsQ.isLoading
      : selectedTab === 'meal-logs'
        ? mealLogsQ.isLoading
        : selectedTab === 'vendor-ledger'
          ? vendorsQ.isLoading || invoicesQ.isLoading
          : selectedTab === 'dietary'
            ? dietaryQ.isLoading
            : selectedTab === 'analytics'
              ? analyticsQ.isLoading
              : timelineQ.isLoading

  if (isLoadingProjectContext) {
    return <LoadingState message="Loading food and beverages workspace..." />
  }

  if (isErrorProjectContext || !activeProjectId) {
    return <ErrorState message="Project context is unavailable." retry={() => window.location.reload()} />
  }

  if (overviewQ.isError || forecastsQ.isError || mealLogsQ.isError || vendorsQ.isError || dietaryQ.isError || analyticsQ.isError || timelineQ.isError || alertsQ.isError || invoicesQ.isError) {
    return <ErrorState message="Could not load the Food & Beverages workspace." retry={() => window.location.reload()} />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_24%)] pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">Food &amp; Beverages</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-zinc-900 dark:text-white">Catering control, forecasting, and cost accountability.</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Keep the catering team honest, prevent waste, and give production a clear forecast before the next meal is cooked for {activeProject?.name ?? 'this project'}.
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton label="Add Vendor" icon="store" onClick={() => handleTabSwitch('vendor-ledger')} />
              <ActionButton label="Log Meal" icon="restaurant" onClick={() => handleTabSwitch('meal-logs')} />
              <ActionButton label="Invoice" icon="receipt_long" onClick={() => handleTabSwitch('vendor-ledger')} />
            </div>
          )}
        </div>

        <Surface variant="table" padding="md" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Workspace Sections</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Switch tabs without sticky navigation or horizontal scroll.</p>
              </div>
              <button
                type="button"
                onClick={() => setSectionSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-300 md:hidden"
              >
                <span className="material-symbols-outlined text-[16px]">{TAB_CONFIG.find(tab => tab.id === selectedTab)?.icon ?? 'dashboard'}</span>
                {TAB_CONFIG.find(tab => tab.id === selectedTab)?.mobileLabel ?? 'Overview'}
                <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
              </button>
            </div>

            <div className="hidden flex-wrap gap-2 md:flex">
              {visibleTabConfig.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    selectedTab === tab.id
                      ? 'bg-orange-500 text-black shadow-[0_10px_24px_rgba(249,115,22,0.22)]'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                  disabled={switchingTab !== null}
                >
                  {switchingTab === tab.id ? <span className="ui-spinner" /> : <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>}
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingTabs && (
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                <span className="ui-spinner" />
                Loading section...
              </div>
            )}
          </div>
        </Surface>

        {selectedTab === 'overview' && !isForecastOnly && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{entry.actorUserName ?? 'ProdSync User'} · {timeAgo(entry.createdAt)}</p>
                        </div>
                        <StatusBadge variant="stable" label={labelize(entry.action)} />
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="timeline" title="No activity yet" description="Forecasts, meal logs, and vendor changes will appear here." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'forecasting' && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Next-Day Forecast" subtitle="Department heads should be able to submit in under 10 seconds.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Forecast Date">
                  <Input type="date" value={forecastDraft.forecastDate} onChange={event => setForecastDraft(current => ({ ...current, forecastDate: event.target.value }))} />
                </Field>
                <Field label="Department">
                  <Select value={forecastDraft.department} onChange={event => setForecastDraft(current => ({ ...current, department: event.target.value }))}>
                    {DEPARTMENT_OPTIONS.map(option => <option key={option} value={option}>{labelize(option)}</option>)}
                  </Select>
                </Field>
                <Field label="Meal Count">
                  <Input type="number" min="0" value={forecastDraft.mealCount} onChange={event => setForecastDraft(current => ({ ...current, mealCount: Number(event.target.value) }))} />
                </Field>
                <Field label="Meal Period">
                  <Select value={forecastDraft.mealPeriod ?? ''} onChange={event => setForecastDraft(current => ({ ...current, mealPeriod: event.target.value ? event.target.value as FoodBeverageForecastInput['mealPeriod'] : null }))}>
                    <option value="">All Day</option>
                    {MEAL_PERIOD_OPTIONS.map(option => <option key={option} value={option}>{mealPeriodLabel(option)}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Notes" hint="Optional context for catering and production management.">
                  <Textarea rows={3} value={forecastDraft.notes ?? ''} onChange={event => setForecastDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <div className="flex items-end">
                  <ActionButton
                    label="Submit Forecast"
                    icon="send"
                    loading={createForecastMutation.isPending}
                    onClick={() => {
                      if (!forecastDraft.department.trim()) {
                        showError('Please select a department.')
                        return
                      }
                      createForecastMutation.mutate({
                        ...forecastDraft,
                        projectId: activeProjectId,
                        mealCount: Number(forecastDraft.mealCount) || 0,
                        notes: forecastDraft.notes?.trim() || undefined,
                      })
                    }}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Forecast Ledger" subtitle="Submitted forecasts and estimated fallback values for the next meal cycle.">
              {forecastRows.length ? (
                <div className="overflow-hidden rounded-[26px] border border-zinc-200 dark:border-zinc-800">
                  <div className="grid grid-cols-12 bg-zinc-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <div className="col-span-3">Department</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Meal Count</div>
                    <div className="col-span-2">Period</div>
                    <div className="col-span-3">Status</div>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {forecastRows.map(row => (
                      <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                        <div className="col-span-3 font-medium text-zinc-900 dark:text-white">{labelize(row.department)}</div>
                        <div className="col-span-2 text-zinc-500 dark:text-zinc-400">{formatDate(row.forecastDate)}</div>
                        <div className="col-span-2 text-zinc-900 dark:text-white">{row.mealCount}</div>
                        <div className="col-span-2 text-zinc-500 dark:text-zinc-400">{mealPeriodLabel(row.mealPeriod)}</div>
                        <div className="col-span-3 flex flex-wrap items-center gap-2">
                          <StatusBadge variant={row.isEstimated ? 'warning' : 'approved'} label={row.isEstimated ? 'Estimated' : 'Submitted'} />
                          <span className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{row.submittedByName ?? 'System'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon="schedule" title="No forecasts yet" description="The next forecast will appear here once it is submitted or estimated." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'meal-logs' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Meal Log Entry" subtitle="Record what was actually served and how much was wasted.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Meal Date"><Input type="date" value={mealDraft.mealDate} onChange={event => setMealDraft(current => ({ ...current, mealDate: event.target.value }))} /></Field>
                <Field label="Department"><Select value={mealDraft.department} onChange={event => setMealDraft(current => ({ ...current, department: event.target.value }))}>{DEPARTMENT_OPTIONS.map(option => <option key={option} value={option}>{labelize(option)}</option>)}</Select></Field>
                <Field label="Meal Period"><Select value={mealDraft.mealPeriod} onChange={event => setMealDraft(current => ({ ...current, mealPeriod: event.target.value as FoodBeverageMealLogInput['mealPeriod'] }))}>{MEAL_PERIOD_OPTIONS.map(option => <option key={option} value={option}>{mealPeriodLabel(option)}</option>)}</Select></Field>
                <Field label="Meals Served"><Input type="number" min="0" value={mealDraft.mealsServed} onChange={event => setMealDraft(current => ({ ...current, mealsServed: Number(event.target.value) }))} /></Field>
                <Field label="Waste Count"><Input type="number" min="0" value={mealDraft.wasteCount ?? 0} onChange={event => setMealDraft(current => ({ ...current, wasteCount: Number(event.target.value) }))} /></Field>
                <Field label="Vendor">
                  <Select value={mealDraft.vendorId ?? ''} onChange={event => setMealDraft(current => ({ ...current, vendorId: event.target.value || null }))}>
                    <option value="">No vendor linked</option>
                    {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Notes">
                  <Textarea rows={3} value={mealDraft.notes ?? ''} onChange={event => setMealDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <div className="flex items-end">
                  <ActionButton
                    label="Save Meal Log"
                    icon="save"
                    loading={createMealLogMutation.isPending}
                    onClick={() => createMealLogMutation.mutate({
                      ...mealDraft,
                      projectId: activeProjectId,
                      wasteCount: Number(mealDraft.wasteCount) || 0,
                      notes: mealDraft.notes?.trim() || undefined,
                    })}
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
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{labelize(row.department)} · {mealPeriodLabel(row.mealPeriod)}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(row.mealDate)} · {row.vendorName ?? 'No vendor linked'} · {row.createdByName ?? 'ProdSync User'}</p>
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

        {selectedTab === 'vendor-ledger' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Vendor Profile" subtitle="Track vendor contact details and accountability.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Vendor Name"><Input value={vendorDraft.name} onChange={event => setVendorDraft(current => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Category"><Input value={vendorDraft.category ?? ''} onChange={event => setVendorDraft(current => ({ ...current, category: event.target.value }))} /></Field>
                <Field label="Contact Name"><Input value={vendorDraft.contactName ?? ''} onChange={event => setVendorDraft(current => ({ ...current, contactName: event.target.value }))} /></Field>
                <Field label="Payment Terms"><Input value={vendorDraft.paymentTerms ?? ''} onChange={event => setVendorDraft(current => ({ ...current, paymentTerms: event.target.value }))} /></Field>
                <Field label="Email"><Input value={vendorDraft.email ?? ''} onChange={event => setVendorDraft(current => ({ ...current, email: event.target.value }))} /></Field>
                <Field label="Phone"><Input value={vendorDraft.phone ?? ''} onChange={event => setVendorDraft(current => ({ ...current, phone: event.target.value }))} /></Field>
                <Field label="Active">
                  <Select value={vendorDraft.active ? 'true' : 'false'} onChange={event => setVendorDraft(current => ({ ...current, active: event.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Notes">
                  <Textarea rows={3} value={vendorDraft.notes ?? ''} onChange={event => setVendorDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <div className="flex items-end">
                  <ActionButton
                    label="Save Vendor"
                    icon="save"
                    loading={createVendorMutation.isPending}
                    onClick={() => {
                      if (!vendorDraft.name.trim()) {
                        showError('Vendor name is required.')
                        return
                      }
                      createVendorMutation.mutate({
                        ...vendorDraft,
                        projectId: activeProjectId,
                        notes: vendorDraft.notes?.trim() || undefined,
                        category: vendorDraft.category?.trim() || undefined,
                        contactName: vendorDraft.contactName?.trim() || undefined,
                        email: vendorDraft.email?.trim() || undefined,
                        phone: vendorDraft.phone?.trim() || undefined,
                        paymentTerms: vendorDraft.paymentTerms?.trim() || undefined,
                      })
                    }}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Vendor Ledger" subtitle="Registered vendors and their latest operating status.">
              {vendors.length ? (
                <div className="space-y-3">
                  {vendors.map(vendor => (
                    <Surface key={vendor.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{vendor.name}</p>
                            <StatusBadge variant={vendor.active ? 'approved' : 'stable'} label={vendor.active ? 'Active' : 'Inactive'} />
                          </div>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{vendor.category ?? 'Uncategorized'} · {vendor.contactName ?? 'No contact'} · {vendor.phone ?? 'No phone'}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Updated {timeAgo(vendor.updatedAt)}</p>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="store" title="No vendors yet" description="Vendor entries will appear here once they are created." />
              )}
            </SectionCard>

            <SectionCard title="Invoice Queue" subtitle="Submit invoices and route them through approval if required.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Invoice Number"><Input value={invoiceDraft.invoiceNumber} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceNumber: event.target.value }))} /></Field>
                <Field label="Invoice Date"><Input type="date" value={invoiceDraft.invoiceDate} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceDate: event.target.value }))} /></Field>
                <Field label="Amount"><Input type="number" min="0" value={invoiceDraft.amount} onChange={event => setInvoiceDraft(current => ({ ...current, amount: Number(event.target.value) }))} /></Field>
                <Field label="Vendor">
                  <Select value={invoiceDraft.vendorId ?? ''} onChange={event => setInvoiceDraft(current => ({ ...current, vendorId: event.target.value || null }))}>
                    <option value="">Select vendor</option>
                    {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                  </Select>
                </Field>
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
                <div className="flex items-end">
                  <ActionButton
                    label={invoiceEditingId ? 'Update Invoice' : 'Submit Invoice'}
                    icon={invoiceEditingId ? 'save' : 'send'}
                    loading={createInvoiceMutation.isPending}
                    onClick={() => {
                      if (!invoiceDraft.invoiceNumber.trim()) {
                        showError('Invoice number is required.')
                        return
                      }
                      createInvoiceMutation.mutate({
                        payload: {
                          ...invoiceDraft,
                          projectId: activeProjectId,
                          vendorId: invoiceDraft.vendorId || undefined,
                          notes: invoiceDraft.notes?.trim() || undefined,
                          currencyCode: (invoiceDraft.currencyCode ?? 'INR').toUpperCase(),
                        },
                        file: selectedInvoiceFile,
                        invoiceId: invoiceEditingId,
                      })
                    }}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {invoices.length ? invoices.map(invoice => (
                  <Surface key={invoice.id} variant="muted" padding="md">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{invoice.invoiceNumber}</p>
                          <StatusBadge variant={badgeVariant(invoice.status)} label={labelize(invoice.status)} />
                          <StatusBadge variant={invoice.approvalRequested ? 'warning' : 'stable'} label={invoice.approvalRequested ? 'Approval Requested' : 'No Approval'} />
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{invoice.vendorName ?? 'Unknown vendor'} · {formatDate(invoice.invoiceDate)} · {formatCurrency(invoice.amount, resolveProjectCurrency(invoice.currencyCode) ?? activeProject?.currency)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionButton label="Edit" icon="edit" onClick={() => {
                          setInvoiceEditingId(invoice.id)
                          setInvoiceDraft(current => ({
                            ...current,
                            vendorId: invoice.vendorId,
                            invoiceNumber: invoice.invoiceNumber,
                            invoiceDate: invoice.invoiceDate,
                            amount: invoice.amount,
                            currencyCode: invoice.currencyCode,
                            approvalRequested: invoice.approvalRequested,
                            status: invoice.status,
                            notes: invoice.notes ?? '',
                          }))
                        }} />
                      </div>
                    </div>
                  </Surface>
                )) : (
                  <EmptyState icon="receipt_long" title="No invoices yet" description="Submitted invoices will show up here for approval and review." />
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {selectedTab === 'dietary' && canManage && (
          <div className="mt-6 space-y-6">
            <SectionCard title="Dietary Profile" subtitle="Track vegetarian, vegan, Jain, gluten-free, and allergy needs by department.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Department"><Select value={dietaryDraft.department} onChange={event => setDietaryDraft(current => ({ ...current, department: event.target.value }))}>{DEPARTMENT_OPTIONS.map(option => <option key={option} value={option}>{labelize(option)}</option>)}</Select></Field>
                <Field label="Vegetarian"><Input type="number" min="0" value={dietaryDraft.vegetarianCount} onChange={event => setDietaryDraft(current => ({ ...current, vegetarianCount: Number(event.target.value) }))} /></Field>
                <Field label="Vegan"><Input type="number" min="0" value={dietaryDraft.veganCount} onChange={event => setDietaryDraft(current => ({ ...current, veganCount: Number(event.target.value) }))} /></Field>
                <Field label="Jain"><Input type="number" min="0" value={dietaryDraft.jainCount} onChange={event => setDietaryDraft(current => ({ ...current, jainCount: Number(event.target.value) }))} /></Field>
                <Field label="Gluten Free"><Input type="number" min="0" value={dietaryDraft.glutenFreeCount} onChange={event => setDietaryDraft(current => ({ ...current, glutenFreeCount: Number(event.target.value) }))} /></Field>
                <Field label="Contact Name"><Input value={dietaryDraft.contactName ?? ''} onChange={event => setDietaryDraft(current => ({ ...current, contactName: event.target.value }))} /></Field>
                <Field label="Contact Phone"><Input value={dietaryDraft.contactPhone ?? ''} onChange={event => setDietaryDraft(current => ({ ...current, contactPhone: event.target.value }))} /></Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Allergen Notes"><Textarea rows={3} value={dietaryDraft.allergenNotes ?? ''} onChange={event => setDietaryDraft(current => ({ ...current, allergenNotes: event.target.value }))} /></Field>
                <div className="flex items-end">
                  <ActionButton
                    label="Save Dietary"
                    icon="save"
                    loading={saveDietaryMutation.isPending}
                    onClick={() => saveDietaryMutation.mutate({
                      ...dietaryDraft,
                      projectId: activeProjectId,
                      notes: dietaryDraft.notes?.trim() || undefined,
                      allergenNotes: dietaryDraft.allergenNotes?.trim() || undefined,
                      contactName: dietaryDraft.contactName?.trim() || undefined,
                      contactPhone: dietaryDraft.contactPhone?.trim() || undefined,
                    })}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dietary Coverage" subtitle="Department-by-department readiness for special meal requirements.">
              {dietaryProfiles.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dietaryProfiles.map(profile => (
                    <Surface key={profile.id} variant="muted" padding="md">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{labelize(profile.department)}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Veg {profile.vegetarianCount} · Vegan {profile.veganCount} · Jain {profile.jainCount} · GF {profile.glutenFreeCount}
                          </p>
                        </div>
                        <StatusBadge variant="stable" label={timeAgo(profile.updatedAt)} />
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <EmptyState icon="person_raised_hand" title="No dietary data yet" description="Add dietary needs per department to keep catering accurate." />
              )}
            </SectionCard>
          </div>
        )}

        {selectedTab === 'analytics' && canManage && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <KpiCard label="Coverage Submitted" value={String(analyticsQ.data?.forecastCoverage.submitted ?? 0)} subLabel="Forecast rows" />
              <KpiCard label="Estimated Rows" value={String(analyticsQ.data?.forecastCoverage.estimated ?? 0)} subLabel="Fallback values" />
              <KpiCard label="Waste % Avg" value={`${analyticsQ.data?.wasteSummary.averageWastePercent?.toFixed(1) ?? '0.0'}%`} subLabel="Average waste" />
              <KpiCard label="Total Waste" value={String(analyticsQ.data?.wasteSummary.totalWaste ?? 0)} subLabel="Meals wasted" />
              <KpiCard label="Monthly Burn" value={formatCurrency(analyticsQ.data?.costSummary.monthlyBurn ?? 0, activeProject?.currency ?? 'INR')} subLabel="Food spend this month" />
              <KpiCard label="Pending Approval" value={formatCurrency(analyticsQ.data?.costSummary.pendingApproval ?? 0, activeProject?.currency ?? 'INR')} subLabel="Invoices awaiting review" />
            </div>

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
                <EmptyState icon="analytics" title="No analytics yet" description="Analytics will populate as forecasts and invoices come in." />
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

            <SectionCard title="Activity Timeline" subtitle="Everything logged here also lands in the global activity stream.">
              {timelineQ.data?.length ? (
                <div className="space-y-3">
                  {timelineQ.data.map(item => (
                    <Surface key={item.id} variant="muted" padding="md">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.summary}</p>
                          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.actorUserName ?? 'ProdSync User'} · {timeAgo(item.createdAt)}</p>
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
          <Surface variant="warning" padding="lg" className="mt-6">
            <p className="text-sm leading-6 text-orange-700 dark:text-orange-300">
              Your access is limited to forecast submission only. Production leadership can review the full vendor, meal, dietary, analytics, and timeline workspace.
            </p>
          </Surface>
        )}
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
