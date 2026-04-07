import type { Request, Response } from 'express'
import { HttpError } from '../../utils/httpError'
import {
  canAccessArtModule,
  canCreateArtExpense,
  canDeleteArtExpense,
  canDeleteArtProps,
  canManageArtProps,
  canManageArtSets,
  canViewArtBudget,
} from '../../utils/departmentRoleAccess'
import {
  artExpenseCreateSchema,
  artProjectQuerySchema,
  artPropCreateSchema,
  artPropUpdateSchema,
  artSetCreateSchema,
  artSetUpdateSchema,
} from './art.schemas'
import {
  createArtExpense,
  createArtProp,
  createArtSet,
  deleteArtExpense,
  deleteArtProp,
  getArtBudget,
  getArtExpenseById,
  listArtAlerts,
  listArtExpenses,
  listArtProps,
  listArtSets,
  updateArtProp,
  updateArtSet,
} from './art.service'

export async function getArtExpensesController(req: Request, res: Response) {
  if (!canAccessArtModule(req)) {
    throw new HttpError(403, 'You do not have art workspace access for this project.')
  }

  const query = artProjectQuerySchema.parse(req.query)
  const expenses = await listArtExpenses(query.projectId)
  res.json({ expenses })
}

export async function createArtExpenseController(req: Request, res: Response) {
  if (!canCreateArtExpense(req)) {
    throw new HttpError(403, 'This role cannot log art expenses for this project.')
  }

  const payload = artExpenseCreateSchema.parse(req.body)
  const expense = await createArtExpense(payload, req.authUser?.id ?? '', req.file ?? undefined)
  const mismatchLabel = typeof expense.ocrData.mismatchLabel === 'string' ? expense.ocrData.mismatchLabel : null
  const validationMessage = expense.status === 'anomaly'
    ? (mismatchLabel ?? 'OCR mismatch detected.')
    : expense.status === 'verified'
      ? 'Receipt verified.'
      : 'Receipt pending review.'
  res.status(201).json({
    success: true,
    expense,
    anomaly: expense.anomaly,
    extractedAmount: expense.extractedAmount,
    manualAmount: expense.manualAmount,
    message: `Expense logged and sent to producer for approval. ${validationMessage}`,
  })
}

export async function getArtExpenseController(req: Request, res: Response) {
  if (!canAccessArtModule(req)) {
    throw new HttpError(403, 'You do not have art workspace access for this project.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = artProjectQuerySchema.parse({ projectId })
  const expense = await getArtExpenseById(query.projectId, String(req.params.id ?? ''))
  res.json({ expense })
}

export async function deleteArtExpenseController(req: Request, res: Response) {
  if (!canDeleteArtExpense(req)) {
    throw new HttpError(403, 'Only the Art Director or production leadership can remove expenses.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = artProjectQuerySchema.parse({ projectId })
  await deleteArtExpense(query.projectId, String(req.params.id ?? ''))
  res.json({ ok: true })
}

export async function getArtPropsController(req: Request, res: Response) {
  if (!canAccessArtModule(req)) {
    throw new HttpError(403, 'You do not have art workspace access for this project.')
  }

  const query = artProjectQuerySchema.parse(req.query)
  const props = await listArtProps(query.projectId)
  res.json({ props })
}

export async function createArtPropController(req: Request, res: Response) {
  if (!canManageArtProps(req)) {
    throw new HttpError(403, 'This role cannot manage art props for this project.')
  }

  const payload = artPropCreateSchema.parse(req.body)
  const prop = await createArtProp(payload)
  res.status(201).json({ prop })
}

export async function updateArtPropController(req: Request, res: Response) {
  if (!canManageArtProps(req)) {
    throw new HttpError(403, 'This role cannot manage art props for this project.')
  }

  const payload = artPropUpdateSchema.parse(req.body)
  const prop = await updateArtProp(String(req.params.id ?? ''), payload)
  res.json({ prop })
}

export async function deleteArtPropController(req: Request, res: Response) {
  if (!canDeleteArtProps(req)) {
    throw new HttpError(403, 'Only the Art Director or production leadership can remove props.')
  }

  const projectId = String(req.query?.projectId ?? req.body?.projectId ?? '')
  const query = artProjectQuerySchema.parse({ projectId })
  await deleteArtProp(query.projectId, String(req.params.id ?? ''))
  res.json({ ok: true })
}

export async function getArtSetsController(req: Request, res: Response) {
  if (!canAccessArtModule(req)) {
    throw new HttpError(403, 'You do not have art workspace access for this project.')
  }

  const query = artProjectQuerySchema.parse(req.query)
  const sets = await listArtSets(query.projectId)
  res.json({ sets })
}

export async function createArtSetController(req: Request, res: Response) {
  if (!canManageArtSets(req)) {
    throw new HttpError(403, 'This role cannot manage art set builds for this project.')
  }

  const payload = artSetCreateSchema.parse(req.body)
  const set = await createArtSet(payload)
  res.status(201).json({ set })
}

export async function updateArtSetController(req: Request, res: Response) {
  if (!canManageArtSets(req)) {
    throw new HttpError(403, 'This role cannot manage art set builds for this project.')
  }

  const payload = artSetUpdateSchema.parse(req.body)
  const set = await updateArtSet(String(req.params.id ?? ''), payload)
  res.json({ set })
}

export async function getArtBudgetController(req: Request, res: Response) {
  if (!canViewArtBudget(req)) {
    throw new HttpError(403, 'Budget visibility is limited to the Art Director and production leadership.')
  }

  const query = artProjectQuerySchema.parse(req.query)
  const budget = await getArtBudget(query.projectId)
  res.json({ budget })
}

export async function getArtAlertsController(req: Request, res: Response) {
  if (!canAccessArtModule(req)) {
    throw new HttpError(403, 'You do not have art workspace access for this project.')
  }

  const query = artProjectQuerySchema.parse(req.query)
  const alerts = await listArtAlerts(query.projectId)
  res.json({ alerts })
}
