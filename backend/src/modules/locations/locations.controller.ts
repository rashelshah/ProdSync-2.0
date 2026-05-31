import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import { canCommentOnLocations, canManageLocations, canUploadLocationMedia, canViewLocations } from './locations.access'
import {
  createLocationCommentSchema,
  createLocationCostSchema,
  createLocationPermissionSchema,
  createLocationSchema,
  createLocationTimelineSchema,
  locationDocumentListQuerySchema,
  locationDocumentUploadSchema,
  locationMediaListQuerySchema,
  locationMediaUploadSchema,
  locationsListQuerySchema,
  locationsProjectQuerySchema,
  updateLocationCostSchema,
  updateLocationPermissionSchema,
  updateLocationSchema,
  upsertLocationAmenitySchema,
} from './locations.schemas'
import {
  createLocation,
  createLocationComment,
  createLocationCost,
  createLocationPermission,
  createLocationTimelineEvent,
  deleteLocation,
  deleteLocationCost,
  deleteLocationDocument,
  deleteLocationMedia,
  deleteLocationPermission,
  getLocationDetail,
  getLocationsDashboard,
  getLocationsReports,
  listLocationComments,
  listLocationCosts,
  listLocationDocuments,
  listLocationMedia,
  listLocationPermissions,
  listLocations,
  listLocationTimeline,
  listLocationAmenities,
  updateLocation,
  updateLocationCost,
  updateLocationPermission,
  uploadLocationDocument,
  uploadLocationMedia,
  upsertLocationAmenity,
} from './locations.service'

function requireViewAccess(req: Request) {
  if (!canViewLocations(req)) {
    throw new HttpError(403, 'You do not have access to the locations workspace for this project.')
  }
}

function requireManageAccess(req: Request) {
  if (!canManageLocations(req)) {
    throw new HttpError(403, 'Only production leadership or the production manager can modify locations.')
  }
}

function requireMediaUploadAccess(req: Request) {
  if (!canUploadLocationMedia(req)) {
    throw new HttpError(403, 'This role cannot upload recce media for locations.')
  }
}

function requireCommentAccess(req: Request) {
  if (!canCommentOnLocations(req)) {
    throw new HttpError(403, 'This role cannot comment on locations.')
  }
}

export async function listLocationsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsListQuerySchema.parse(req.query)
  const locations = await listLocations(query)
  res.json(locations)
}

export async function getLocationDetailController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const detail = await getLocationDetail(query.projectId, String(req.params.id ?? ''))
  res.json(detail)
}

export async function createLocationController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = createLocationSchema.parse(req.body)
  const detail = await createLocation(payload, req.authUser?.id ?? null)
  res.status(201).json(detail)
}

export async function updateLocationController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = updateLocationSchema.parse(req.body)
  const detail = await updateLocation(String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.json(detail)
}

export async function deleteLocationController(req: Request, res: Response) {
  requireManageAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  await deleteLocation(query.projectId, String(req.params.id ?? ''), req.authUser?.id ?? null)
  res.json({ ok: true })
}

export async function getLocationsDashboardController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const dashboard = await getLocationsDashboard(query.projectId)
  res.json({ dashboard })
}

export async function getLocationsReportsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const reports = await getLocationsReports(query.projectId)
  res.json({ reports })
}

export async function listLocationMediaController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationMediaListQuerySchema.parse(req.query)
  const media = await listLocationMedia(query.projectId, String(req.params.id ?? ''), query.page, query.pageSize)
  res.json(media)
}

export async function uploadLocationMediaController(req: Request, res: Response) {
  requireMediaUploadAccess(req)
  if (!req.file) {
    throw new HttpError(400, 'Media file is required.')
  }
  const payload = locationMediaUploadSchema.parse(req.body)
  const media = await uploadLocationMedia(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null, req.file)
  res.status(201).json({ media })
}

export async function deleteLocationMediaController(req: Request, res: Response) {
  requireManageAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  await deleteLocationMedia(query.projectId, String(req.params.id ?? ''), String(req.params.mediaId ?? ''), req.authUser?.id ?? null)
  res.json({ ok: true })
}

