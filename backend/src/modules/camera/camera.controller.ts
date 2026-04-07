import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import {
  canAccessCameraModule,
  canLogCameraMovement,
  canManageCameraWishlist,
  canReportCameraDamage,
  canSubmitCameraRequest,
  resolveCameraApprovalStage,
} from '../../utils/departmentRoleAccess'
import {
  cameraDamageCreateSchema,
  cameraProjectQuerySchema,
  cameraRequestCreateSchema,
  cameraRequestUpdateSchema,
  cameraScanSchema,
  cameraWishlistCreateSchema,
  cameraWishlistUpdateSchema,
} from './camera.schemas'
import {
  createCameraCheckin,
  createCameraCheckout,
  createCameraRequest,
  createCameraWishlistItem,
  createDamageReport,
  deleteCameraWishlistItem,
  listCameraAlerts,
  listCameraLogs,
  listCameraRequests,
  listCameraWishlist,
  listDamageReports,
  updateCameraRequestStatus,
  updateCameraWishlistItem,
} from './camera.service'
import type { CameraApprovalStage } from './camera.types'

export async function getCameraWishlistController(req: Request, res: Response) {
  if (!canAccessCameraModule(req)) {
    throw new HttpError(403, 'You do not have camera workspace access for this project.')
  }

  console.log('[camera][wishlist][list] route hit', { query: req.query })
  const query = cameraProjectQuerySchema.parse(req.query)
  const wishlist = await listCameraWishlist(query.projectId)
  console.log('[camera][wishlist][list] db result', { projectId: query.projectId, count: wishlist.length })

  res.json({ wishlist })
}

export async function createCameraWishlistController(req: Request, res: Response) {
  if (!canManageCameraWishlist(req)) {
    throw new HttpError(403, 'Only the DOP or production leadership can manage the camera wishlist.')
  }

  console.log('[camera][wishlist][create] route hit', { body: req.body })
  const payload = cameraWishlistCreateSchema.parse(req.body)
  const item = await createCameraWishlistItem(payload, req.authUser?.id ?? null)
  console.log('[camera][wishlist][create] db result', { projectId: payload.projectId, itemId: item.id })

  res.status(201).json({ item })
}

export async function updateCameraWishlistController(req: Request, res: Response) {
  if (!canManageCameraWishlist(req)) {
    throw new HttpError(403, 'Only the DOP or production leadership can manage the camera wishlist.')
  }

  console.log('[camera][wishlist][update] route hit', { id: req.params.id, body: req.body })
  const payload = cameraWishlistUpdateSchema.parse(req.body)
  const item = await updateCameraWishlistItem(String(req.params.id ?? ''), payload)
  console.log('[camera][wishlist][update] db result', { projectId: payload.projectId, itemId: item.id })

  res.json({ item })
}

export async function deleteCameraWishlistController(req: Request, res: Response) {
  if (!canManageCameraWishlist(req)) {
    throw new HttpError(403, 'Only the DOP or production leadership can manage the camera wishlist.')
  }

  console.log('[camera][wishlist][delete] route hit', { id: req.params.id, body: req.body, query: req.query })
  const projectId = String(req.body?.projectId ?? req.query?.projectId ?? '')
  const payload = cameraProjectQuerySchema.parse({ projectId })
  await deleteCameraWishlistItem(String(req.params.id ?? ''), payload.projectId)
  console.log('[camera][wishlist][delete] db result', { projectId: payload.projectId, itemId: req.params.id })

  res.json({ ok: true })
}

export async function getCameraRequestsController(req: Request, res: Response) {
  if (!canAccessCameraModule(req)) {
    throw new HttpError(403, 'You do not have camera workspace access for this project.')
  }

  console.log('[camera][requests][list] route hit', { query: req.query })
  const query = cameraProjectQuerySchema.parse(req.query)
  const requests = await listCameraRequests(query.projectId)
  console.log('[camera][requests][list] db result', { projectId: query.projectId, count: requests.length })

  res.json({ requests })
}

