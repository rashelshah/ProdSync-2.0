// ─── Core Domain Types ──────────────────────────────────────────────────────

export type UserRole = 'EP' | 'LineProducer' | 'HOD' | 'Supervisor' | 'Crew' | 'Driver' | 'DataWrangler'

export interface User {
  id: string
  name: string
  email?: string
  role: UserRole
  roleLabel?: string
  projectRoleTitle?: ProjectRequestedRole
  departmentId?: ProjectDepartment
  departmentLabel?: string
  avatarUrl?: string
}

export type ProjectStage = 'pre-production' | 'shooting' | 'post'
export type ProjectDepartment = 'camera' | 'art' | 'transport' | 'production' | 'wardrobe' | 'post' | 'actors'
export type ProjectCurrency = 'INR' | 'USD' | 'EUR'
export type ProjectRequestedRole =
  | 'Executive Producer'
  | 'Line Producer'
  | 'Production Manager'
  | '1st AD'
  | 'DOP'
  | '1st AC'
  | 'Camera Operator'
  | 'Art Director'
  | 'Art Assistant'
  | 'Transport Captain'
  | 'Driver'
  | 'Editor'
  | 'Colorist'
  | 'Costume Supervisor'
  | 'Wardrobe Stylist'
  | 'Actor Coordinator'
  | 'Junior Artist Coordinator'
  | 'Crew Member'
  | 'Data Wrangler'

export interface ProjectRecord {
  id: string
  name: string
  ownerId: string
  ownerName: string
  location: string
  status: ProjectStage
  progressPercent: number
  spentAmount: number
  isOverBudget: boolean
  budgetUSD: number
  currency: ProjectCurrency
  activeCrew: number
  startDate: string
  endDate: string
  enabledDepartments: ProjectDepartment[]
  otRulesLabel: string
}

export interface ProjectProgressSnapshot {
  progress: number
  spent: number
  budget: number
  isOverBudget: boolean
  overBudgetAmount: number
}

export type BudgetAllocationDepartment = 'transport' | 'crew' | 'camera' | 'art' | 'wardrobe' | 'post' | 'production'

