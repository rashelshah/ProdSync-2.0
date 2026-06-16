import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import { foodBeverageInvoiceUpload } from './food-beverages.uploads'
import {
  createFoodBeveragesForecastController,
  createFoodBeverageInvoiceController,
  createFoodBeverageMealLogController,
  createFoodBeverageVendorController,
  getFoodBeverageAnalyticsController,
  getFoodBeverageInvoicePdfController,
  getFoodBeveragesOverviewController,
  listFoodBeverageAlertsController,
  listFoodBeverageDietaryProfilesController,
  listFoodBeverageForecastsController,
  listFoodBeverageInvoicesController,
  listFoodBeverageMealLogsController,
  listFoodBeverageTimelineController,
  listFoodBeverageVendorsController,
  updateFoodBeverageInvoiceController,
  updateFoodBeverageVendorController,
  upsertFoodBeverageDietaryProfileController,
} from './food-beverages.controller'

export const foodBeveragesRouter = Router()

foodBeveragesRouter.get('/overview', authMiddleware, projectAccessMiddleware, asyncHandler(getFoodBeveragesOverviewController))
foodBeveragesRouter.get('/forecasts', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageForecastsController))
foodBeveragesRouter.post('/forecasts', authMiddleware, projectAccessMiddleware, asyncHandler(createFoodBeveragesForecastController))
foodBeveragesRouter.get('/meal-logs', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageMealLogsController))
foodBeveragesRouter.post('/meal-logs', authMiddleware, projectAccessMiddleware, asyncHandler(createFoodBeverageMealLogController))
foodBeveragesRouter.get('/vendors', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageVendorsController))
foodBeveragesRouter.post('/vendors', authMiddleware, projectAccessMiddleware, asyncHandler(createFoodBeverageVendorController))
foodBeveragesRouter.patch('/vendors/:vendorId', authMiddleware, projectAccessMiddleware, asyncHandler(updateFoodBeverageVendorController))
foodBeveragesRouter.get('/dietary', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageDietaryProfilesController))
foodBeveragesRouter.post('/dietary', authMiddleware, projectAccessMiddleware, asyncHandler(upsertFoodBeverageDietaryProfileController))
foodBeveragesRouter.get('/analytics', authMiddleware, projectAccessMiddleware, asyncHandler(getFoodBeverageAnalyticsController))
foodBeveragesRouter.get('/timeline', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageTimelineController))
foodBeveragesRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageAlertsController))
foodBeveragesRouter.get('/invoices', authMiddleware, projectAccessMiddleware, asyncHandler(listFoodBeverageInvoicesController))
foodBeveragesRouter.get('/invoices/:invoiceId/pdf', authMiddleware, projectAccessMiddleware, asyncHandler(getFoodBeverageInvoicePdfController))
foodBeveragesRouter.post('/invoices', authMiddleware, foodBeverageInvoiceUpload.single('file'), projectAccessMiddleware, asyncHandler(createFoodBeverageInvoiceController))
foodBeveragesRouter.patch('/invoices/:invoiceId', authMiddleware, foodBeverageInvoiceUpload.single('file'), projectAccessMiddleware, asyncHandler(updateFoodBeverageInvoiceController))
