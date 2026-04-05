import { Router } from 'express'
import { adminClient } from '../../config/supabaseClient'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { HttpError } from '../../utils/httpError'

interface CrewMemberRow {
  id: string
  user_id: string
  department: string | null
  role_title: string | null
}

interface AttendanceRow {
  crew_member_id: string
  check_in_at: string | null
  verification: string | null
  status: string | null
  shift_hours: number | string | null
}

interface OvertimeRow {
  id: string
  department: string | null
  started_at: string | null
  hours: number | string | null
  estimated_cost: number | string | null
  authorized: boolean | null
}

interface WageRecordRow {
  id: string
  crew_member_id: string
  amount: number | string | null
  method: string | null
  status: string | null
  processed_at: string | null
  created_at: string
}

interface BattaRequestRow {
  id: string
  crew_member_id: string
  amount: number | string | null
  status: string | null
  paid_at: string | null
  created_at: string
}

interface UserRow {
  id: string
  full_name: string | null
}

function requireProjectId(projectId: string | undefined) {
  if (!projectId) {
    throw new HttpError(400, 'Project id is required.')
  }

  return projectId
}

function formatDepartment(value: string | null | undefined) {
  if (!value) {
    return 'Production'
  }

  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatClock(value: string | null | undefined) {
  if (!value) {
    return '--'
  }

  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapVerification(value: string | null | undefined): 'gps' | 'manual' | 'biometric' {
  if (value === 'biometric') {
    return 'biometric'
  }

  if (value === 'manual') {
    return 'manual'
  }

  return 'gps'
}

function mapCrewStatus(value: string | null | undefined): 'active' | 'ot' | 'offduty' {
  if (value === 'ot' || value === 'overtime') {
    return 'ot'
  }

  if (value === 'offduty' || value === 'off_duty') {
    return 'offduty'
  }

  return 'active'
}

function mapPaymentMethod(value: string | null | undefined): 'UPI' | 'CASH' | 'BANK' {
  if (!value) {
    return 'BANK'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'cash') {
    return 'CASH'
  }

  if (normalized === 'upi') {
    return 'UPI'
  }

  return 'BANK'
}

function mapPayoutStatus(value: string | null | undefined): 'requested' | 'approved' | 'paid' | 'rejected' {
  if (value === 'approved') {
    return 'approved'
  }

  if (value === 'paid') {
    return 'paid'
  }

  if (value === 'rejected' || value === 'cancelled') {
    return 'rejected'
  }

  return 'requested'
}

async function getUserMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>()
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map(row => [String(row.id), row as UserRow]))
}

export const crewRouter = Router()

crewRouter.get('/', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    console.log('[crew][members][list] route hit', { projectId, query: req.query })

    const [{ data: crewRows, error: crewError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
      adminClient
        .from('crew_members')
        .select('id, user_id, department, role_title')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: false }),
      adminClient
        .from('attendance_logs')
        .select('crew_member_id, check_in_at, verification, status, shift_hours')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(500),
    ])

    if (crewError) {
      throw crewError
    }

    if (attendanceError) {
      throw attendanceError
    }

    const typedCrewRows = (crewRows ?? []) as CrewMemberRow[]
    const userMap = await getUserMap(Array.from(new Set(typedCrewRows.map(row => row.user_id))))
    const latestAttendanceByCrew = new Map<string, AttendanceRow>()

    for (const row of (attendanceRows ?? []) as AttendanceRow[]) {
      if (!latestAttendanceByCrew.has(row.crew_member_id)) {
        latestAttendanceByCrew.set(row.crew_member_id, row)
      }
    }

    const crew = typedCrewRows.map(row => {
      const attendance = latestAttendanceByCrew.get(row.id)
      const user = userMap.get(row.user_id)

      return {
        id: row.id,
        name: user?.full_name ?? 'Crew Member',
        role: row.role_title ?? 'Crew Member',
        department: formatDepartment(row.department),
        checkInTime: formatClock(attendance?.check_in_at),
        verification: mapVerification(attendance?.verification),
        status: mapCrewStatus(attendance?.status),
        shiftHours: Number(attendance?.shift_hours ?? 0),
      }
    })

    console.log('[crew][members][list] db result', { projectId, count: crew.length })
    res.json({ crew })
  } catch (error) {
    next(error)
  }
})

