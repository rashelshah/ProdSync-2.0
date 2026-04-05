import { Router } from 'express'
import { endTripController, getTripsController, startTripController } from '../controllers/trip.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const tripRouter = Router()

tripRouter.get('/', requireAuth, requireProjectAccess, asyncHandler(getTripsController))
tripRouter.post('/start', requireAuth, requireProjectAccess, requireRole('DRIVER', 'TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(startTripController))
tripRouter.post('/end', requireAuth, requireProjectAccess, requireRole('DRIVER', 'TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(endTripController))
