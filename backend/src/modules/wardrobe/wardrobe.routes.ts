import { Router } from 'express'
import { wardrobeContinuityUpload } from '../../config/wardrobeUploads'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createWardrobeAccessoriesController,
  createWardrobeContinuityController,
  createWardrobeInventoryController,
  createWardrobeLaundryController,
  deleteWardrobeContinuityController,
  getWardrobeAccessoriesController,
  getWardrobeAlertsController,
  getWardrobeContinuityByIdController,
  getWardrobeContinuityController,
  getWardrobeInventoryController,
  getWardrobeLaundryController,
  updateWardrobeAccessoriesController,
  updateWardrobeInventoryController,
  updateWardrobeLaundryController,
} from './wardrobe.controller'

export const wardrobeRouter = Router()

wardrobeRouter.get('/continuity', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeContinuityController))
wardrobeRouter.post('/continuity', authMiddleware, wardrobeContinuityUpload.single('image'), projectAccessMiddleware, asyncHandler(createWardrobeContinuityController))
wardrobeRouter.get('/continuity/:id', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeContinuityByIdController))
wardrobeRouter.delete('/continuity/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteWardrobeContinuityController))

wardrobeRouter.get('/laundry', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeLaundryController))
wardrobeRouter.post('/laundry', authMiddleware, projectAccessMiddleware, asyncHandler(createWardrobeLaundryController))
wardrobeRouter.patch('/laundry/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateWardrobeLaundryController))

wardrobeRouter.get('/inventory', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeInventoryController))
wardrobeRouter.post('/inventory', authMiddleware, projectAccessMiddleware, asyncHandler(createWardrobeInventoryController))
wardrobeRouter.patch('/inventory/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateWardrobeInventoryController))

wardrobeRouter.get('/accessories', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeAccessoriesController))
wardrobeRouter.post('/accessories', authMiddleware, projectAccessMiddleware, asyncHandler(createWardrobeAccessoriesController))
wardrobeRouter.patch('/accessories/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateWardrobeAccessoriesController))

wardrobeRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getWardrobeAlertsController))
