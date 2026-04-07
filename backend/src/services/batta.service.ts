import { adminClient } from '../config/supabaseClient'
import { HttpError } from '../utils/httpError'
import { getCrewModulePermissions, getLatestEligibleAttendanceForBatta, type CrewAccessContext } from './attendance.service'

interface SupabaseLikeError {
  message: string
  code?: string
}

interface WagePayoutRow {
  payout_id: string
  attendance_id: string | null
  amount: number | string | null
  type: string | null
  status: string | null
  payment_method: string | null
  requested_by: string | null
  approved_by: string | null
  paid_by: string | null
  created_at: string
  updated_at: string
}

interface DailyAttendanceRow {
  attendance_id: string
  user_id: string
  project_id: string
  created_at: string
}

interface CrewMemberRow {
  id: string
  user_id: string
  department: string | null
}

interface UserRow {
  id: string
  full_name: string | null
}

export interface WagePayoutItem {
  id: string
  attendanceId: string | null
  crewMemberId: string
  crewName: string
  department: string
  amount: number
  method: 'UPI' | 'CASH' | 'BANK'
  type: 'batta'
  status: 'requested' | 'approved' | 'paid' | 'rejected'
  timestamp: string
  requestedBy: string | null
  approvedBy: string | null
  paidBy: string | null
}

function throwIfError(error: SupabaseLikeError | null | undefined, fallbackStatus = 500) {
  if (!error) {
    return
  }

  if (error.code === '23505') {
    throw new HttpError(409, error.message)
  }

  throw new HttpError(fallbackStatus, error.message)
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function formatDepartment(value?: string | null) {
  if (!value) {
    return 'Production'
  }

  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mapPaymentMethod(value?: string | null): 'UPI' | 'CASH' | 'BANK' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'upi') {
    return 'UPI'
  }

  if (normalized === 'cash') {
    return 'CASH'
  }

  return 'BANK'
}

function mapStatus(value?: string | null): 'requested' | 'approved' | 'paid' | 'rejected' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'approved') {
    return 'approved'
  }

  if (normalized === 'paid') {
    return 'paid'
  }

  if (normalized === 'rejected' || normalized === 'cancelled') {
    return 'rejected'
  }

  return 'requested'
}

async function getProjectDirectory(projectId: string) {
  const { data: crewRows, error: crewError } = await adminClient
    .from('crew_members')
    .select('id, user_id, department')
    .eq('project_id', projectId)

  throwIfError(crewError as SupabaseLikeError | null)

  const typedCrewRows = (crewRows ?? []) as CrewMemberRow[]
  const userIds = Array.from(new Set(typedCrewRows.map(row => row.user_id)))

  if (userIds.length === 0) {
    return {
      crewMap: new Map<string, CrewMemberRow>(),
      userMap: new Map<string, UserRow>(),
    }
  }

  const { data: userRows, error: userError } = await adminClient
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  throwIfError(userError as SupabaseLikeError | null)

  return {
    crewMap: new Map(typedCrewRows.map(row => [row.user_id, row])),
    userMap: new Map(((userRows ?? []) as UserRow[]).map(row => [row.id, row])),
  }
}

async function getProjectAttendanceMap(projectId: string) {
  const { data, error } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(300)

  throwIfError(error as SupabaseLikeError | null)
  return new Map(((data ?? []) as DailyAttendanceRow[]).map(row => [row.attendance_id, row]))
}

