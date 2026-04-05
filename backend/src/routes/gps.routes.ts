import { Router } from 'express'
import { getGpsLogsController } from '../controllers/gps.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const gpsRouter = Router()

gpsRouter.get('/', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(getGpsLogsController))
