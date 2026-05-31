import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  createLocationCommentController,
  createLocationController,
  createLocationCostController,
  createLocationPermissionController,
  createLocationTimelineController,
  deleteLocationController,
  deleteLocationCostController,
  deleteLocationDocumentController,
  deleteLocationMediaController,
  deleteLocationPermissionController,
  getLocationDetailController,
  getLocationsDashboardController,
  getLocationsReportsController,
  listLocationAmenitiesController,
  listLocationCommentsController,
  listLocationCostsController,
  listLocationDocumentsController,
  listLocationMediaController,
  listLocationPermissionsController,
  listLocationsController,
  listLocationTimelineController,
  updateLocationController,
  updateLocationCostController,
  updateLocationPermissionController,
  uploadLocationDocumentController,
  uploadLocationMediaController,
  upsertLocationAmenityController,
} from './locations.controller'
import { locationDocumentUpload, locationMediaUpload } from './locations.uploads'

export const locationsRouter = Router()

locationsRouter.get('/', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationsController))
locationsRouter.post('/', authMiddleware, projectAccessMiddleware, asyncHandler(createLocationController))

locationsRouter.get('/dashboard', authMiddleware, projectAccessMiddleware, asyncHandler(getLocationsDashboardController))
locationsRouter.get('/reports', authMiddleware, projectAccessMiddleware, asyncHandler(getLocationsReportsController))

locationsRouter.get('/:id', authMiddleware, projectAccessMiddleware, asyncHandler(getLocationDetailController))
locationsRouter.patch('/:id', authMiddleware, projectAccessMiddleware, asyncHandler(updateLocationController))
locationsRouter.delete('/:id', authMiddleware, projectAccessMiddleware, asyncHandler(deleteLocationController))

locationsRouter.get('/:id/media', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationMediaController))
locationsRouter.post('/:id/media', authMiddleware, locationMediaUpload.single('file'), projectAccessMiddleware, asyncHandler(uploadLocationMediaController))
locationsRouter.delete('/:id/media/:mediaId', authMiddleware, projectAccessMiddleware, asyncHandler(deleteLocationMediaController))

locationsRouter.get('/:id/documents', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationDocumentsController))
locationsRouter.post('/:id/documents', authMiddleware, locationDocumentUpload.single('file'), projectAccessMiddleware, asyncHandler(uploadLocationDocumentController))
locationsRouter.delete('/:id/documents/:documentId', authMiddleware, projectAccessMiddleware, asyncHandler(deleteLocationDocumentController))

locationsRouter.get('/:id/permissions', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationPermissionsController))
locationsRouter.post('/:id/permissions', authMiddleware, projectAccessMiddleware, asyncHandler(createLocationPermissionController))
locationsRouter.patch('/:id/permissions/:permissionId', authMiddleware, projectAccessMiddleware, asyncHandler(updateLocationPermissionController))
locationsRouter.delete('/:id/permissions/:permissionId', authMiddleware, projectAccessMiddleware, asyncHandler(deleteLocationPermissionController))

locationsRouter.get('/:id/amenities', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationAmenitiesController))
locationsRouter.post('/:id/amenities', authMiddleware, projectAccessMiddleware, asyncHandler(upsertLocationAmenityController))

locationsRouter.get('/:id/timeline', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationTimelineController))
locationsRouter.post('/:id/timeline', authMiddleware, projectAccessMiddleware, asyncHandler(createLocationTimelineController))

locationsRouter.get('/:id/comments', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationCommentsController))
locationsRouter.post('/:id/comments', authMiddleware, projectAccessMiddleware, asyncHandler(createLocationCommentController))

locationsRouter.get('/:id/costs', authMiddleware, projectAccessMiddleware, asyncHandler(listLocationCostsController))
locationsRouter.post('/:id/costs', authMiddleware, projectAccessMiddleware, asyncHandler(createLocationCostController))
locationsRouter.patch('/:id/costs/:costId', authMiddleware, projectAccessMiddleware, asyncHandler(updateLocationCostController))
locationsRouter.delete('/:id/costs/:costId', authMiddleware, projectAccessMiddleware, asyncHandler(deleteLocationCostController))
