import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  checkIn,
  checkOut,
  getAttendanceDashboard,
  getCrewList,
  getCrewModulePermissions,
  getOvertimeGroups,
  getProjectLocation,
  setProjectLocation,
  type CrewAccessContext,
} from '../services/attendance.service'
import { approveBatta, getProjectPayouts, markBattaPaid, requestBatta } from '../services/batta.service'
import { HttpError } from '../utils/httpError'

const gpsPayloadSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracy: z.number().finite().nonnegative().nullable().optional(),
  timestamp: z.string().datetime().optional(),
})

const battaRequestSchema = z.object({
  amount: z.number().positive(),
})

const markPaidSchema = z.object({
  payoutId: z.string().uuid().optional(),
  paymentMethod: z.enum(['UPI', 'CASH', 'BANK']).optional(),
})

const locationSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  latitude: z.coerce.number().finite().optional(),
  longitude: z.coerce.number().finite().optional(),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
  radiusMeters: z.coerce.number().int().min(50).max(1000).optional(),
  radius: z.coerce.number().int().min(50).max(1000).optional(),
})
  .superRefine((value, ctx) => {
    if (value.latitude == null && value.lat == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude is required.',
        path: ['lat'],
      })
    }

    if (value.longitude == null && value.lng == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Longitude is required.',
        path: ['lng'],
      })
    }

    if (value.radiusMeters == null && value.radius == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Radius is required.',
        path: ['radius'],
      })
    }
  })
  .transform(value => ({
    name: value.name?.trim().slice(0, 255),
    latitude: value.latitude ?? value.lat ?? NaN,
    longitude: value.longitude ?? value.lng ?? NaN,
    radiusMeters: value.radiusMeters ?? value.radius,
  }))

function requireProjectId(req: Request) {
  const projectId = req.projectAccess?.projectId
  if (!projectId) {
    throw new HttpError(400, 'Project id is required.')
  }

  return projectId
}

function requireUserId(req: Request) {
  const userId = req.authUser?.id
  if (!userId) {
    throw new HttpError(401, 'Authenticated user context is missing.')
  }

  return userId
}

function accessContext(req: Request): CrewAccessContext {
  return {
    authRole: req.authUser?.role,
    membershipRole: req.projectAccess?.membershipRole,
    projectRole: req.projectAccess?.projectRole,
    department: req.projectAccess?.department ?? req.authUser?.department,
    isOwner: req.projectAccess?.isOwner,
  }
}

function normalizeToken(value?: string | null) {
  return (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function filterCrewByScope<T extends { userId?: string; department?: string }>(
  rows: T[],
  scope: 'none' | 'self' | 'department' | 'project',
  userId: string,
  department?: string | null,
) {
  if (scope === 'project') {
    return rows
  }

  if (scope === 'department') {
    const departmentToken = normalizeToken(department)
    return rows.filter(row => normalizeToken(row.department) === departmentToken)
  }

  if (scope === 'self') {
    return rows.filter(row => row.userId === userId)
  }

  return []
}

function buildScopedSummary(
  permissions: ReturnType<typeof getCrewModulePermissions>,
  scopedCrew: Array<{ status: string }>,
  myShift: { attendanceId: string | null; otActive: boolean },
) {
  return {
    totalCrew: permissions.canViewCrewTable ? scopedCrew.length : (myShift.attendanceId ? 1 : 0),
    activeOTCrew: permissions.canViewCrewTable ? scopedCrew.filter(row => row.status === 'ot').length : (myShift.otActive ? 1 : 0),
    totalOTCost: permissions.canViewFinancials ? undefined : 0,
  }
}

export async function getCrew(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }

  const crew = filterCrewByScope(await getCrewList(projectId), permissions.crewScope, userId, req.projectAccess?.department)
  res.json({ crew })
}

export async function getCrewOvertimeGroups(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }
  const groups = await getOvertimeGroups(projectId)
  res.json({ groups })
}

export async function getCrewPayouts(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }
  const payouts = await getProjectPayouts(projectId)
  res.json({ payouts: permissions.canViewFinancials ? payouts : [] })
}