async function syncLegacyBattaRequest(projectId: string, payout: WagePayoutRow) {
  try {
    if (!payout.attendance_id) {
      return
    }

    const attendanceMap = await getProjectAttendanceMap(projectId)
    const attendance = attendanceMap.get(payout.attendance_id)
    if (!attendance) {
      return
    }

    const { data: crewMember, error: crewError } = await adminClient
      .from('crew_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', attendance.user_id)
      .maybeSingle()

    throwIfError(crewError as SupabaseLikeError | null)

    if (!crewMember) {
      return
    }

    const requestedForDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(attendance.created_at))

    const { data: existingLegacyRequest, error: existingLegacyError } = await adminClient
      .from('batta_requests')
      .select('id')
      .eq('project_id', projectId)
      .eq('crew_member_id', String((crewMember as { id: string }).id))
      .eq('requested_for_date', requestedForDate)
      .maybeSingle()

    throwIfError(existingLegacyError as SupabaseLikeError | null)

    const payload = {
      project_id: projectId,
      crew_member_id: String((crewMember as { id: string }).id),
      requested_by: payout.requested_by,
      requested_for_date: requestedForDate,
      amount: toNumber(payout.amount),
      currency_code: 'INR',
      status: mapStatus(payout.status),
      paid_at: mapStatus(payout.status) === 'paid' ? payout.updated_at : null,
      metadata: {
        wagePayoutId: payout.payout_id,
        dailyAttendanceId: payout.attendance_id,
      },
    }

    if (existingLegacyRequest) {
      const { error: updateError } = await adminClient
        .from('batta_requests')
        .update(payload)
        .eq('id', String((existingLegacyRequest as { id: string }).id))

      throwIfError(updateError as SupabaseLikeError | null)
      return
    }

    const { error: insertError } = await adminClient
      .from('batta_requests')
      .insert(payload)

    throwIfError(insertError as SupabaseLikeError | null)
  } catch (error) {
    console.error('[crew][legacy-batta-sync] failed', {
      projectId,
      payoutId: payout.payout_id,
      error: error instanceof Error ? error.message : error,
    })
  }
}

async function getPayoutRowForProject(projectId: string, payoutId: string) {
  const { data, error } = await adminClient
    .from('wage_payouts')
    .select('payout_id, attendance_id, amount, type, status, payment_method, requested_by, approved_by, paid_by, created_at, updated_at')
    .eq('payout_id', payoutId)
    .maybeSingle()

  throwIfError(error as SupabaseLikeError | null)

  const payout = (data ?? null) as WagePayoutRow | null
  if (!payout?.attendance_id) {
    return null
  }

  const { data: attendance, error: attendanceError } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, created_at')
    .eq('attendance_id', payout.attendance_id)
    .eq('project_id', projectId)
    .maybeSingle()

  throwIfError(attendanceError as SupabaseLikeError | null)

  if (!attendance) {
    return null
  }

  return {
    payout,
    attendance: attendance as DailyAttendanceRow,
  }
}

