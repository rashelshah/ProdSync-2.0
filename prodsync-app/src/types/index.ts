// ─── Core Domain Types ──────────────────────────────────────────────────────

export type UserRole = 'EP' | 'LineProducer' | 'HOD' | 'Supervisor' | 'Crew' | 'Driver' | 'DataWrangler'

export interface User {
  id: string
  name: string
  role: UserRole
  roleLabel?: string
  projectRoleTitle?: ProjectRequestedRole
  departmentId?: ProjectDepartment
  departmentLabel?: string
  avatarUrl?: string
}

export type ProjectStage = 'pre-production' | 'shooting' | 'post'
export type ProjectDepartment = 'camera' | 'art' | 'transport' | 'production' | 'wardrobe' | 'post'
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
  budgetUSD: number
  activeCrew: number
  startDate: string
  endDate: string
  enabledDepartments: ProjectDepartment[]
  otRulesLabel: string
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

export interface CrewMember {
  id: string
  name: string
  role: string
  department: string
  checkInTime: string
  verification: AttendanceVerification
  status: CrewStatus
  shiftHours: number
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
  crewMemberId: string
  crewName: string
  department: string
  amount: number
  method: 'UPI' | 'CASH' | 'BANK'
  type: 'batta' | 'ot' | 'wage'
  status: BattaStatus
  timestamp: string
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
