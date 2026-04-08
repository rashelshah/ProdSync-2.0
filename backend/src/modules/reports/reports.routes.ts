import { Router } from 'express'
import {
  exportReport,
  getBurnChart,
  getDepartmentBreakdown,
  getReportAlerts,
  getReportSummary,
} from '../../controllers/report.controller'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'

export const reportsRouter = Router()

reportsRouter.get('/summary', authMiddleware, projectAccessMiddleware, asyncHandler(getReportSummary))
reportsRouter.get('/burn-chart', authMiddleware, projectAccessMiddleware, asyncHandler(getBurnChart))
reportsRouter.get('/departments', authMiddleware, projectAccessMiddleware, asyncHandler(getDepartmentBreakdown))
reportsRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getReportAlerts))
reportsRouter.get('/export', authMiddleware, projectAccessMiddleware, asyncHandler(exportReport))
