import { adminClient } from '../config/supabaseClient'
import { haversineDistanceKm } from '../utils/location'
import { HttpError } from '../utils/httpError'
import type { PaginatedResult } from '../models/transport.types'
import { createPagination, rangeFromPagination, toPaginatedResult } from '../utils/pagination'
import { createSimplePdf } from '../utils/simplePdf'

const CREW_TIMEZONE = 'Asia/Kolkata'
const CREW_UTC_OFFSET = '+05:30'
const OVERTIME_START_HOUR = 18
const DEFAULT_RADIUS_METERS = 200
const MAX_ALLOWED_GPS_ACCURACY_METERS = 250

interface SupabaseLikeError {
  message: string
  code?: string
}

interface CrewMemberRow {
  id: string
  user_id: string
  department: string | null
  role_title: string | null
  day_rate: number | string | null
  shift_hours_planned: number | string | null
}

interface UserRow {
  id: string
  full_name: string | null
}

interface ProjectMemberRow {
  id: string
  role: string | null
  department: string | null
  access_role: string | null
}

interface DailyAttendanceRow {
  attendance_id: string
  user_id: string
  project_id: string
  check_in_time: string | null
  check_out_time: string | null
  check_in_location: Record<string, unknown> | null
  check_out_location: Record<string, unknown> | null
  geo_verified: boolean | null
  shift_status: string | null
  ot_minutes: number | string | null
  created_at: string
  updated_at: string
}

interface ProjectLocationRow {
  location_id: string
  project_id: string
  name: string | null
  latitude: number | string | null
  longitude: number | string | null
  radius_meters: number | string | null
  is_active: boolean | null
  created_by: string | null
  created_at: string
}

interface LegacyAttendanceRow {
  id: string
  crew_member_id: string
}

export interface CrewAccessContext {
  authRole?: string | null
  membershipRole?: string | null
  projectRole?: string | null
  department?: string | null
  isOwner?: boolean
}

export interface CrewLocationPayload {
  lat: number
  lng: number
  accuracy: number | null
  timestamp: string
}

export interface CrewModulePermissions {
  canAccessModule: boolean
  canCheckIn: boolean
  canCheckOut: boolean
  canRequestBatta: boolean
  canViewOwnRecords: boolean
  canViewAllCrew: boolean
  canViewCrewTable: boolean
  canApproveBatta: boolean
  canMarkBattaPaid: boolean
  canManageLocation: boolean
  canViewFinancials: boolean
  crewScope: 'none' | 'self' | 'department' | 'project'
  summaryOnly: boolean
}

export interface CrewProjectLocation {
  locationId: string
  projectId: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  createdAt: string
  mapLink: string
}

export interface CrewMemberListItem {
  id: string
  attendanceId: string
  userId: string
  name: string
  role: string
  department: string
  checkInTime: string
  checkOutTime: string
  checkInAt: string | null
  checkOutAt: string | null
  computedDuration: string
  computedDurationSeconds: number
  verification: 'gps' | 'manual' | 'biometric'
  status: 'active' | 'ot' | 'offduty'
  shiftHours: number
  otMinutes: number
  geoVerified: boolean
  state: 'not_checked_in' | 'checked_in' | 'checked_out'
  location: CrewLocationPayload | null
  mapLink: string | null
}

export interface CrewShiftSnapshot {
  attendanceId: string | null
  state: 'not_checked_in' | 'checked_in' | 'checked_out'
  checkInTime: string | null
  checkOutTime: string | null
  workingSeconds: number
  otMinutes: number
  otActive: boolean
  geoVerified: boolean
  shiftStatus: string
  checkInLocation: CrewLocationPayload | null
  checkOutLocation: CrewLocationPayload | null
}

export interface CrewAttendanceHistoryItem {
  id: string
  state: 'not_checked_in' | 'checked_in' | 'checked_out'
  checkInTime: string | null
  checkOutTime: string | null
  shiftStatus: string
  durationMinutes: number
  otMinutes: number
  geoVerified: boolean
  location: CrewLocationPayload | null
  mapLink: string | null
}

export interface CrewAttendanceHistoryRecord extends CrewAttendanceHistoryItem {
  attendanceId: string
  userId: string
  name: string
  role: string
  department: string
}

export interface AttendanceHistoryQuery {
  startDate?: string | null
  endDate?: string | null
  page?: number | null
  limit?: number | null
}

export interface AttendanceHistoryResult extends PaginatedResult<CrewAttendanceHistoryRecord> {
  filters: {
    startDate: string
    endDate: string
  }
}

export interface OvertimeGroupItem {
  id: string
  name: string
  memberCount: number
  startTime: string
  elapsedLabel: string
  estimatedCostUSD: number
  authorized: boolean
}

export interface AttendanceSummary {
  totalCrew: number
  activeOTCrew: number
  totalOTCost: number
}