export async function createCameraRequestController(req: Request, res: Response) {
  if (!canSubmitCameraRequest(req)) {
    throw new HttpError(403, 'This role cannot submit camera requests for this project.')
  }

  console.log('[camera][requests][create] route hit', { body: req.body })
  const payload = cameraRequestCreateSchema.parse(req.body)
  const request = await createCameraRequest(payload, req.authUser?.id ?? null)
  console.log('[camera][requests][create] db result', { projectId: payload.projectId, requestId: request.id })

  res.status(201).json({ request })
}

export async function updateCameraRequestController(req: Request, res: Response) {
  console.log('[camera][requests][update] route hit', { id: req.params.id, body: req.body })
  const payload = cameraRequestUpdateSchema.parse(req.body)
  const approvalStage: CameraApprovalStage | null = resolveCameraApprovalStage(req)

  if (!approvalStage) {
    throw new HttpError(403, 'Only DOP or production leadership can approve camera requests.')
  }

  const request = await updateCameraRequestStatus(String(req.params.id ?? ''), payload, approvalStage, req.authUser?.id ?? null)
  console.log('[camera][requests][update] db result', { projectId: payload.projectId, requestId: request.id, status: request.status })

  res.json({ request })
}

export async function createCameraCheckinController(req: Request, res: Response) {
  if (!canLogCameraMovement(req)) {
    throw new HttpError(403, 'This role cannot log camera movement for this project.')
  }

  console.log('[camera][checkin][create] route hit', { body: req.body })
  const payload = cameraScanSchema.parse(req.body)
  const log = await createCameraCheckin(payload, req.authUser?.id ?? null)
  console.log('[camera][checkin][create] db result', { projectId: payload.projectId, logId: log.id })

  res.status(201).json({ log })
}

export async function createCameraCheckoutController(req: Request, res: Response) {
  if (!canLogCameraMovement(req)) {
    throw new HttpError(403, 'This role cannot log camera movement for this project.')
  }

  console.log('[camera][checkout][create] route hit', { body: req.body })
  const payload = cameraScanSchema.parse(req.body)
  const log = await createCameraCheckout(payload, req.authUser?.id ?? null)
  console.log('[camera][checkout][create] db result', { projectId: payload.projectId, logId: log.id })

  res.json({ log })
}

export async function getCameraLogsController(req: Request, res: Response) {
  if (!canAccessCameraModule(req)) {
    throw new HttpError(403, 'You do not have camera workspace access for this project.')
  }

  console.log('[camera][logs][list] route hit', { query: req.query })
  const query = cameraProjectQuerySchema.parse(req.query)
  const logs = await listCameraLogs(query.projectId)
  console.log('[camera][logs][list] db result', { projectId: query.projectId, count: logs.length })

  res.json({ logs })
}

export async function createDamageReportController(req: Request, res: Response) {
  if (!canReportCameraDamage(req)) {
    throw new HttpError(403, 'This role cannot report camera issues for this project.')
  }

  console.log('[camera][damage][create] route hit', { body: req.body })
  const payload = cameraDamageCreateSchema.parse(req.body)
  const report = await createDamageReport(payload, req.authUser?.id ?? null)
  console.log('[camera][damage][create] db result', { projectId: payload.projectId, reportId: report.id })

  res.status(201).json({ report })
}

export async function getDamageReportsController(req: Request, res: Response) {
  if (!canAccessCameraModule(req)) {
    throw new HttpError(403, 'You do not have camera workspace access for this project.')
  }

  console.log('[camera][damage][list] route hit', { query: req.query })
  const query = cameraProjectQuerySchema.parse(req.query)
  const reports = await listDamageReports(query.projectId)
  console.log('[camera][damage][list] db result', { projectId: query.projectId, count: reports.length })

  res.json({ reports })
}

export async function getCameraAlertsController(req: Request, res: Response) {
  if (!canAccessCameraModule(req)) {
    throw new HttpError(403, 'You do not have camera workspace access for this project.')
  }

  console.log('[camera][alerts][list] route hit', { query: req.query })
  const query = cameraProjectQuerySchema.parse(req.query)
  const alerts = await listCameraAlerts(query.projectId)
  console.log('[camera][alerts][list] db result', { projectId: query.projectId, count: alerts.length })

  res.json({ alerts })
}
