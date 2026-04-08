import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  buildScopedExport,
  getScopedAlerts,
  getScopedBurnChart,
  getScopedDepartments,
  getScopedReportSummary,
  resolveReportsScope,
} from '../services/reportService'
import { HttpError } from '../utils/httpError'

const exportQuerySchema = z.object({
  type: z.enum(['pdf', 'csv']).default('pdf'),
})

function requireProjectId(req: Request) {
  const projectId = req.projectAccess?.projectId
  if (!projectId) {
    throw new HttpError(400, 'Project id is required.')
  }

  return projectId
}

function resolveScope(req: Request) {
  return resolveReportsScope({
    authRole: req.authUser?.role,
    membershipRole: req.projectAccess?.membershipRole,
    projectRole: req.projectAccess?.projectRole,
    department: req.projectAccess?.department ?? req.authUser?.department,
    isOwner: req.projectAccess?.isOwner,
  })
}

export async function getReportSummary(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const summary = await getScopedReportSummary(projectId, resolveScope(req))
  res.json(summary)
}

export async function getBurnChart(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const burnChart = await getScopedBurnChart(projectId, resolveScope(req))
  res.json({ burnChart })
}

export async function getDepartmentBreakdown(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const departments = await getScopedDepartments(projectId, resolveScope(req))
  res.json({ departments })
}

export async function getReportAlerts(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const alerts = await getScopedAlerts(projectId, resolveScope(req))
  res.json({ alerts })
}

export async function exportReport(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const { type } = exportQuerySchema.parse(req.query)
  const result = await buildScopedExport(projectId, resolveScope(req), type)

  res.setHeader('Content-Type', result.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  res.send(result.body)
}
