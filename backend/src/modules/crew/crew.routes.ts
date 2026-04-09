import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  exportAttendancePdf,
  getCrew,
  getCrewDashboard,
  getCrewLocation,
  getMyAttendance,
  getAttendanceHistory,
  getCrewOvertimeGroups,
  getCrewPayouts,
  getProjectAttendance,
  handleBattaApprove,
  handleBattaMarkPaid,
  handleBattaRequest,
  handleCheckIn,
  handleCheckOut,
  handleProjectLocationUpdate,
} from '../../controllers/crew.controller'

export const crewRouter = Router()

crewRouter.get('/', authMiddleware, projectAccessMiddleware, asyncHandler(getCrew))
crewRouter.get('/dashboard', authMiddleware, projectAccessMiddleware, asyncHandler(getCrewDashboard))
crewRouter.get('/location', authMiddleware, projectAccessMiddleware, asyncHandler(getCrewLocation))
crewRouter.get('/my-attendance', authMiddleware, projectAccessMiddleware, asyncHandler(getMyAttendance))
crewRouter.get('/attendance', authMiddleware, projectAccessMiddleware, asyncHandler(getAttendanceHistory))
crewRouter.get('/export/pdf', authMiddleware, projectAccessMiddleware, asyncHandler(exportAttendancePdf))
crewRouter.get('/project-attendance', authMiddleware, projectAccessMiddleware, asyncHandler(getProjectAttendance))
crewRouter.get('/overtime', authMiddleware, projectAccessMiddleware, asyncHandler(getCrewOvertimeGroups))
crewRouter.get('/payouts', authMiddleware, projectAccessMiddleware, asyncHandler(getCrewPayouts))

crewRouter.post('/attendance/check-in', authMiddleware, projectAccessMiddleware, asyncHandler(handleCheckIn))
crewRouter.post('/attendance/check-out', authMiddleware, projectAccessMiddleware, asyncHandler(handleCheckOut))
crewRouter.post('/check-in', authMiddleware, projectAccessMiddleware, asyncHandler(handleCheckIn))
crewRouter.post('/check-out', authMiddleware, projectAccessMiddleware, asyncHandler(handleCheckOut))

crewRouter.post('/batta/request', authMiddleware, projectAccessMiddleware, asyncHandler(handleBattaRequest))
crewRouter.post('/batta/:payoutId/approve', authMiddleware, projectAccessMiddleware, asyncHandler(handleBattaApprove))
crewRouter.post('/batta/:payoutId/pay', authMiddleware, projectAccessMiddleware, asyncHandler(handleBattaMarkPaid))
crewRouter.post('/batta/approve', authMiddleware, projectAccessMiddleware, asyncHandler(handleBattaApprove))
crewRouter.post('/batta/pay', authMiddleware, projectAccessMiddleware, asyncHandler(handleBattaMarkPaid))

crewRouter.put('/location', authMiddleware, projectAccessMiddleware, asyncHandler(handleProjectLocationUpdate))
crewRouter.post('/location/set', authMiddleware, projectAccessMiddleware, asyncHandler(handleProjectLocationUpdate))
