import { apiFetch, readApiJson } from '@/lib/api'
import type {
  FoodBeverageAnalyticsRecord,
  FoodBeverageActivityLogRecord,
  FoodBeverageDietaryProfileInput,
  FoodBeverageDietaryProfileRecord,
  FoodBeverageForecastInput,
  FoodBeverageForecastRecord,
  FoodBeverageInvoiceInput,
  FoodBeverageInvoiceRecord,
  FoodBeverageMealLogInput,
  FoodBeverageMealLogRecord,
  FoodBeverageOverviewRecord,
  FoodBeverageVendorInput,
  FoodBeverageVendorRecord,
  FoodBeverageVarianceAlertRecord,
} from './types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

function toQueryString(projectId: string, extras?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ projectId })
  Object.entries(extras ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return params.toString()
}

function buildFormData(input: object, file?: File | null) {
  const formData = new FormData()
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, String(value))
  })
  if (file) {
    formData.append('file', file)
  }
  return formData
}

export const foodBeveragesService = {
  async getOverview(projectId: string): Promise<FoodBeverageOverviewRecord> {
    const response = await apiFetch(`/food-beverages/overview?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ overview: FoodBeverageOverviewRecord }>(response)
    return payload.overview
  },

  async getForecasts(projectId: string, date?: string): Promise<FoodBeverageForecastRecord[]> {
    const response = await apiFetch(`/food-beverages/forecasts?${toQueryString(projectId, { date })}`)
    const payload = await readApiJson<{ forecasts: FoodBeverageForecastRecord[] }>(response)
    return payload.forecasts
  },

  async createForecast(input: FoodBeverageForecastInput): Promise<FoodBeverageForecastRecord> {
    const response = await apiFetch('/food-beverages/forecasts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ forecast: FoodBeverageForecastRecord }>(response)
    return payload.forecast
  },

  async getMealLogs(projectId: string, date?: string): Promise<FoodBeverageMealLogRecord[]> {
    const response = await apiFetch(`/food-beverages/meal-logs?${toQueryString(projectId, { date })}`)
    const payload = await readApiJson<{ mealLogs: FoodBeverageMealLogRecord[] }>(response)
    return payload.mealLogs
  },

  async createMealLog(input: FoodBeverageMealLogInput): Promise<FoodBeverageMealLogRecord> {
    const response = await apiFetch('/food-beverages/meal-logs', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ mealLog: FoodBeverageMealLogRecord }>(response)
    return payload.mealLog
  },

  async getVendors(projectId: string): Promise<FoodBeverageVendorRecord[]> {
    const response = await apiFetch(`/food-beverages/vendors?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ vendors: FoodBeverageVendorRecord[] }>(response)
    return payload.vendors
  },

  async createVendor(input: FoodBeverageVendorInput): Promise<FoodBeverageVendorRecord> {
    const response = await apiFetch('/food-beverages/vendors', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ vendor: FoodBeverageVendorRecord }>(response)
    return payload.vendor
  },

  async updateVendor(vendorId: string, input: FoodBeverageVendorInput): Promise<FoodBeverageVendorRecord> {
    const response = await apiFetch(`/food-beverages/vendors/${encodeURIComponent(vendorId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ vendor: FoodBeverageVendorRecord }>(response)
    return payload.vendor
  },

  async getDietaryProfiles(projectId: string): Promise<FoodBeverageDietaryProfileRecord[]> {
    const response = await apiFetch(`/food-beverages/dietary?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ dietaryProfiles: FoodBeverageDietaryProfileRecord[] }>(response)
    return payload.dietaryProfiles
  },

  async upsertDietaryProfile(input: FoodBeverageDietaryProfileInput): Promise<FoodBeverageDietaryProfileRecord> {
    const response = await apiFetch('/food-beverages/dietary', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ profile: FoodBeverageDietaryProfileRecord }>(response)
    return payload.profile
  },

  async getAnalytics(projectId: string): Promise<FoodBeverageAnalyticsRecord> {
    const response = await apiFetch(`/food-beverages/analytics?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ analytics: FoodBeverageAnalyticsRecord }>(response)
    return payload.analytics
  },

  async getTimeline(projectId: string): Promise<FoodBeverageActivityLogRecord[]> {
    const response = await apiFetch(`/food-beverages/timeline?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ timeline: FoodBeverageActivityLogRecord[] }>(response)
    return payload.timeline
  },

  async getAlerts(projectId: string): Promise<FoodBeverageVarianceAlertRecord[]> {
    const response = await apiFetch(`/food-beverages/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: FoodBeverageVarianceAlertRecord[] }>(response)
    return payload.alerts
  },

  async getInvoices(projectId: string): Promise<FoodBeverageInvoiceRecord[]> {
    const response = await apiFetch(`/food-beverages/invoices?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ invoices: FoodBeverageInvoiceRecord[] }>(response)
    return payload.invoices
  },

  async createInvoice(input: FoodBeverageInvoiceInput, file?: File | null): Promise<FoodBeverageInvoiceRecord> {
    const response = await apiFetch('/food-beverages/invoices', {
      method: 'POST',
      body: buildFormData(input, file ?? null),
    })
    const payload = await readApiJson<{ invoice: FoodBeverageInvoiceRecord }>(response)
    return payload.invoice
  },

  async updateInvoice(invoiceId: string, input: FoodBeverageInvoiceInput, file?: File | null): Promise<FoodBeverageInvoiceRecord> {
    const response = await apiFetch(`/food-beverages/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      body: buildFormData(input, file ?? null),
    })
    const payload = await readApiJson<{ invoice: FoodBeverageInvoiceRecord }>(response)
    return payload.invoice
  },
}
