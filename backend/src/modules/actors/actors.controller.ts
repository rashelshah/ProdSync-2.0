import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import {
  canAccessActorsModule,
  canDeleteActorLooks,
  canManageActorsModule,
} from '../../utils/departmentRoleAccess'
import {
  actorLookCreateSchema,
  actorLookQuerySchema,
  actorPaymentCreateSchema,
  actorPaymentUpdateSchema,
  actorRecordParamSchema,
  actorsProjectQuerySchema,
  callSheetCreateSchema,
  juniorArtistCreateSchema,
  juniorArtistQuerySchema,
} from './actors.schemas'
import {
  createActorLook,
  createActorPayment,
  createCallSheet,
  createJuniorArtistLog,
  deleteActorLook,
  deleteJuniorArtistLog,
  getCallSheetById,
  listActorAlerts,
  listActorLooks,
  listActorPayments,
  listCallSheets,
  listJuniorArtistLogs,
  updateActorPaymentStatus,
} from './actors.service'

export async function createJuniorArtistController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot create junior artist logs for this project.')
  }

  const payload = juniorArtistCreateSchema.parse(req.body)
  const log = await createJuniorArtistLog(payload, req.authUser?.id ?? null)
  res.status(201).json({ log })
}

export async function getJuniorArtistLogsController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const query = juniorArtistQuerySchema.parse(req.query)
  const logs = await listJuniorArtistLogs(query.projectId, { shootDate: query.shootDate })
  res.json({ logs })
}

export async function deleteJuniorArtistController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot remove junior artist logs for this project.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = actorsProjectQuerySchema.parse({ projectId })
  const params = actorRecordParamSchema.parse(req.params)
  await deleteJuniorArtistLog(query.projectId, params.id)
  res.json({ ok: true })
}

export async function createCallSheetController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot create actor call sheets for this project.')
  }

  const payload = callSheetCreateSchema.parse(req.body)
  const callSheet = await createCallSheet(payload)
  res.status(201).json({ callSheet })
}

export async function getCallSheetsController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const query = actorsProjectQuerySchema.parse(req.query)
  const response = await listCallSheets(query.projectId)
  res.json(response)
}

export async function getCallSheetByIdController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = actorsProjectQuerySchema.parse({ projectId })
  const params = actorRecordParamSchema.parse(req.params)
  const callSheet = await getCallSheetById(query.projectId, params.id)
  res.json({ callSheet })
}

export async function createActorPaymentController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot create actor payments for this project.')
  }

  const payload = actorPaymentCreateSchema.parse(req.body)
  const payment = await createActorPayment(payload)
  res.status(201).json({ payment })
}

export async function getActorPaymentsController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const query = actorsProjectQuerySchema.parse(req.query)
  const payments = await listActorPayments(query.projectId)
  res.json({ payments })
}

export async function updateActorPaymentController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot update actor payments for this project.')
  }

  const params = actorRecordParamSchema.parse(req.params)
  const payload = actorPaymentUpdateSchema.parse(req.body)
  const payment = await updateActorPaymentStatus(params.id, payload)
  res.json({ payment })
}

export async function createActorLookController(req: Request, res: Response) {
  if (!canManageActorsModule(req)) {
    throw new HttpError(403, 'This role cannot create actor looks for this project.')
  }

  const payload = actorLookCreateSchema.parse(req.body)
  const look = await createActorLook(payload, req.file ?? undefined)
  res.status(201).json({ look })
}

export async function getActorLooksController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const query = actorLookQuerySchema.parse(req.query)
  const looks = await listActorLooks(query.projectId, {
    actor: query.actor,
    character: query.character,
  })
  res.json({ looks })
}

export async function deleteActorLookController(req: Request, res: Response) {
  if (!canDeleteActorLooks(req)) {
    throw new HttpError(403, 'Only the Actor Coordinator or production leadership can remove look tests.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = actorsProjectQuerySchema.parse({ projectId })
  const params = actorRecordParamSchema.parse(req.params)
  await deleteActorLook(query.projectId, params.id)
  res.json({ ok: true })
}

export async function getActorAlertsController(req: Request, res: Response) {
  if (!canAccessActorsModule(req)) {
    throw new HttpError(403, 'You do not have actor workspace access for this project.')
  }

  const query = actorsProjectQuerySchema.parse(req.query)
  const alerts = await listActorAlerts(query.projectId)
  res.json({ alerts })
}