export interface AttendanceDashboardData {
  summary: AttendanceSummary
  crew: CrewMemberListItem[]
  myShift: CrewShiftSnapshot
  myRecords: CrewAttendanceHistoryItem[]
  projectLocation: CrewProjectLocation | null
  otGroups: OvertimeGroupItem[]
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

function normalizeRole(value?: string | null) {
  if (!value) {
    return null
  }

  return value.trim().toUpperCase().replace(/[\s-]+/g, '_')
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

function formatProjectRole(value?: string | null) {
  if (!value) {
    return 'Crew Member'
  }

  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
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

function clampRadius(value: number) {
  return Math.min(1000, Math.max(50, Math.round(value)))
}

function getLocalDateKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CREW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

function getDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00${CREW_UTC_OFFSET}`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function getOtStartTime(checkInIso: string) {
  return new Date(`${getLocalDateKey(checkInIso)}T${String(OVERTIME_START_HOUR).padStart(2, '0')}:00:00${CREW_UTC_OFFSET}`)
}

function formatClock(value: string | null | undefined) {
  if (!value) {
    return '--'
  }

  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: CREW_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDurationLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours <= 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function buildMapLink(location: CrewLocationPayload | null) {
  if (!location) {
    return null
  }

  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`
}

function parseLocation(raw: Record<string, unknown> | null | undefined): CrewLocationPayload | null {
  if (!raw) {
    return null
  }

  const lat = typeof raw.lat === 'number' ? raw.lat : typeof raw.lat === 'string' ? Number(raw.lat) : NaN
  const lng = typeof raw.lng === 'number' ? raw.lng : typeof raw.lng === 'string' ? Number(raw.lng) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  const accuracyValue = typeof raw.accuracy === 'number'
    ? raw.accuracy
    : typeof raw.accuracy === 'string'
      ? Number(raw.accuracy)
      : null

  const timestamp = typeof raw.timestamp === 'string' && raw.timestamp.trim()
    ? raw.timestamp
    : new Date().toISOString()

  return {
    lat,
    lng,
    accuracy: accuracyValue !== null && Number.isFinite(accuracyValue) ? accuracyValue : null,
    timestamp,
  }
}

function getWorkingSeconds(checkInTime: string | null, checkOutTime: string | null, now = new Date()) {
  if (!checkInTime) {
    return 0
  }

  const checkIn = new Date(checkInTime)
  const end = checkOutTime ? new Date(checkOutTime) : now
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= checkIn.getTime()) {
    return 0
  }

  return Math.floor((end.getTime() - checkIn.getTime()) / 1000)
}

function getOtMinutes(checkInTime: string | null, checkOutTime: string | null, now = new Date()) {
  if (!checkInTime) {
    return 0
  }

  const checkIn = new Date(checkInTime)
  const end = checkOutTime ? new Date(checkOutTime) : now

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= checkIn.getTime()) {
    return 0
  }

  const otStart = getOtStartTime(checkInTime)
  const effectiveStart = checkIn.getTime() > otStart.getTime() ? checkIn : otStart

  if (end.getTime() <= effectiveStart.getTime()) {
    return 0
  }

  return Math.floor((end.getTime() - effectiveStart.getTime()) / (60 * 1000))
}

function getShiftState(row: DailyAttendanceRow | null): 'not_checked_in' | 'checked_in' | 'checked_out' {
  if (!row?.check_in_time) {
    return 'not_checked_in'
  }

  return row.check_out_time ? 'checked_out' : 'checked_in'
}

function getCrewStatus(row: DailyAttendanceRow, now = new Date()): 'active' | 'ot' | 'offduty' {
  if (row.check_out_time) {
    return 'offduty'
  }

  return getOtMinutes(row.check_in_time, row.check_out_time, now) > 0 ? 'ot' : 'active'
}

function calculateOtCost(otMinutes: number, dayRate: number, plannedShiftHours: number) {
  if (!dayRate || !plannedShiftHours) {
    return 0
  }

  const hourlyRate = dayRate / plannedShiftHours
  return Number((((otMinutes / 60) * hourlyRate) * 1.5).toFixed(2))
}

async function getUserMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>()
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  throwIfError(error as SupabaseLikeError | null)
  return new Map(((data ?? []) as UserRow[]).map(row => [row.id, row]))
}

async function getCrewDirectory(projectId: string, userIds?: string[]) {
  let query = adminClient
    .from('crew_members')
    .select('id, user_id, department, role_title, day_rate, shift_hours_planned')
    .eq('project_id', projectId)

  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds)
  }

  const { data, error } = await query
  throwIfError(error as SupabaseLikeError | null)

  const rows = (data ?? []) as CrewMemberRow[]
  return new Map(rows.map(row => [row.user_id, row]))
}

