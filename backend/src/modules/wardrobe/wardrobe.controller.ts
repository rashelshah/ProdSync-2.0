import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import {
  canAccessWardrobeModule,
  canDeleteWardrobeContinuity,
  canManageWardrobeAccessories,
  canManageWardrobeContinuity,
  canManageWardrobeInventory,
  canManageWardrobeLaundry,
} from '../../utils/departmentRoleAccess'
import {
  wardrobeAccessoryCreateSchema,
  wardrobeAccessoryUpdateSchema,
  wardrobeBatchParamSchema,
  wardrobeContinuityCreateSchema,
  wardrobeContinuityQuerySchema,
  wardrobeInventoryCreateSchema,
  wardrobeInventoryUpdateSchema,
  wardrobeLaundryCreateSchema,
  wardrobeLaundryUpdateSchema,
  wardrobeProjectQuerySchema,
} from './wardrobe.schemas'
import {
  createAccessoryItem,
  createContinuityLog,
  createLaundryBatch,
  createWardrobeInventoryItem,
  deleteContinuityLog,
  getContinuityLogById,
  listAccessories,
  listContinuityLogs,
  listLaundryBatches,
  listWardrobeAlerts,
  listWardrobeInventory,
  updateAccessoryItem,
  updateLaundryBatchStatus,
  updateWardrobeInventoryItem,
} from './wardrobe.service'

export async function getWardrobeContinuityController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const query = wardrobeContinuityQuerySchema.parse(req.query)
  const logs = await listContinuityLogs(query.projectId, {
    scene: query.scene,
    character: query.character,
  })
  res.json({ logs })
}

export async function createWardrobeContinuityController(req: Request, res: Response) {
  if (!canManageWardrobeContinuity(req)) {
    throw new HttpError(403, 'This role cannot create wardrobe continuity logs for this project.')
  }

  const payload = wardrobeContinuityCreateSchema.parse(req.body)
  const log = await createContinuityLog(payload, req.authUser?.id ?? null, req.file ?? undefined)
  res.status(201).json({ log })
}

export async function getWardrobeContinuityByIdController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = wardrobeProjectQuerySchema.parse({ projectId })
  const log = await getContinuityLogById(query.projectId, String(req.params.id ?? ''))
  res.json({ log })
}

export async function deleteWardrobeContinuityController(req: Request, res: Response) {
  if (!canDeleteWardrobeContinuity(req)) {
    throw new HttpError(403, 'Only the Costume Supervisor or production leadership can remove continuity logs.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = wardrobeProjectQuerySchema.parse({ projectId })
  await deleteContinuityLog(query.projectId, String(req.params.id ?? ''))
  res.json({ ok: true })
}

export async function getWardrobeLaundryController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const query = wardrobeProjectQuerySchema.parse(req.query)
  const batches = await listLaundryBatches(query.projectId)
  res.json({ batches })
}

export async function createWardrobeLaundryController(req: Request, res: Response) {
  if (!canManageWardrobeLaundry(req)) {
    throw new HttpError(403, 'This role cannot create wardrobe laundry batches for this project.')
  }

  const payload = wardrobeLaundryCreateSchema.parse(req.body)
  const batch = await createLaundryBatch(payload, req.authUser?.id ?? null)
  res.status(201).json({ batch })
}

export async function updateWardrobeLaundryController(req: Request, res: Response) {
  if (!canManageWardrobeLaundry(req)) {
    throw new HttpError(403, 'This role cannot update wardrobe laundry batches for this project.')
  }

  const params = wardrobeBatchParamSchema.parse(req.params)
  const payload = wardrobeLaundryUpdateSchema.parse(req.body)
  const batch = await updateLaundryBatchStatus(params.id, payload)
  res.json({ batch })
}

export async function getWardrobeInventoryController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const query = wardrobeProjectQuerySchema.parse(req.query)
  const items = await listWardrobeInventory(query.projectId)
  res.json({ items })
}

export async function createWardrobeInventoryController(req: Request, res: Response) {
  if (!canManageWardrobeInventory(req)) {
    throw new HttpError(403, 'This role cannot add wardrobe inventory for this project.')
  }

  const payload = wardrobeInventoryCreateSchema.parse(req.body)
  const item = await createWardrobeInventoryItem(payload)
  res.status(201).json({ item })
}

export async function updateWardrobeInventoryController(req: Request, res: Response) {
  if (!canManageWardrobeInventory(req)) {
    throw new HttpError(403, 'This role cannot update wardrobe inventory for this project.')
  }

  const payload = wardrobeInventoryUpdateSchema.parse(req.body)
  const item = await updateWardrobeInventoryItem(String(req.params.id ?? ''), payload)
  res.json({ item })
}

export async function getWardrobeAccessoriesController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const query = wardrobeProjectQuerySchema.parse(req.query)
  const items = await listAccessories(query.projectId)
  res.json({ items })
}

export async function createWardrobeAccessoriesController(req: Request, res: Response) {
  if (!canManageWardrobeAccessories(req)) {
    throw new HttpError(403, 'This role cannot add wardrobe accessories for this project.')
  }

  const payload = wardrobeAccessoryCreateSchema.parse(req.body)
  const item = await createAccessoryItem(payload)
  res.status(201).json({ item })
}

export async function updateWardrobeAccessoriesController(req: Request, res: Response) {
  if (!canManageWardrobeAccessories(req)) {
    throw new HttpError(403, 'This role cannot update wardrobe accessories for this project.')
  }

  const payload = wardrobeAccessoryUpdateSchema.parse(req.body)
  const item = await updateAccessoryItem(String(req.params.id ?? ''), payload)
  res.json({ item })
}

export async function getWardrobeAlertsController(req: Request, res: Response) {
  if (!canAccessWardrobeModule(req)) {
    throw new HttpError(403, 'You do not have wardrobe workspace access for this project.')
  }

  const query = wardrobeProjectQuerySchema.parse(req.query)
  const alerts = await listWardrobeAlerts(query.projectId)
  res.json({ alerts })
}
