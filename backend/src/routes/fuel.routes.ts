import { Router } from 'express'
import { createFuelLogController, getFuelLogsController, reviewFuelLogController } from '../controllers/fuel.controller'
import { transportUpload } from '../config/uploads'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess, requireRole } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const fuelRouter = Router()

fuelRouter.get('/', requireAuth, requireProjectAccess, asyncHandler(getFuelLogsController))
fuelRouter.post(
  '/',
  requireAuth,
  transportUpload.fields([
    { name: 'receiptImage', maxCount: 1 },
    { name: 'odometerImage', maxCount: 1 },
  ]),
  requireProjectAccess,
  requireRole('DRIVER', 'TRANSPORT_CAPTAIN', 'LINE_PRODUCER'),
  asyncHandler(createFuelLogController),
)
fuelRouter.post('/:id/review', requireAuth, requireProjectAccess, requireRole('TRANSPORT_CAPTAIN', 'LINE_PRODUCER'), asyncHandler(reviewFuelLogController))