async function ensureCrewMember(projectId: string, userId: string, access: CrewAccessContext) {
  const { data: existingCrewMember, error: crewMemberError } = await adminClient
    .from('crew_members')
    .select('id, user_id, department, role_title, day_rate, shift_hours_planned')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(crewMemberError as SupabaseLikeError | null)

  if (existingCrewMember) {
    return existingCrewMember as CrewMemberRow
  }

  const { data: projectMember, error: projectMemberError } = await adminClient
    .from('project_members')
    .select('id, role, department, access_role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(projectMemberError as SupabaseLikeError | null)

  const typedProjectMember = projectMember as ProjectMemberRow | null
  const roleTitle = formatProjectRole(typedProjectMember?.role ?? access.projectRole ?? access.authRole ?? 'crew_member')
  const department = (typedProjectMember?.department ?? access.department ?? 'production').toLowerCase()

  const { data: insertedCrewMember, error: insertCrewMemberError } = await adminClient
    .from('crew_members')
    .insert({
      project_id: projectId,
      project_member_id: typedProjectMember?.id ?? null,
      user_id: userId,
      department,
      role_title: roleTitle,
      payment_method: 'bank',
    })
    .select('id, user_id, department, role_title, day_rate, shift_hours_planned')
    .single()

  throwIfError(insertCrewMemberError as SupabaseLikeError | null)
  return insertedCrewMember as CrewMemberRow
}

async function getTodayAttendanceRows(projectId: string) {
  const { startIso, endIso } = getDayRange(getLocalDateKey())
  const { data, error } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .eq('project_id', projectId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('check_in_time', { ascending: true, nullsFirst: false })

  throwIfError(error as SupabaseLikeError | null)
  return (data ?? []) as DailyAttendanceRow[]
}

async function getOpenAttendance(projectId: string, userId: string) {
  const { data, error } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('check_out_time', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfError(error as SupabaseLikeError | null)
  return (data ?? null) as DailyAttendanceRow | null
}

async function getAttendanceForLocalDay(projectId: string, userId: string, dateKey: string) {
  const { startIso, endIso } = getDayRange(dateKey)
  const { data, error } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfError(error as SupabaseLikeError | null)
  return (data ?? null) as DailyAttendanceRow | null
}

async function getRecentAttendanceForUser(projectId: string, userId: string, limit = 7) {
  const { data, error } = await adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  throwIfError(error as SupabaseLikeError | null)
  return (data ?? []) as DailyAttendanceRow[]
}

function normalizeDateKey(value?: string | null) {
  if (!value) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null
}

function buildAttendanceHistoryDateRange(query: AttendanceHistoryQuery) {
  const today = getLocalDateKey()
  const endDate = normalizeDateKey(query.endDate) ?? today
  const startDate = normalizeDateKey(query.startDate) ?? endDate

  if (startDate > endDate) {
    throw new HttpError(400, 'Start date cannot be after end date.')
  }

  return {
    startDate,
    endDate,
    startIso: getDayRange(startDate).startIso,
    endIso: getDayRange(endDate).endIso,
  }
}

function mapHistoryRecord(row: DailyAttendanceRow, crewMember: CrewMemberRow | undefined, user: UserRow | undefined, now = new Date()) {
  const history = mapHistoryRow(row, now)
  return {
    ...history,
    attendanceId: row.attendance_id,
    userId: row.user_id,
    name: user?.full_name?.trim() || 'ProdSync User',
    role: crewMember?.role_title?.trim() || 'Crew Member',
    department: formatDepartment(crewMember?.department),
  } satisfies CrewAttendanceHistoryRecord
}

export async function getLatestEligibleAttendanceForBatta(projectId: string, userId: string) {
  const openAttendance = await getOpenAttendance(projectId, userId)
  if (openAttendance) {
    return openAttendance
  }

  return getAttendanceForLocalDay(projectId, userId, getLocalDateKey())
}

export async function getProjectLocation(projectId: string) {
  const { data, error } = await adminClient
    .from('project_locations')
    .select('location_id, project_id, name, latitude, longitude, radius_meters, is_active, created_by, created_at')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfError(error as SupabaseLikeError | null)

  const row = (data ?? null) as ProjectLocationRow | null
  if (!row) {
    return null
  }

  const latitude = toNumber(row.latitude)
  const longitude = toNumber(row.longitude)

  return {
    locationId: row.location_id,
    projectId: row.project_id,
    name: row.name?.trim() || 'Project Base',
    latitude,
    longitude,
    radiusMeters: toNumber(row.radius_meters, DEFAULT_RADIUS_METERS),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    mapLink: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`,
  } satisfies CrewProjectLocation
}

export function getCrewModulePermissions(access: CrewAccessContext): CrewModulePermissions {
  const authRole = normalizeRole(access.authRole)
  const membershipRole = normalizeRole(access.membershipRole)
  const projectRole = normalizeRole(access.projectRole)
  const department = normalizeRole(access.department)

  const isProducer = Boolean(
    access.isOwner ||
    authRole === 'EP' ||
    authRole === 'LINE_PRODUCER' ||
    membershipRole === 'EP' ||
    membershipRole === 'LINE_PRODUCER',
  )

  const isTransportCaptain = Boolean(
    projectRole === 'TRANSPORT_CAPTAIN' ||
    (department === 'TRANSPORT' && membershipRole === 'HOD'),
  )

  const isProductionManager = Boolean(
    projectRole === 'PRODUCTION_MANAGER' ||
    authRole === 'PRODUCTION_MANAGER',
  )

  const isDepartmentHead = Boolean(
    !isTransportCaptain &&
    membershipRole === 'HOD' &&
    department &&
    department !== 'PRODUCTION',
  )

  const canManageLocation = Boolean(
    authRole === 'ADMIN' ||
    membershipRole === 'ADMIN' ||
    isProducer ||
    isProductionManager,
  )

  const crewProjectRoles = new Set([
    'CREW_MEMBER',
    'DRIVER',
    'DATA_WRANGLER',
    'FIRST_AC',
    'CAMERA_OPERATOR',
    'ART_ASSISTANT',
    'WARDROBE_STYLIST',
    'EDITOR',
    'COLORIST',
  ])

  const isCrewActor = !isProducer && !isProductionManager && !isDepartmentHead && !isTransportCaptain && Boolean(
    membershipRole === 'CREW' ||
    membershipRole === 'DRIVER' ||
    membershipRole === 'DATA_WRANGLER' ||
    authRole === 'CREW' ||
    authRole === 'DRIVER' ||
    authRole === 'DATA_WRANGLER' ||
    (projectRole && crewProjectRoles.has(projectRole)),
  )

  const canAccessModule = Boolean(isProducer || isProductionManager || isDepartmentHead || isCrewActor)
  const crewScope: CrewModulePermissions['crewScope'] = isProducer || isProductionManager
    ? 'project'
    : isDepartmentHead
      ? 'department'
      : isCrewActor
        ? 'self'
        : 'none'

  return {
    canAccessModule,
    canCheckIn: isCrewActor,
    canCheckOut: isCrewActor,
    canRequestBatta: isCrewActor,
    canViewOwnRecords: canAccessModule,
    canViewAllCrew: crewScope === 'project',
    canViewCrewTable: crewScope === 'project' || crewScope === 'department',
    canApproveBatta: isProducer || isProductionManager,
    canMarkBattaPaid: isProducer || isProductionManager,
    canManageLocation,
    canViewFinancials: isProducer || isProductionManager,
    crewScope,
    summaryOnly: false,
  }
}

export function isWithinRadius(lat1: number, lng1: number, lat2: number, lng2: number, radiusMeters: number) {
  const distanceKm = haversineDistanceKm(
    { latitude: lat1, longitude: lng1 },
    { latitude: lat2, longitude: lng2 },
  )

  return distanceKm * 1000 <= radiusMeters
}

function normalizeLocationInput(input: Partial<CrewLocationPayload>) {
  const lat = typeof input.lat === 'number' ? input.lat : Number(input.lat)
  const lng = typeof input.lng === 'number' ? input.lng : Number(input.lng)
  const accuracy = input.accuracy === null || input.accuracy === undefined
    ? null
    : typeof input.accuracy === 'number'
      ? input.accuracy
      : Number(input.accuracy)
  const timestamp = typeof input.timestamp === 'string' && input.timestamp.trim()
    ? input.timestamp
    : new Date().toISOString()

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(400, 'Valid GPS latitude and longitude are required.')
  }

  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    throw new HttpError(400, 'GPS accuracy must be a positive number.')
  }

  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw new HttpError(400, 'GPS timestamp is invalid.')
  }

  return {
    lat,
    lng,
    accuracy,
    timestamp,
  } satisfies CrewLocationPayload
}

async function assertCheckInReady(projectId: string, userId: string, location: CrewLocationPayload) {
  const projectLocation = await getProjectLocation(projectId)
  if (!projectLocation) {
    throw new HttpError(409, 'Project location is not configured yet. Ask a Production Manager, Admin, or Transport Captain to set it first.')
  }

  const openAttendance = await getOpenAttendance(projectId, userId)
  if (openAttendance) {
    throw new HttpError(409, 'You already have an active shift running in another tab or session.')
  }

  const existingAttendance = await getAttendanceForLocalDay(projectId, userId, getLocalDateKey(location.timestamp))
  if (existingAttendance) {
    throw new HttpError(409, 'Duplicate check-in blocked for today.')
  }

  const allowedAccuracy = Math.max(MAX_ALLOWED_GPS_ACCURACY_METERS, projectLocation.radiusMeters + 50)
  if (location.accuracy !== null && location.accuracy > allowedAccuracy) {
    throw new HttpError(422, 'GPS signal is too weak to verify this shift. Retry when accuracy improves.')
  }

  if (!isWithinRadius(location.lat, location.lng, projectLocation.latitude, projectLocation.longitude, projectLocation.radiusMeters)) {
    throw new HttpError(403, 'Check-in blocked because you are outside the project radius.')
  }

  return projectLocation
}

async function syncLegacyAttendance(
  projectId: string,
  userId: string,
  access: CrewAccessContext,
  attendance: DailyAttendanceRow,
  projectLocation: CrewProjectLocation | null,
) {
  try {
    const crewMember = await ensureCrewMember(projectId, userId, access)
    const workDate = getLocalDateKey(attendance.check_in_time ?? attendance.created_at)
    const checkInLocation = parseLocation(attendance.check_in_location)
    const checkOutLocation = parseLocation(attendance.check_out_location)

    const { data: existingLegacyAttendance, error: legacyAttendanceError } = await adminClient
      .from('attendance_logs')
      .select('id, crew_member_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle()

    throwIfError(legacyAttendanceError as SupabaseLikeError | null)

    const payload = {
      project_id: projectId,
      crew_member_id: crewMember.id,
      user_id: userId,
      work_date: workDate,
      check_in_at: attendance.check_in_time,
      check_out_at: attendance.check_out_time,
      verification: 'gps',
      verification_payload: {
        source: 'crew_wages_module',
        dailyAttendanceId: attendance.attendance_id,
        geoVerified: attendance.geo_verified,
      },
      location: projectLocation?.name ?? 'Project Base',
      latitude: checkOutLocation?.lat ?? checkInLocation?.lat ?? null,
      longitude: checkOutLocation?.lng ?? checkInLocation?.lng ?? null,
      status: attendance.check_out_time
        ? (toNumber(attendance.ot_minutes) > 0 ? 'ot' : 'offduty')
        : (getOtMinutes(attendance.check_in_time, attendance.check_out_time) > 0 ? 'ot' : 'active'),
      shift_hours: Number((getWorkingSeconds(attendance.check_in_time, attendance.check_out_time) / 3600).toFixed(2)),
      overtime_minutes: toNumber(attendance.ot_minutes),
      notes: `Synced from daily_attendance:${attendance.attendance_id}`,
    }

    if (existingLegacyAttendance) {
      const { error: updateLegacyError } = await adminClient
        .from('attendance_logs')
        .update(payload)
        .eq('id', (existingLegacyAttendance as LegacyAttendanceRow).id)

      throwIfError(updateLegacyError as SupabaseLikeError | null)
    } else {
      const { error: insertLegacyError } = await adminClient
        .from('attendance_logs')
        .insert(payload)

      throwIfError(insertLegacyError as SupabaseLikeError | null)
    }

    if (attendance.check_out_time && toNumber(attendance.ot_minutes) > 0) {
      const { data: latestAttendanceLog, error: latestAttendanceLogError } = await adminClient
        .from('attendance_logs')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .maybeSingle()

      throwIfError(latestAttendanceLogError as SupabaseLikeError | null)

      const otHours = Number((toNumber(attendance.ot_minutes) / 60).toFixed(2))
      const estimatedCost = calculateOtCost(
        toNumber(attendance.ot_minutes),
        toNumber(crewMember.day_rate),
        Math.max(toNumber(crewMember.shift_hours_planned, 10), 1),
      )

      const { data: existingOtLog, error: existingOtLogError } = await adminClient
        .from('overtime_logs')
        .select('id')
        .eq('attendance_log_id', String((latestAttendanceLog as { id: string } | null)?.id ?? ''))
        .maybeSingle()

      throwIfError(existingOtLogError as SupabaseLikeError | null)

      const otPayload = {
        project_id: projectId,
        crew_member_id: crewMember.id,
        attendance_log_id: (latestAttendanceLog as { id: string } | null)?.id ?? null,
        department: (crewMember.department ?? 'production').toLowerCase(),
        started_at: getOtStartTime(attendance.check_in_time ?? attendance.created_at).toISOString(),
        ended_at: attendance.check_out_time,
        hours: otHours,
        estimated_cost: estimatedCost,
        authorized: false,
        reason: 'Auto-synced from crew wages checkout.',
        metadata: {
          dailyAttendanceId: attendance.attendance_id,
        },
      }

      if (existingOtLog) {
        const { error: updateOtError } = await adminClient
          .from('overtime_logs')
          .update(otPayload)
          .eq('id', String((existingOtLog as { id: string }).id))

        throwIfError(updateOtError as SupabaseLikeError | null)
      } else {
        const { error: insertOtError } = await adminClient
          .from('overtime_logs')
          .insert(otPayload)

        throwIfError(insertOtError as SupabaseLikeError | null)
      }
    }
  } catch (error) {
    console.error('[crew][legacy-attendance-sync] failed', {
      projectId,
      userId,
      attendanceId: attendance.attendance_id,
      error: error instanceof Error ? error.message : error,
    })
  }
}

export async function checkIn(projectId: string, userId: string, access: CrewAccessContext, input: Partial<CrewLocationPayload>) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canCheckIn) {
    throw new HttpError(403, 'Your role cannot start a crew shift for this project.')
  }

  const location = normalizeLocationInput(input)
  const projectLocation = await assertCheckInReady(projectId, userId, location)
  await ensureCrewMember(projectId, userId, access)

  const { data, error } = await adminClient
    .from('daily_attendance')
    .insert({
      user_id: userId,
      project_id: projectId,
      check_in_time: location.timestamp,
      check_in_location: location,
      geo_verified: true,
      shift_status: 'Standard',
      created_at: location.timestamp,
      updated_at: location.timestamp,
    })
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .single()

  throwIfError(error as SupabaseLikeError | null)

  const attendance = data as DailyAttendanceRow
  await syncLegacyAttendance(projectId, userId, access, attendance, projectLocation)

  return {
    attendanceId: attendance.attendance_id,
    checkInTime: attendance.check_in_time,
    geoVerified: Boolean(attendance.geo_verified),
  }
}

export async function checkOut(projectId: string, userId: string, access: CrewAccessContext, input: Partial<CrewLocationPayload>) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canCheckOut) {
    throw new HttpError(403, 'Your role cannot end a crew shift for this project.')
  }

  const location = normalizeLocationInput(input)
  const openAttendance = await getOpenAttendance(projectId, userId)
  if (!openAttendance?.check_in_time) {
    throw new HttpError(409, 'No active shift was found for checkout.')
  }

  const projectLocation = await getProjectLocation(projectId)
  if (!projectLocation) {
    throw new HttpError(409, 'Project location is not configured yet.')
  }

  const allowedAccuracy = Math.max(MAX_ALLOWED_GPS_ACCURACY_METERS, projectLocation.radiusMeters + 50)
  if (location.accuracy !== null && location.accuracy > allowedAccuracy) {
    throw new HttpError(422, 'GPS signal is too weak to verify checkout. Retry when accuracy improves.')
  }

  if (!isWithinRadius(location.lat, location.lng, projectLocation.latitude, projectLocation.longitude, projectLocation.radiusMeters)) {
    throw new HttpError(403, 'Checkout blocked because you are outside the project radius.')
  }

  if (new Date(location.timestamp).getTime() < new Date(openAttendance.check_in_time).getTime()) {
    throw new HttpError(422, 'Checkout time cannot be earlier than check-in time.')
  }

  const otMinutes = getOtMinutes(openAttendance.check_in_time, location.timestamp)
  const shiftStatus = otMinutes > 0 ? 'OT Active' : 'Completed'

  const { data, error } = await adminClient
    .from('daily_attendance')
    .update({
      check_out_time: location.timestamp,
      check_out_location: location,
      geo_verified: true,
      shift_status: shiftStatus,
      ot_minutes: otMinutes,
      updated_at: location.timestamp,
    })
    .eq('attendance_id', openAttendance.attendance_id)
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at')
    .single()

  throwIfError(error as SupabaseLikeError | null)

  const attendance = data as DailyAttendanceRow
  await syncLegacyAttendance(projectId, userId, access, attendance, projectLocation)

  return {
    attendanceId: attendance.attendance_id,
    checkOutTime: attendance.check_out_time,
    otMinutes,
    durationMinutes: Math.floor(getWorkingSeconds(attendance.check_in_time, attendance.check_out_time) / 60),
  }
}

export async function setProjectLocation(
  projectId: string,
  actorUserId: string,
  access: CrewAccessContext,
  input: {
    name?: string
    latitude: number
    longitude: number
    radiusMeters?: number
  },
) {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canManageLocation) {
    throw new HttpError(403, 'Only producers, admins, and the Production Manager can manage the project location.')
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpError(400, 'Invalid location data.')
  }

  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new HttpError(400, 'Invalid location data.')
  }

  const rawRadius = toNumber(input.radiusMeters, DEFAULT_RADIUS_METERS)
  if (!Number.isFinite(rawRadius) || rawRadius < 50 || rawRadius > 1000) {
    throw new HttpError(400, 'Invalid location data.')
  }

  const radiusMeters = clampRadius(rawRadius)
  const safeName = input.name?.trim().slice(0, 255) || 'Project Base'

  const { data: previousActiveRows, error: previousActiveError } = await adminClient
    .from('project_locations')
    .select('location_id')
    .eq('project_id', projectId)
    .eq('is_active', true)

  throwIfError(previousActiveError as SupabaseLikeError | null)

  const previousLocationIds = ((previousActiveRows ?? []) as Array<{ location_id: string }>).map(row => row.location_id)

  const { error: deactivateError } = await adminClient
    .from('project_locations')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('is_active', true)

  throwIfError(deactivateError as SupabaseLikeError | null)

  try {
    const { error } = await adminClient
      .from('project_locations')
      .insert({
        project_id: projectId,
        name: safeName,
        latitude: input.latitude,
        longitude: input.longitude,
        radius_meters: radiusMeters,
        is_active: true,
        created_by: actorUserId,
      })

    throwIfError(error as SupabaseLikeError | null)
    return getProjectLocation(projectId)
  } catch (error) {
    if (previousLocationIds.length > 0) {
      const { error: reactivateError } = await adminClient
        .from('project_locations')
        .update({ is_active: true })
        .in('location_id', previousLocationIds)

      if (reactivateError) {
        console.error('[crew][project-location] failed to restore previous active location', {
          projectId,
          actorUserId,
          previousLocationIds,
          error: reactivateError.message,
        })
      }
    }

    if (error instanceof HttpError) {
      throw error
    }

    console.error('[crew][project-location] failed to save geofence', {
      projectId,
      actorUserId,
      error: error instanceof Error ? error.message : error,
    })

    throw new HttpError(500, 'Unable to save project location right now.')
  }
}

function mapCrewRow(row: DailyAttendanceRow, crewMember: CrewMemberRow | undefined, user: UserRow | undefined, now = new Date()) {
  const checkInLocation = parseLocation(row.check_in_location)
  const workingSeconds = getWorkingSeconds(row.check_in_time, row.check_out_time, now)
  const otMinutes = row.check_out_time ? toNumber(row.ot_minutes) : getOtMinutes(row.check_in_time, row.check_out_time, now)
  const computedDuration = row.check_out_time
    ? formatDurationLabel(workingSeconds)
    : `In Progress (${formatDurationLabel(workingSeconds)})`

  return {
    id: crewMember?.id ?? row.attendance_id,
    attendanceId: row.attendance_id,
    userId: row.user_id,
    name: user?.full_name ?? 'Crew Member',
    role: crewMember?.role_title ?? 'Crew Member',
    department: formatDepartment(crewMember?.department),
    checkInTime: formatClock(row.check_in_time),
    checkOutTime: row.check_out_time ? formatClock(row.check_out_time) : 'Working',
    checkInAt: row.check_in_time,
    checkOutAt: row.check_out_time,
    computedDuration,
    computedDurationSeconds: workingSeconds,
    verification: row.geo_verified ? 'gps' : 'manual',
    status: getCrewStatus(row, now),
    shiftHours: Number((workingSeconds / 3600).toFixed(2)),
    otMinutes,
    geoVerified: Boolean(row.geo_verified),
    state: getShiftState(row),
    location: checkInLocation,
    mapLink: buildMapLink(checkInLocation),
  } satisfies CrewMemberListItem
}

function mapShiftSnapshot(row: DailyAttendanceRow | null, now = new Date()) {
  if (!row) {
    return {
      attendanceId: null,
      state: 'not_checked_in',
      checkInTime: null,
      checkOutTime: null,
      workingSeconds: 0,
      otMinutes: 0,
      otActive: false,
      geoVerified: false,
      shiftStatus: 'Not Started',
      checkInLocation: null,
      checkOutLocation: null,
    } satisfies CrewShiftSnapshot
  }

  const state = getShiftState(row)
  const otMinutes = state === 'checked_in'
    ? getOtMinutes(row.check_in_time, row.check_out_time, now)
    : toNumber(row.ot_minutes)

  return {
    attendanceId: row.attendance_id,
    state,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    workingSeconds: getWorkingSeconds(row.check_in_time, row.check_out_time, now),
    otMinutes,
    otActive: state === 'checked_in' && otMinutes > 0,
    geoVerified: Boolean(row.geo_verified),
    shiftStatus: row.shift_status?.trim() || (state === 'checked_out' ? 'Completed' : state === 'checked_in' ? 'Standard' : 'Not Started'),
    checkInLocation: parseLocation(row.check_in_location),
    checkOutLocation: parseLocation(row.check_out_location),
  } satisfies CrewShiftSnapshot
}

function mapHistoryRow(row: DailyAttendanceRow, now = new Date()) {
  const checkInLocation = parseLocation(row.check_in_location)
  return {
    id: row.attendance_id,
    state: getShiftState(row),
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    shiftStatus: row.shift_status?.trim() || 'Standard',
    durationMinutes: Math.floor(getWorkingSeconds(row.check_in_time, row.check_out_time, now) / 60),
    otMinutes: row.check_out_time ? toNumber(row.ot_minutes) : getOtMinutes(row.check_in_time, row.check_out_time, now),
    geoVerified: Boolean(row.geo_verified),
    location: checkInLocation,
    mapLink: buildMapLink(checkInLocation),
  } satisfies CrewAttendanceHistoryItem
}

function buildOvertimeGroups(crewRows: CrewMemberListItem[], crewDirectory: Map<string, CrewMemberRow>) {
  const grouped = new Map<string, { item: OvertimeGroupItem; totalOtMinutes: number; totalCost: number }>()

  for (const row of crewRows) {
    if (row.otMinutes <= 0 || row.status === 'offduty') {
      continue
    }

    const crewMember = crewDirectory.get(row.userId)
    const groupKey = crewMember?.department ?? 'production'
    const existing = grouped.get(groupKey)
    const estimatedCost = calculateOtCost(
      row.otMinutes,
      toNumber(crewMember?.day_rate),
      Math.max(toNumber(crewMember?.shift_hours_planned, 10), 1),
    )

    if (existing) {
      existing.item.memberCount += 1
      existing.totalOtMinutes += row.otMinutes
      existing.totalCost += estimatedCost
      existing.item.estimatedCostUSD = Number(existing.totalCost.toFixed(2))
      existing.item.elapsedLabel = `${(existing.totalOtMinutes / 60).toFixed(1)}h`
      continue
    }

    grouped.set(groupKey, {
      item: {
        id: `ot-${groupKey}`,
        name: `${formatDepartment(groupKey)} OT`,
        memberCount: 1,
        startTime: row.checkInTime,
        elapsedLabel: `${(row.otMinutes / 60).toFixed(1)}h`,
        estimatedCostUSD: Number(estimatedCost.toFixed(2)),
        authorized: false,
      },
      totalOtMinutes: row.otMinutes,
      totalCost: estimatedCost,
    })
  }

  return Array.from(grouped.values()).map(group => group.item)
}

export async function getCrewList(projectId: string) {
  const attendanceRows = await getTodayAttendanceRows(projectId)
  const userIds = Array.from(new Set(attendanceRows.map(row => row.user_id)))
  const [crewDirectory, userMap] = await Promise.all([
    getCrewDirectory(projectId, userIds),
    getUserMap(userIds),
  ])

  return attendanceRows.map(row => mapCrewRow(row, crewDirectory.get(row.user_id), userMap.get(row.user_id)))
}

export async function getOvertimeGroups(projectId: string) {
  const attendanceRows = await getTodayAttendanceRows(projectId)
  const userIds = Array.from(new Set(attendanceRows.map(row => row.user_id)))
  const [crewDirectory, userMap] = await Promise.all([
    getCrewDirectory(projectId, userIds),
    getUserMap(userIds),
  ])

  const crewRows = attendanceRows.map(row => mapCrewRow(row, crewDirectory.get(row.user_id), userMap.get(row.user_id)))
  return buildOvertimeGroups(crewRows, crewDirectory)
}

export async function getAttendanceDashboard(projectId: string, actorUserId: string) {
  const now = new Date()
  const [attendanceRows, recentRows, openAttendance, todayAttendance, projectLocation] = await Promise.all([
    getTodayAttendanceRows(projectId),
    getRecentAttendanceForUser(projectId, actorUserId),
    getOpenAttendance(projectId, actorUserId),
    getAttendanceForLocalDay(projectId, actorUserId, getLocalDateKey()),
    getProjectLocation(projectId),
  ])

  const userIds = Array.from(new Set(attendanceRows.map(row => row.user_id)))
  const [crewDirectory, userMap] = await Promise.all([
    getCrewDirectory(projectId, userIds),
    getUserMap(userIds),
  ])

  const crewRows = attendanceRows.map(row => mapCrewRow(row, crewDirectory.get(row.user_id), userMap.get(row.user_id), now))
  const otGroups = buildOvertimeGroups(crewRows, crewDirectory)
  const totalOTCost = crewRows.reduce((sum, row) => {
    const crewMember = crewDirectory.get(row.userId)
    return sum + calculateOtCost(
      row.otMinutes,
      toNumber(crewMember?.day_rate),
      Math.max(toNumber(crewMember?.shift_hours_planned, 10), 1),
    )
  }, 0)

  return {
    summary: {
      totalCrew: crewRows.length,
      activeOTCrew: crewRows.filter(row => row.status === 'ot').length,
      totalOTCost: Number(totalOTCost.toFixed(2)),
    },
    crew: crewRows,
    myShift: mapShiftSnapshot(openAttendance ?? todayAttendance, now),
    myRecords: recentRows.map(row => mapHistoryRow(row, now)),
    projectLocation,
    otGroups,
  } satisfies AttendanceDashboardData
}

export async function listAttendanceHistory(
  projectId: string,
  actorUserId: string,
  access: CrewAccessContext,
  query: AttendanceHistoryQuery,
): Promise<AttendanceHistoryResult> {
  const permissions = getCrewModulePermissions(access)
  if (!permissions.canAccessModule) {
    throw new HttpError(403, 'Your role does not have access to the Crew & Wages module.')
  }

  const pagination = createPagination({
    page: query.page ?? 1,
    pageSize: query.limit ?? 10,
  })
  const { from, to } = rangeFromPagination(pagination)
  const { startDate, endDate, startIso, endIso } = buildAttendanceHistoryDateRange(query)
  const emptyResult = () => ({
    ...toPaginatedResult([], 0, pagination),
    filters: {
      startDate,
      endDate,
    },
  })

  let scopedUserIds: string[] | null = null
  if (permissions.crewScope === 'self') {
    scopedUserIds = [actorUserId]
  } else if (permissions.crewScope === 'department') {
    const crewDirectory = await getCrewDirectory(projectId)
    const departmentToken = normalizeRole(access.department)
    scopedUserIds = Array.from(crewDirectory.values())
      .filter(row => normalizeRole(row.department) === departmentToken)
      .map(row => row.user_id)
  } else if (permissions.crewScope === 'none') {
    return emptyResult()
  }

  if (scopedUserIds && scopedUserIds.length === 0) {
    return emptyResult()
  }

  let historyQuery = adminClient
    .from('daily_attendance')
    .select('attendance_id, user_id, project_id, check_in_time, check_out_time, check_in_location, check_out_location, geo_verified, shift_status, ot_minutes, created_at, updated_at', { count: 'exact' })
    .eq('project_id', projectId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  if (scopedUserIds) {
    historyQuery = historyQuery.in('user_id', scopedUserIds)
  }

  const { data, error, count } = await historyQuery
    .order('check_in_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  throwIfError(error as SupabaseLikeError | null)

  const rows = (data ?? []) as DailyAttendanceRow[]
  const userIds = Array.from(new Set(rows.map(row => row.user_id)))
  const [crewDirectory, userMap] = await Promise.all([
    getCrewDirectory(projectId, userIds),
    getUserMap(userIds),
  ])

  const mapped = rows.map(row => mapHistoryRecord(row, crewDirectory.get(row.user_id), userMap.get(row.user_id)))
  return {
    ...toPaginatedResult(mapped, count ?? mapped.length, pagination),
    filters: {
      startDate,
      endDate,
    },
  }
}

export async function exportAttendanceHistoryPdf(
  projectId: string,
  actorUserId: string,
  access: CrewAccessContext,
  query: AttendanceHistoryQuery,
) {
  const history = await listAttendanceHistory(projectId, actorUserId, access, query)
  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .maybeSingle()

  throwIfError(projectError as SupabaseLikeError | null)

  const { startDate, endDate } = buildAttendanceHistoryDateRange(query)
  const projectName = String((project as { name?: string } | null)?.name ?? 'Project')
  const lines = [
    'ProdSync Crew Attendance Export',
    `Project: ${projectName}`,
    `Range: ${startDate} to ${endDate}`,
    `Page: ${history.pagination.page} / ${history.pagination.totalPages}`,
    '',
    'Name | Department | Check In | Check Out | Duration | OT | Status',
    ...history.data.map(row => [
      row.name,
      row.department,
      row.checkInTime ? new Date(row.checkInTime).toLocaleString('en-IN') : '--',
      row.checkOutTime ? new Date(row.checkOutTime).toLocaleString('en-IN') : 'Working',
      `${row.durationMinutes} min`,
      `${row.otMinutes} min`,
      row.shiftStatus,
    ].join(' | ')),
  ]

  const safeProjectName = projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project'
  return {
    filename: `${safeProjectName}-crew-attendance.pdf`,
    contentType: 'application/pdf',
    body: createSimplePdf(lines),
  }
}
