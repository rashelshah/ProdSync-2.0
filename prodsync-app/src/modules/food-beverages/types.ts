export type FoodBeveragesTabId = 'overview' | 'forecasting' | 'meal-logs' | 'vendor-ledger' | 'dietary' | 'analytics' | 'timeline'
export type FoodBeverageForecastStatus = 'submitted' | 'estimated'
export type FoodBeverageInvoiceStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
export type FoodBeverageAlertSeverity = 'critical' | 'warning' | 'info'
export type FoodBeverageMealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface FoodBeverageVendorRecord {
  id: string
  projectId: string
  name: string
  category: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  paymentTerms: string | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface FoodBeverageForecastRecord {
  id: string
  projectId: string
  forecastDate: string
  department: string
  mealCount: number
  mealPeriod: FoodBeverageMealPeriod | null
  isEstimated: boolean
  status: FoodBeverageForecastStatus
  submittedBy: string | null
  submittedByName: string | null
  submittedAt: string
  notes: string | null
}

export interface FoodBeverageMealLogRecord {
  id: string
  projectId: string
  mealDate: string
  department: string
  mealPeriod: FoodBeverageMealPeriod
  mealsServed: number
  wasteCount: number
  vendorId: string | null
  vendorName: string | null
  notes: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

export interface FoodBeverageDietaryProfileRecord {
  id: string
  projectId: string
  department: string
  vegetarianCount: number
  veganCount: number
  jainCount: number
  glutenFreeCount: number
  allergenNotes: string | null
  contactName: string | null
  contactPhone: string | null
  notes: string | null
  updatedAt: string
}

export interface FoodBeverageInvoiceRecord {
  id: string
  projectId: string
  vendorId: string | null
  vendorName: string | null
  invoiceNumber: string
  invoiceDate: string
  amount: number
  currencyCode: string
  status: FoodBeverageInvoiceStatus
  approvalRequested: boolean
  approvalId: string | null
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'not_requested'
  fileUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface FoodBeverageVarianceAlertRecord {
  id: string
  projectId: string
  alertDate: string
  department: string
  vendorName: string | null
  forecastCount: number
  servedCount: number
  varianceCount: number
  variancePercent: number
  severity: FoodBeverageAlertSeverity
  message: string
  acknowledgedAt: string | null
}

export interface FoodBeverageActivityLogRecord {
  id: string
  projectId: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  actorUserId: string | null
  actorUserName: string | null
  createdAt: string
}

export interface FoodBeverageOverviewRecord {
  todaysForecast: number
  mealsServed: number
  variance: number
  wastePercent: number
  costToday: number
  monthlyBurn: number
  alerts: Array<{
    id: string
    title: string
    message: string
    severity: FoodBeverageAlertSeverity
    acknowledged: boolean
  }>
  recentActivity: FoodBeverageActivityLogRecord[]
}

export interface FoodBeverageAnalyticsRecord {
  forecastCoverage: {
    submitted: number
    estimated: number
    total: number
  }
  wasteSummary: {
    totalWaste: number
    averageWastePercent: number
    highWasteDays: number
  }
  costSummary: {
    total: number
    monthlyBurn: number
    pendingApproval: number
  }
  vendorPerformance: Array<{
    vendorName: string
    forecastCount: number
    servedCount: number
    variancePercent: number
    invoiceTotal: number
  }>
}

export interface FoodBeverageVendorInput {
  projectId: string
  name: string
  category?: string | null
  contactName?: string | null
  email?: string | null
  phone?: string | null
  paymentTerms?: string | null
  notes?: string | null
  active?: boolean
}

export interface FoodBeverageForecastInput {
  projectId: string
  forecastDate: string
  department: string
  mealCount: number
  mealPeriod?: FoodBeverageMealPeriod | null
  notes?: string | null
}

export interface FoodBeverageMealLogInput {
  projectId: string
  mealDate: string
  department: string
  mealPeriod: FoodBeverageMealPeriod
  mealsServed: number
  wasteCount?: number
  vendorId?: string | null
  notes?: string | null
}

export interface FoodBeverageDietaryProfileInput {
  projectId: string
  department: string
  vegetarianCount?: number
  veganCount?: number
  jainCount?: number
  glutenFreeCount?: number
  allergenNotes?: string | null
  contactName?: string | null
  contactPhone?: string | null
  notes?: string | null
}

export interface FoodBeverageInvoiceInput {
  projectId: string
  vendorId?: string | null
  invoiceNumber: string
  invoiceDate: string
  amount: number
  currencyCode?: string
  approvalRequested?: boolean
  status?: FoodBeverageInvoiceStatus
  notes?: string | null
}
