import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import { canManageFoodBeverages, canSubmitFoodForecast, canViewFoodBeverages } from './food-beverages.access'
import {
  createFoodBeverageForecast,
  createFoodBeverageInvoice,
  createFoodBeverageMealLog,
  createFoodBeverageVendor,
  getFoodBeverageAnalytics,
  getFoodBeveragesOverview,
  listFoodBeverageAlerts,
  listFoodBeverageDietaryProfiles,
  listFoodBeverageForecasts,
  listFoodBeverageInvoices,
  listFoodBeverageMealLogs,
  listFoodBeverageTimeline,
  listFoodBeverageVendors,
  updateFoodBeverageInvoice,
  updateFoodBeverageVendor,
  upsertFoodBeverageDietaryProfile,
} from './food-beverages.service'
import {
  foodBeverageAnalyticsQuerySchema,
  foodBeverageDietaryListQuerySchema,
  foodBeverageDietaryProfileSchema,
  foodBeverageForecastListQuerySchema,
  foodBeverageForecastSchema,
  foodBeverageInvoiceListQuerySchema,
  foodBeverageMealLogSchema,
  foodBeverageMealLogListQuerySchema,
  foodBeverageOverviewQuerySchema,
  foodBeveragesProjectQuerySchema,
  foodBeverageTimelineQuerySchema,
  foodBeverageVendorListQuerySchema,
  foodBeverageVendorSchema,
  createFoodBeverageInvoiceSchema,
  updateFoodBeverageInvoiceSchema,
} from './food-beverages.schemas'

function requireViewAccess(req: Request) {
  if (!canViewFoodBeverages(req)) {
    throw new HttpError(403, 'You do not have access to the Food & Beverages workspace for this project.')
  }
}

function requireManageAccess(req: Request) {
  if (!canManageFoodBeverages(req)) {
    throw new HttpError(403, 'Only production leadership can manage Food & Beverages operations.')
  }
}

function requireForecastAccess(req: Request) {
  if (!canSubmitFoodForecast(req)) {
    throw new HttpError(403, 'You cannot submit food forecasts for this project.')
  }
}

export async function getFoodBeveragesOverviewController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageOverviewQuerySchema.parse(req.query)
  const overview = await getFoodBeveragesOverview(query.projectId)
  res.json({ overview })
}

export async function listFoodBeverageForecastsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageForecastListQuerySchema.parse(req.query)
  const forecasts = await listFoodBeverageForecasts(query.projectId, query.date ?? null)
  res.json({ forecasts })
}

export async function createFoodBeveragesForecastController(req: Request, res: Response) {
  requireForecastAccess(req)
  const payload = foodBeverageForecastSchema.parse(req.body)
  const forecast = await createFoodBeverageForecast(payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.status(201).json({ forecast })
}

export async function listFoodBeverageMealLogsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageMealLogListQuerySchema.parse(req.query)
  const mealLogs = await listFoodBeverageMealLogs(query.projectId, query.date ?? null)
  res.json({ mealLogs })
}

export async function createFoodBeverageMealLogController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = foodBeverageMealLogSchema.parse(req.body)
  const mealLog = await createFoodBeverageMealLog(payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.status(201).json({ mealLog })
}

export async function listFoodBeverageVendorsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageVendorListQuerySchema.parse(req.query)
  const vendors = await listFoodBeverageVendors(query.projectId)
  res.json({ vendors })
}

export async function createFoodBeverageVendorController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = foodBeverageVendorSchema.parse(req.body)
  const vendor = await createFoodBeverageVendor(payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.status(201).json({ vendor })
}

export async function updateFoodBeverageVendorController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = foodBeverageVendorSchema.parse(req.body)
  const vendor = await updateFoodBeverageVendor(payload.projectId, String(req.params.vendorId ?? ''), payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.json({ vendor })
}

export async function listFoodBeverageDietaryProfilesController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageDietaryListQuerySchema.parse(req.query)
  const dietaryProfiles = await listFoodBeverageDietaryProfiles(query.projectId, query.department ?? null)
  res.json({ dietaryProfiles })
}

export async function upsertFoodBeverageDietaryProfileController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = foodBeverageDietaryProfileSchema.parse(req.body)
  const profile = await upsertFoodBeverageDietaryProfile(payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.status(201).json({ profile })
}

export async function listFoodBeverageInvoicesController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageInvoiceListQuerySchema.parse(req.query)
  const invoices = await listFoodBeverageInvoices(query.projectId, query.status ?? null)
  res.json({ invoices })
}

export async function createFoodBeverageInvoiceController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = createFoodBeverageInvoiceSchema.parse(req.body)
  const invoice = await createFoodBeverageInvoice(payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null, req.file ?? null)
  res.status(201).json({ invoice })
}

export async function updateFoodBeverageInvoiceController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = updateFoodBeverageInvoiceSchema.parse(req.body)
  const invoice = await updateFoodBeverageInvoice(payload.projectId, String(req.params.invoiceId ?? ''), payload, req.authUser?.id ?? null, req.authUser?.fullName ?? req.authUser?.email ?? null)
  res.json({ invoice })
}

export async function getFoodBeverageAnalyticsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageAnalyticsQuerySchema.parse(req.query)
  const analytics = await getFoodBeverageAnalytics(query.projectId)
  res.json({ analytics })
}

export async function listFoodBeverageTimelineController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeverageTimelineQuerySchema.parse(req.query)
  const timeline = await listFoodBeverageTimeline(query.projectId)
  res.json({ timeline })
}

export async function listFoodBeverageAlertsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = foodBeveragesProjectQuerySchema.parse(req.query)
  const alerts = await listFoodBeverageAlerts(query.projectId)
  res.json({ alerts })
}
