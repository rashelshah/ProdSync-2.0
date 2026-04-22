import { Router } from 'express'
import { actorLookUpload } from '../../config/actorUploads'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createActorLookController,
  createActorPaymentController,
  createCallSheetController,
  createJuniorArtistController,
  deleteActorLookController,
  deleteJuniorArtistController,
  getActorAlertsController,
  getActorLooksController,
  getActorPaymentsController,
  getCallSheetByIdController,
  getCallSheetsController,
  getJuniorArtistLogsController,
  updateActorPaymentController,
} from './actors.controller'

export const actorsRouter = Router()

actorsRouter.post('/juniors', authMiddleware, projectAccessMiddleware, asyncHandler(createJuniorArtistController))
actorsRouter.get('/juniors', authMiddleware, projectAccessMiddleware, asyncHandler(getJuniorArtistLogsController))
actorsRouter.delete('/juniors/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteJuniorArtistController))

actorsRouter.post('/call-sheet', authMiddleware, projectAccessMiddleware, asyncHandler(createCallSheetController))
actorsRouter.get('/call-sheet', authMiddleware, projectAccessMiddleware, asyncHandler(getCallSheetsController))
actorsRouter.get('/call-sheet/:id', authMiddleware, projectAccessMiddleware, asyncHandler(getCallSheetByIdController))

actorsRouter.post('/payments', authMiddleware, projectAccessMiddleware, asyncHandler(createActorPaymentController))
actorsRouter.get('/payments', authMiddleware, projectAccessMiddleware, asyncHandler(getActorPaymentsController))
actorsRouter.patch('/payments/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateActorPaymentController))

actorsRouter.post('/look', authMiddleware, actorLookUpload.single('image'), projectAccessMiddleware, asyncHandler(createActorLookController))
actorsRouter.get('/look', authMiddleware, projectAccessMiddleware, asyncHandler(getActorLooksController))
actorsRouter.delete('/look/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteActorLookController))

actorsRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getActorAlertsController))
