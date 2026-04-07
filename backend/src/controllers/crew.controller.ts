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
  paymentMethod: z.enum(['UPI', 'CASH', 'BANK']).optional(),
})

const locationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  radiusMeters: z.number().int().min(100).max(500).optional(),
})

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

export async function getCrew(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const crew = await getCrewList(projectId)
  res.json({ crew })
}

export async function getCrewOvertimeGroups(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const groups = await getOvertimeGroups(projectId)
  res.json({ groups })
}

export async function getCrewPayouts(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const payouts = await getProjectPayouts(projectId)
  res.json({ payouts })
}

export async function getCrewDashboard(req: Request, res: Response) {
  const projectId = requireProjectId(req)
  const userId = requireUserId(req)
  const permissions = getCrewModulePermissions(accessContext(req))
  const [attendanceData, payouts] = await Promise.all([
    getAttendanceDashboard(projectId, userId),
    getProjectPayouts(projectId),
  ])

  const battaRequested = payouts
    .filter(item => item.status === 'requested')
    .reduce((sum, item) => sum + item.amount, 0)

  const battaPaid = payouts
    .filter(item => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0)

  res.json({
    summary: {
      totalCrew: attendanceData.summary.totalCrew,
      activeOTCrew: attendanceData.summary.activeOTCrew,
      totalOTCost: attendanceData.summary.totalOTCost,
      battaRequested,
      battaPaid,
    },
    permissions,
    projectLocation: attendanceData.projectLocation,
    myShift: attendanceData.myShift,
    myRecords: attendanceData.myRecords,
    crew: attendanceData.crew,
    otGroups: attendanceData.otGroups,
    payouts,
    battaQueue: payouts.filter(item => item.status !== 'paid'),
    serverNow: new Date().toISOString(),
    guards: {
      usesOsmOnly: true,
      gpsCheck: Boolean(attendanceData.projectLocation),
    },
  })
}

export async function getCrewLocation(req: Request, res: Response) {
  const projectId = requireProjectId(req)
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
  const payoutId = String(req.params.payoutId ?? '')
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
  const payoutId = String(req.params.payoutId ?? '')
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
