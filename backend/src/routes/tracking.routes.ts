import { Router } from 'express'
import { getLiveTrackingController, getTrackingMapImageController } from '../controllers/tracking.controller'
import { requireAuth } from '../middlewares/auth'
import { authorizeRoles, requireProjectAccess, requireTrackingViewer } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const trackingRouter = Router()

trackingRouter.get('/live', requireAuth, requireProjectAccess, requireTrackingViewer, asyncHandler(getLiveTrackingController))
trackingRouter.get('/map-image', requireAuth, requireProjectAccess, authorizeRoles(['EP', 'LP']), asyncHandler(getTrackingMapImageController))