export async function getProjectPayouts(projectId: string) {
  const [{ crewMap, userMap }, attendanceMap] = await Promise.all([
    getProjectDirectory(projectId),
    getProjectAttendanceMap(projectId),
  ])

  const { data: payoutRows, error: payoutError } = await adminClient
    .from('wage_payouts')
    .select('payout_id, attendance_id, amount, type, status, payment_method, requested_by, approved_by, paid_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  throwIfError(payoutError as SupabaseLikeError | null)

  return ((payoutRows ?? []) as WagePayoutRow[])
    .filter(row => row.attendance_id && attendanceMap.has(row.attendance_id))
    .map(row => {
      const attendance = attendanceMap.get(String(row.attendance_id)) as DailyAttendanceRow
      const crewMember = crewMap.get(attendance.user_id)
      const user = userMap.get(attendance.user_id)
      return {
        id: row.payout_id,
        attendanceId: row.attendance_id,
        crewMemberId: crewMember?.id ?? attendance.user_id,
        crewName: user?.full_name ?? 'Crew Member',
        department: formatDepartment(crewMember?.department),
        amount: toNumber(row.amount),
        method: mapPaymentMethod(row.payment_method),
        type: 'batta',
        status: mapStatus(row.status),
        timestamp: row.updated_at ?? row.created_at,
        requestedBy: row.requested_by,
        approvedBy: row.approved_by,
        paidBy: row.paid_by,
      } satisfies WagePayoutItem
    })
}

export async function requestBatta(projectId: string, userId: string, access: CrewAccessContext, amount: number) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canRequestBatta) {
    throw new HttpError(403, 'Your role cannot request batta for this project.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Batta amount must be greater than zero.')
  }

  const attendance = await getLatestEligibleAttendanceForBatta(projectId, userId)
  if (!attendance) {
    throw new HttpError(409, 'You need a valid attendance record before requesting batta.')
  }

  const { data: existingPayout, error: existingPayoutError } = await adminClient
    .from('wage_payouts')
    .select('payout_id')
    .eq('attendance_id', attendance.attendance_id)
    .eq('type', 'Batta')
    .maybeSingle()

  throwIfError(existingPayoutError as SupabaseLikeError | null)

  if (existingPayout) {
    throw new HttpError(409, 'Duplicate batta request blocked for this attendance record.')
  }

  const { data, error } = await adminClient
    .from('wage_payouts')
    .insert({
      attendance_id: attendance.attendance_id,
      amount,
      type: 'Batta',
      status: 'Requested',
      requested_by: userId,
    })
    .select('payout_id, attendance_id, amount, type, status, payment_method, requested_by, approved_by, paid_by, created_at, updated_at')
    .single()

  throwIfError(error as SupabaseLikeError | null)

  await syncLegacyBattaRequest(projectId, data as WagePayoutRow)
  return data
}

export async function approveBatta(projectId: string, payoutId: string, actorUserId: string, access: CrewAccessContext) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canApproveBatta) {
    throw new HttpError(403, 'Only a PM or Transport Captain can approve batta.')
  }

  const result = await getPayoutRowForProject(projectId, payoutId)
  if (!result) {
    throw new HttpError(404, 'Batta request not found for this project.')
  }

  const currentStatus = mapStatus(result.payout.status)
  if (currentStatus === 'approved' || currentStatus === 'paid') {
    throw new HttpError(409, 'This batta request has already been approved.')
  }

  const { data, error } = await adminClient
    .from('wage_payouts')
    .update({
      status: 'Approved',
      approved_by: actorUserId,
    })
    .eq('payout_id', payoutId)
    .select('payout_id, attendance_id, amount, type, status, payment_method, requested_by, approved_by, paid_by, created_at, updated_at')
    .single()

  throwIfError(error as SupabaseLikeError | null)
  await syncLegacyBattaRequest(projectId, data as WagePayoutRow)
  return data
}

export async function markBattaPaid(
  projectId: string,
  payoutId: string,
  actorUserId: string,
  access: CrewAccessContext,
  paymentMethod?: string | null,
) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canMarkBattaPaid) {
    throw new HttpError(403, 'Only a PM or Transport Captain can mark batta as paid.')
  }

  const result = await getPayoutRowForProject(projectId, payoutId)
  if (!result) {
    throw new HttpError(404, 'Batta request not found for this project.')
  }

  const currentStatus = mapStatus(result.payout.status)
  if (currentStatus === 'requested') {
    throw new HttpError(409, 'Batta cannot be marked paid before approval.')
  }

  if (currentStatus === 'paid') {
    throw new HttpError(409, 'This batta request is already marked as paid.')
  }

  const normalizedMethod = mapPaymentMethod(paymentMethod)

  const { data, error } = await adminClient
    .from('wage_payouts')
    .update({
      status: 'Paid',
      payment_method: normalizedMethod.toLowerCase(),
      paid_by: actorUserId,
    })
    .eq('payout_id', payoutId)
    .select('payout_id, attendance_id, amount, type, status, payment_method, requested_by, approved_by, paid_by, created_at, updated_at')
    .single()

  throwIfError(error as SupabaseLikeError | null)
  await syncLegacyBattaRequest(projectId, data as WagePayoutRow)
  return data
}
