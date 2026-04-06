import { Router } from 'express'
import { getLiveTrackingController, getTrackingMapImageController } from '../controllers/tracking.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const trackingRouter = Router()

trackingRouter.get('/live', requireAuth, requireProjectAccess, requireRole('DRIVER', 'TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(getLiveTrackingController))
trackingRouter.get('/map-image', requireAuth, requireProjectAccess, requireRole('DRIVER', 'TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(getTrackingMapImageController))