export interface ProjectBudgetAllocation {
  id: string
  projectId: string
  department: BudgetAllocationDepartment
  allocatedAmount: number
  allocatedPercentage: number
  createdAt: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ProjectMember {
  id: string
  userId: string
  projectId: string
  role: ProjectRequestedRole
  permissions: string[]
  approvedAt: string
}

export interface ProjectJoinRequest {
  id: string
  userId: string
  userName: string
  projectId: string
  projectDetails?: ProjectRecord | null
  roleRequested: ProjectRequestedRole
  status: 'pending' | 'approved' | 'rejected'
  message?: string
  createdAt: string
}

// ─── Transport ───────────────────────────────────────────────────────────────

export type VehicleStatus = 'active' | 'idle' | 'maintenance' | 'exception'
export type TripStatus = 'active' | 'completed' | 'flagged'
export type AuditStatus = 'verified' | 'mismatch' | 'pending'

export interface Vehicle {
  id: string
  name: string
  type: string
  status: VehicleStatus
  driverId: string
  lat?: number
  lng?: number
}

export interface Trip {
  id: string
  vehicleId: string
  vehicleName: string
  driverName: string
  startTime: string
  endTime: string | null
  distanceKm: number
  status: TripStatus
  location?: string
}

export interface FuelLog {
  id: string
  date: string
  vehicleId: string
  vehicleName: string
  litres: number
  expectedMileage: number
  actualMileage: number
  auditStatus: AuditStatus
  receiptUrl?: string
}

// UI-adapted shapes
export interface TripUI extends Trip {
  durationLabel: string
  statusLabel: string
}

export interface FuelLogUI extends FuelLog {
  mismatchPercent: number
  efficiencyRating: 'good' | 'warning' | 'critical'
}

export interface TransportKpis {
  activeVehicles: number
  inTransit: number
  idleVehicles: number
  tripsToday: number
  totalDistanceKm: number
  fuelCost: number
  fuelBurnStatus: 'ok' | 'warning' | 'critical'
}

// ─── Crew ────────────────────────────────────────────────────────────────────

export type AttendanceVerification = 'gps' | 'manual' | 'biometric'
export type CrewStatus = 'active' | 'ot' | 'offduty'
export type BattaStatus = 'requested' | 'approved' | 'paid' | 'rejected'
export type CrewShiftState = 'not_checked_in' | 'checked_in' | 'checked_out'

export interface CrewLocationPoint {
  lat: number
  lng: number
  accuracy: number | null
  timestamp: string
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

export interface CrewMember {
  id: string
  attendanceId?: string
  userId?: string
  name: string
  role: string
  department: string
  checkInTime: string
  checkOutTime?: string
  checkInAt?: string | null
  checkOutAt?: string | null
  computedDuration?: string
  computedDurationSeconds?: number
  verification: AttendanceVerification
  status: CrewStatus
  shiftHours: number
  otMinutes?: number
  geoVerified?: boolean
  state?: CrewShiftState
  location?: CrewLocationPoint | null
  mapLink?: string | null
}

export interface OvertimeGroup {
  id: string
  name: string
  memberCount: number
  startTime: string
  elapsedLabel: string
  estimatedCostUSD: number
  authorized: boolean
}

export interface WagePayout {
  id: string
  attendanceId?: string | null
  crewMemberId: string
  crewName: string
  department: string
  amount: number
  method: 'UPI' | 'CASH' | 'BANK'
  type: 'batta' | 'ot' | 'wage'
  status: BattaStatus
  timestamp: string
  requestedBy?: string | null
  approvedBy?: string | null
  paidBy?: string | null
}

export interface CrewKpis {
  totalCrew: number
  plannedHeadcount: number
  activeOtCrew: number
  totalOtCostUSD: number
  battaRequested: number
  battaPaid: number
  overstaffingCount: number
}

export interface CrewShiftSnapshot {
  attendanceId: string | null
  state: CrewShiftState
  checkInTime: string | null
  checkOutTime: string | null
  workingSeconds: number
  otMinutes: number
  otActive: boolean
  geoVerified: boolean
  shiftStatus: string
  checkInLocation: CrewLocationPoint | null
  checkOutLocation: CrewLocationPoint | null
}

export interface CrewAttendanceHistoryItem {
  id: string
  attendanceId?: string
  userId?: string
  name?: string
  role?: string
  department?: string
  state: CrewShiftState
  checkInTime: string | null
  checkOutTime: string | null
  shiftStatus: string
  durationMinutes: number
  otMinutes: number
  geoVerified: boolean
  location: CrewLocationPoint | null
  mapLink: string | null
}

export interface CrewAttendanceHistoryResponse {
  data: CrewAttendanceHistoryItem[]
  pagination: PaginationMeta
  filters: {
    startDate: string
    endDate: string
  }
}

export interface CrewPermissions {
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

export interface CrewDashboardSummary {
  totalCrew: number
  activeOTCrew: number
  totalOTCost: number
  battaRequested: number
  battaPaid: number
}

export interface CrewDashboardData {
  summary: CrewDashboardSummary
  permissions: CrewPermissions
  projectLocation: CrewProjectLocation | null
  myShift: CrewShiftSnapshot
  myRecords: CrewAttendanceHistoryItem[]
  crew: CrewMember[]
  otGroups: OvertimeGroup[]
  payouts: WagePayout[]
  battaQueue: WagePayout[]
  serverNow: string
  guards?: {
    usesOsmOnly: boolean
    gpsCheck: boolean
  }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export type ApprovalType = string
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ApprovalPriority = 'emergency' | 'high' | 'normal'
export type ApprovalWorkflowStatus = 'pending' | 'pending_dop' | 'pending_art_director' | 'pending_producer' | 'approved' | 'rejected'

export interface ApprovalRequest {
  id: string
  type: ApprovalType
  department: string
  requestedBy: string
  requestedByInitials: string
  amountINR: number
  timestamp: string
  status: ApprovalStatus
  priority: ApprovalPriority
  workflowStatus?: ApprovalWorkflowStatus
  stageLabel?: string
  canAct?: boolean
  notes?: string
  sourceModule?: string | null
}

export interface ApprovalHistory {
  requestId: string
  approvedBy: string
  role: string
  timestamp: string
  auditNote: string
  action: 'approved' | 'rejected'
}

export interface ApprovalsKpis {
  totalPending: number
  highValue: number
  approvedToday: number
  rejectedToday: number
  pendingValueINR: number
  avgActionTimeMinutes: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  budgetActualUSD: number
  budgetTotalUSD: number
  budgetPercent: number
  todaySpendUSD: number
  todaySpendDelta: number
  cashFlowUSD: number
  cashFlowReservePercent: number
  otCostTodayUSD: number
  otStatus: 'ok' | 'warning' | 'critical'
  activeCrew: number
  crewCheckInPercent: number
  activeFleet: number
}

export interface DeptVelocityItem {
  dept: string
  budget: number
  actual: number
}

export interface BurnDataPoint {
  week: string
  actual: number
  planned: number
}

export interface ActivityEvent {
  id: string
  type: string
  title: string
  description: string
  timestamp: string | Date
  module: string
}

export interface DepartmentSnapshot {
  id: string
  name: string
  status: 'active' | 'stable' | 'warning' | 'over'
  metrics: { label: string; value: string }[]
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertSource = 'transport' | 'crew' | 'camera' | 'expenses' | 'wardrobe' | 'approvals' | 'system'

export interface AlertItem {
  id: string
  severity: AlertSeverity
  source: AlertSource
  title: string
  message: string
  timestamp: Date | string
  acknowledged: boolean
}

// Reports

export type ReportSeverity = 'GREEN' | 'YELLOW' | 'RED'
export type ReportHealth = 'green' | 'yellow' | 'red'

export interface ReportBurnChartPoint {
  date: string
  actual: number
  planned: number
  transport: number
  crew: number
  camera: number
  art: number
  wardrobe: number
  post: number
  production: number
}

export interface ReportDepartmentRow {
  department: string
  label: string
  spent: number
  budget: number
  variance: number
  pendingApprovals: number
  overtimeLiability: number
  share: number
  status: ReportHealth
}

export interface ReportAlert {
  id: string
  type: string
  severity: ReportSeverity
  message: string
  department: string | null
  createdAt: string
  resolved: boolean
}

export interface ReportScope {
  type: 'full' | 'department'
  departments: string[]
  label: string
}

export interface ReportSummary {
  totalSpend: number
  budget: number
  variance: number
  cashFlow: number
  predictedTotal: number
  pendingApprovals: number
  overtimeLiability: number
  activeCrewCount: number
  burnRate: ReportBurnChartPoint[]
  alerts: ReportAlert[]
  health: ReportHealth
  scope: ReportScope
  lastUpdated: string
}