crewRouter.get('/overtime', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    console.log('[crew][overtime][list] route hit', { projectId, query: req.query })

    const { data, error } = await adminClient
      .from('overtime_logs')
      .select('id, department, started_at, hours, estimated_cost, authorized')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    const groups = ((data ?? []) as OvertimeRow[]).map(row => ({
      id: row.id,
      name: `${formatDepartment(row.department)} OT`,
      memberCount: 1,
      startTime: formatClock(row.started_at),
      elapsedLabel: `${Number(row.hours ?? 0).toFixed(1)}h`,
      estimatedCostUSD: Number(row.estimated_cost ?? 0),
      authorized: Boolean(row.authorized),
    }))

    console.log('[crew][overtime][list] db result', { projectId, count: groups.length })
    res.json({ groups })
  } catch (error) {
    next(error)
  }
})

crewRouter.get('/payouts', authMiddleware, projectAccessMiddleware, async (req, res, next) => {
  try {
    const projectId = requireProjectId(req.projectAccess?.projectId)
    console.log('[crew][payouts][list] route hit', { projectId, query: req.query })

    const [{ data: crewRows, error: crewError }, { data: wageRows, error: wageError }, { data: battaRows, error: battaError }] = await Promise.all([
      adminClient
        .from('crew_members')
        .select('id, user_id, department')
        .eq('project_id', projectId),
      adminClient
        .from('wage_records')
        .select('id, crew_member_id, amount, method, status, processed_at, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20),
      adminClient
        .from('batta_requests')
        .select('id, crew_member_id, amount, status, paid_at, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (crewError) {
      throw crewError
    }

    if (wageError) {
      throw wageError
    }

    if (battaError) {
      throw battaError
    }

    const crewMemberRows = (crewRows ?? []) as Array<{ id: string; user_id: string; department: string | null }>
    const crewMap = new Map(crewMemberRows.map(row => [row.id, row]))
    const userMap = await getUserMap(Array.from(new Set(crewMemberRows.map(row => row.user_id))))

    const payouts = [
      ...((wageRows ?? []) as WageRecordRow[]).map(row => {
        const crewMember = crewMap.get(row.crew_member_id)
        const user = crewMember ? userMap.get(crewMember.user_id) : null
        return {
          id: row.id,
          crewMemberId: row.crew_member_id,
          crewName: user?.full_name ?? 'Crew Member',
          department: formatDepartment(crewMember?.department),
          amount: Number(row.amount ?? 0),
          method: mapPaymentMethod(row.method),
          type: 'wage' as const,
          status: mapPayoutStatus(row.status),
          timestamp: row.processed_at ?? row.created_at,
        }
      }),
      ...((battaRows ?? []) as BattaRequestRow[]).map(row => {
        const crewMember = crewMap.get(row.crew_member_id)
        const user = crewMember ? userMap.get(crewMember.user_id) : null
        return {
          id: row.id,
          crewMemberId: row.crew_member_id,
          crewName: user?.full_name ?? 'Crew Member',
          department: formatDepartment(crewMember?.department),
          amount: Number(row.amount ?? 0),
          method: 'BANK' as const,
          type: 'batta' as const,
          status: mapPayoutStatus(row.status),
          timestamp: row.paid_at ?? row.created_at,
        }
      }),
    ]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 20)

    console.log('[crew][payouts][list] db result', { projectId, count: payouts.length })
    res.json({ payouts })
  } catch (error) {
    next(error)
  }
})