export async function getCrewDashboard(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const access = accessContext(req)
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }

  const [attendanceData, payouts] = await Promise.all([
    getAttendanceDashboard(projectId, userId),
    getProjectPayouts(projectId),
  ])

  const scopedCrew = filterCrewByScope(attendanceData.crew, permissions.crewScope, userId, access.department)
  const attendanceIds = new Set(
    [attendanceData.myShift.attendanceId, ...attendanceData.myRecords.map(record => record.id)].filter(Boolean) as string[],
  )
  const myPayouts = payouts.filter(item => Boolean(item.attendanceId && attendanceIds.has(item.attendanceId)))
  const scopedSummary = buildScopedSummary(permissions, scopedCrew, attendanceData.myShift)

  const battaRequested = payouts
    .filter(item => item.status === 'requested')
    .reduce((sum, item) => sum + item.amount, 0)

  const battaPaid = payouts
    .filter(item => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0)

  res.json({
    summary: {
      totalCrew: scopedSummary.totalCrew,
      activeOTCrew: scopedSummary.activeOTCrew,
      totalOTCost: permissions.canViewFinancials ? attendanceData.summary.totalOTCost : 0,
      battaRequested: permissions.canViewFinancials ? battaRequested : 0,
      battaPaid: permissions.canViewFinancials ? battaPaid : 0,
    },
    permissions,
    projectLocation: attendanceData.projectLocation,
    myShift: attendanceData.myShift,
    myRecords: attendanceData.myRecords,
    crew: permissions.canViewCrewTable ? scopedCrew : [],
    otGroups: attendanceData.otGroups,
    payouts: permissions.canViewFinancials ? payouts : myPayouts,
    battaQueue: permissions.canApproveBatta ? payouts.filter(item => item.status !== 'paid') : [],
    serverNow: new Date().toISOString(),
    guards: {
      usesOsmOnly: true,
      gpsCheck: Boolean(attendanceData.projectLocation),
    },
  })
}

export async function getMyAttendance(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }
  const [attendanceData, payouts] = await Promise.all([
    getAttendanceDashboard(projectId, userId),
    getProjectPayouts(projectId),
  ])

  res.json({
    myShift: attendanceData.myShift,
    myRecords: attendanceData.myRecords,
    payouts: payouts.filter(item =>
      Boolean(
        item.attendanceId &&
        (
          attendanceData.myRecords.some(record => record.id === item.attendanceId) ||
          item.attendanceId === attendanceData.myShift.attendanceId
        ),
      ),
    ),
    projectLocation: attendanceData.projectLocation,
  })
}

export async function getProjectAttendance(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const access = accessContext(req)
  const [attendanceData, permissions] = await Promise.all([
    getAttendanceDashboard(projectId, userId),
    Promise.resolve(getCrewModulePermissions(access)),
  ])

  if (!permissions.canAccessModule || !permissions.canViewCrewTable) {
    throw new HttpError(403, 'Your role can only view personal attendance records.')
  }

  const scopedCrew = filterCrewByScope(attendanceData.crew, permissions.crewScope, userId, access.department)

  res.json({
    crew: scopedCrew,
    otGroups: attendanceData.otGroups,
    summary: {
      totalCrew: scopedCrew.length,
      activeOTCrew: scopedCrew.filter(row => row.status === 'ot').length,
      totalOTCost: permissions.canViewFinancials ? attendanceData.summary.totalOTCost : 0,
    },
    projectLocation: attendanceData.projectLocation,
  })
}

export async function getCrewLocation(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }
  const projectLocation = await getProjectLocation(projectId)
  res.json({ projectLocation })
}

export async function handleCheckIn(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payload = gpsPayloadSchema.parse(req.body)
  const attendance = await checkIn(projectId, userId, accessContext(req), payload)
  res.status(201).json({
    message: 'Shift started successfully.',
    attendance,
  })
}

export async function handleCheckOut(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payload = gpsPayloadSchema.parse(req.body)
  const attendance = await checkOut(projectId, userId, accessContext(req), payload)
  res.json({
    message: 'Shift ended successfully.',
    attendance,
  })
}

export async function handleBattaRequest(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payload = battaRequestSchema.parse(req.body)
  const payout = await requestBatta(projectId, userId, accessContext(req), payload.amount)
  res.status(201).json({
    message: 'Batta requested successfully.',
    payout,
  })
}

export async function handleBattaApprove(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payoutId = String(req.params.payoutId ?? req.body?.payoutId ?? '')
  if (!payoutId) {
    throw new HttpError(400, 'Payout id is required.')
  }

  const payout = await approveBatta(projectId, payoutId, userId, accessContext(req))
  res.json({
    message: 'Batta approved successfully.',
    payout,
  })
}

export async function handleBattaMarkPaid(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payoutId = String(req.params.payoutId ?? req.body?.payoutId ?? '')
  if (!payoutId) {
    throw new HttpError(400, 'Payout id is required.')
  }

  const payload = markPaidSchema.parse(req.body ?? {})
  const payout = await markBattaPaid(projectId, payoutId, userId, accessContext(req), payload.paymentMethod)
  res.json({
    message: 'Batta marked as paid.',
    payout,
  })
}

export async function handleProjectLocationUpdate(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const payload = locationSchema.parse(req.body)
  const projectLocation = await setProjectLocation(projectId, userId, accessContext(req), payload)
  res.json({
    message: 'Project location updated.',
    projectLocation,
  })
}
