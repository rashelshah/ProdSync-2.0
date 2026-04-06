import { Router } from 'express'
import { reverseGeocodeController, searchLocationSuggestionsController } from '../controllers/location.controller'
import { requireAuth } from '../middlewares/auth'
import { requireProjectAccess } from '../middlewares/rbac'
import { asyncHandler } from '../utils/asyncHandler'

export const locationRouter = Router()

locationRouter.get('/reverse', requireAuth, requireProjectAccess, asyncHandler(reverseGeocodeController))
locationRouter.get('/reverse-geocode', requireAuth, requireProjectAccess, asyncHandler(reverseGeocodeController))
locationRouter.get('/search', requireAuth, requireProjectAccess, asyncHandler(searchLocationSuggestionsController))
