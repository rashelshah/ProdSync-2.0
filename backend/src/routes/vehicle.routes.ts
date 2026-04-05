import { Router } from 'express'
import { createVehicleController, getAssignableDriversController, getVehiclesController, updateVehicleController } from '../controllers/vehicle.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const vehicleRouter = Router()

vehicleRouter.get('/assignable-drivers', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(getAssignableDriversController))
vehicleRouter.get('/', requireAuth, requireProjectAccess, asyncHandler(getVehiclesController))
vehicleRouter.post('/', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(createVehicleController))
vehicleRouter.patch('/:id', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(updateVehicleController))
