import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createAllocationController,
  createHotelController,
  deleteAllocationController,
  getAccommodationAlertsController,
  getAllocationsController,
  getHotelsController,
  getRemindersController,
  getTravelSyncController,
  updateAllocationController,
  updateHotelController,
} from './accommodation.controller'

export const accommodationRouter = Router()

accommodationRouter.get('/hotels', authMiddleware, projectAccessMiddleware, asyncHandler(getHotelsController))
accommodationRouter.post('/hotels', authMiddleware, projectAccessMiddleware, asyncHandler(createHotelController))
accommodationRouter.patch('/hotels/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateHotelController))

accommodationRouter.get('/allocations', authMiddleware, projectAccessMiddleware, asyncHandler(getAllocationsController))
accommodationRouter.post('/allocations', authMiddleware, projectAccessMiddleware, asyncHandler(createAllocationController))
accommodationRouter.patch('/allocations/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateAllocationController))
accommodationRouter.delete('/allocations/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteAllocationController))

accommodationRouter.get('/reminders', authMiddleware, projectAccessMiddleware, asyncHandler(getRemindersController))
accommodationRouter.get('/travel-sync', authMiddleware, projectAccessMiddleware, asyncHandler(getTravelSyncController))
accommodationRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getAccommodationAlertsController))