export async function listLocationDocumentsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationDocumentListQuerySchema.parse(req.query)
  const documents = await listLocationDocuments(query.projectId, String(req.params.id ?? ''), query.page, query.pageSize)
  res.json(documents)
}

export async function uploadLocationDocumentController(req: Request, res: Response) {
  requireManageAccess(req)
  if (!req.file) {
    throw new HttpError(400, 'Document file is required.')
  }
  const payload = locationDocumentUploadSchema.parse(req.body)
  const document = await uploadLocationDocument(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null, req.file)
  res.status(201).json({ document })
}

export async function deleteLocationDocumentController(req: Request, res: Response) {
  requireManageAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  await deleteLocationDocument(query.projectId, String(req.params.id ?? ''), String(req.params.documentId ?? ''), req.authUser?.id ?? null)
  res.json({ ok: true })
}

export async function listLocationPermissionsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const permissions = await listLocationPermissions(query.projectId, String(req.params.id ?? ''))
  res.json({ permissions })
}

export async function createLocationPermissionController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = createLocationPermissionSchema.parse(req.body)
  const permission = await createLocationPermission(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.status(201).json({ permission })
}

export async function updateLocationPermissionController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = updateLocationPermissionSchema.parse(req.body)
  const permission = await updateLocationPermission(payload.projectId, String(req.params.id ?? ''), String(req.params.permissionId ?? ''), payload, req.authUser?.id ?? null)
  res.json({ permission })
}

export async function deleteLocationPermissionController(req: Request, res: Response) {
  requireManageAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  await deleteLocationPermission(query.projectId, String(req.params.id ?? ''), String(req.params.permissionId ?? ''), req.authUser?.id ?? null)
  res.json({ ok: true })
}

export async function listLocationAmenitiesController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const amenities = await listLocationAmenities(query.projectId, String(req.params.id ?? ''))
  res.json({ amenities })
}

export async function upsertLocationAmenityController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = upsertLocationAmenitySchema.parse(req.body)
  const amenity = await upsertLocationAmenity(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.json({ amenity })
}

export async function listLocationTimelineController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const timeline = await listLocationTimeline(query.projectId, String(req.params.id ?? ''))
  res.json({ timeline })
}

export async function createLocationTimelineController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = createLocationTimelineSchema.parse(req.body)
  const timelineEvent = await createLocationTimelineEvent(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.status(201).json({ timelineEvent })
}

export async function listLocationCommentsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const comments = await listLocationComments(query.projectId, String(req.params.id ?? ''))
  res.json({ comments })
}

export async function createLocationCommentController(req: Request, res: Response) {
  requireCommentAccess(req)
  const payload = createLocationCommentSchema.parse(req.body)
  const comment = await createLocationComment(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.status(201).json({ comment })
}

export async function listLocationCostsController(req: Request, res: Response) {
  requireViewAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  const costs = await listLocationCosts(query.projectId, String(req.params.id ?? ''))
  res.json({ costs })
}

export async function createLocationCostController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = createLocationCostSchema.parse(req.body)
  const cost = await createLocationCost(payload.projectId, String(req.params.id ?? ''), payload, req.authUser?.id ?? null)
  res.status(201).json({ cost })
}

export async function updateLocationCostController(req: Request, res: Response) {
  requireManageAccess(req)
  const payload = updateLocationCostSchema.parse(req.body)
  const cost = await updateLocationCost(payload.projectId, String(req.params.id ?? ''), String(req.params.costId ?? ''), payload, req.authUser?.id ?? null)
  res.json({ cost })
}

export async function deleteLocationCostController(req: Request, res: Response) {
  requireManageAccess(req)
  const query = locationsProjectQuerySchema.parse(req.query)
  await deleteLocationCost(query.projectId, String(req.params.id ?? ''), String(req.params.costId ?? ''), req.authUser?.id ?? null)
  res.json({ ok: true })
}

