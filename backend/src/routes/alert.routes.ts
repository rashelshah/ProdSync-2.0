import { Router } from 'express'
import { getTransportAlertsController } from '../controllers/alert.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const alertRouter = Router()

alertRouter.get('/', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(getTransportAlertsController))
