import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createCameraCheckinController,
  createCameraCheckoutController,
  createCameraRequestController,
  createCameraWishlistController,
  createDamageReportController,
  deleteCameraWishlistController,
  getCameraAlertsController,
  getCameraLogsController,
  getCameraRequestsController,
  getCameraWishlistController,
  getDamageReportsController,
  updateCameraRequestController,
  updateCameraWishlistController,
} from './camera.controller'

export const cameraRouter = Router()

cameraRouter.get('/wishlist', authMiddleware, projectAccessMiddleware, asyncHandler(getCameraWishlistController))
cameraRouter.post('/wishlist', authMiddleware, projectAccessMiddleware, asyncHandler(createCameraWishlistController))
cameraRouter.put('/wishlist/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateCameraWishlistController))
cameraRouter.delete('/wishlist/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteCameraWishlistController))

cameraRouter.get('/requests', authMiddleware, projectAccessMiddleware, asyncHandler(getCameraRequestsController))
cameraRouter.post('/requests', authMiddleware, projectAccessMiddleware, asyncHandler(createCameraRequestController))
cameraRouter.patch('/requests/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateCameraRequestController))

cameraRouter.post('/checkin', authMiddleware, projectAccessMiddleware, asyncHandler(createCameraCheckinController))
cameraRouter.post('/checkout', authMiddleware, projectAccessMiddleware, asyncHandler(createCameraCheckoutController))
cameraRouter.get('/logs', authMiddleware, projectAccessMiddleware, asyncHandler(getCameraLogsController))

cameraRouter.post('/damage', authMiddleware, projectAccessMiddleware, asyncHandler(createDamageReportController))
cameraRouter.get('/damage', authMiddleware, projectAccessMiddleware, asyncHandler(getDamageReportsController))

cameraRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getCameraAlertsController))
