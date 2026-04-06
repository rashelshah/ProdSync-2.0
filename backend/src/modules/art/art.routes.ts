import { Router } from 'express'
import { artReceiptUpload } from '../../config/artUploads'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createArtExpenseController,
  createArtPropController,
  createArtSetController,
  deleteArtExpenseController,
  deleteArtPropController,
  getArtAlertsController,
  getArtBudgetController,
  getArtExpenseController,
  getArtExpensesController,
  getArtPropsController,
  getArtSetsController,
  updateArtPropController,
  updateArtSetController,
} from './art.controller'

export const artRouter = Router()

artRouter.get('/expenses', authMiddleware, projectAccessMiddleware, asyncHandler(getArtExpensesController))
artRouter.post('/expenses', authMiddleware, artReceiptUpload.single('receipt'), projectAccessMiddleware, asyncHandler(createArtExpenseController))
artRouter.get('/expenses/:id', authMiddleware, projectAccessMiddleware, asyncHandler(getArtExpenseController))
artRouter.delete('/expenses/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteArtExpenseController))

artRouter.get('/props', authMiddleware, projectAccessMiddleware, asyncHandler(getArtPropsController))
artRouter.post('/props', authMiddleware, projectAccessMiddleware, asyncHandler(createArtPropController))
artRouter.patch('/props/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateArtPropController))
artRouter.delete('/props/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteArtPropController))

artRouter.get('/set', authMiddleware, projectAccessMiddleware, asyncHandler(getArtSetsController))
artRouter.post('/set', authMiddleware, projectAccessMiddleware, asyncHandler(createArtSetController))
artRouter.patch('/set/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateArtSetController))

artRouter.get('/budget', authMiddleware, projectAccessMiddleware, asyncHandler(getArtBudgetController))
artRouter.get('/alerts', authMiddleware, projectAccessMiddleware, asyncHandler(getArtAlertsController))
