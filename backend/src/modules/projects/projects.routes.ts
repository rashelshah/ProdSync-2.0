import { Router } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { adminClient } from '../../config/supabaseClient'
import { authMiddleware } from '../../middleware/auth.middleware'
import { projectAccessMiddleware } from '../../middleware/projectAccess.middleware'
import { roleMiddleware } from '../../middleware/role.middleware'
import { emitProjectEvent } from '../../realtime/socket'
import { BUDGET_ALLOCATION_DEPARTMENTS, listBudgetAllocations, saveBudgetAllocations } from '../../services/budgetAllocation.service'
import { calculateProjectProgress } from '../../services/projectFinance.service'
import { getProjectAccess } from '../../services/project-access.service'
import { getProjectProgressSnapshot } from '../../services/reportService'
import { asyncHandler } from '../../utils/asyncHandler'
import { HttpError } from '../../utils/httpError'

export const projectsRouter = Router()

const departmentSchema = z.enum(['camera', 'art', 'transport', 'production', 'wardrobe', 'post', 'actors'])
const frontendProjectStatusSchema = z.enum(['pre-production', 'shooting', 'post'])
const currencySchema = z.enum(['INR', 'USD', 'EUR'])
const frontendProjectRoleSchema = z.enum([
  'Executive Producer',
  'Line Producer',
  'Production Manager',
  '1st AD',
  'DOP',
  '1st AC',
  'Camera Operator',
  'Art Director',
  'Art Assistant',
  'Transport Captain',
  'Driver',
  'Editor',
  'Colorist',
  'Costume Supervisor',
  'Wardrobe Stylist',
  'Actor Coordinator',
  'Junior Artist Coordinator',
  'Crew Member',
  'Data Wrangler',
])

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(150),
  location: z.string().trim().min(2).max(150),
  status: frontendProjectStatusSchema,
  budgetUSD: z.coerce.number().min(0).max(1_000_000_000),
  currency: currencySchema.default('INR'),
  activeCrew: z.coerce.number().int().min(0).max(100_000).optional(),
  startDate: z.string().date().optional().or(z.literal('')),
  endDate: z.string().date().optional().or(z.literal('')),
  enabledDepartments: z.array(departmentSchema).max(7).default([]),
  otRulesLabel: z.string().trim().max(200).optional(),
})

const updateProjectSchema = createProjectSchema.extend({
  activeCrew: z.coerce.number().int().min(0).max(100_000).optional(),
})

const budgetAllocationDepartmentSchema = z.enum(BUDGET_ALLOCATION_DEPARTMENTS)

const budgetAllocationEntrySchema = z.object({
  department: budgetAllocationDepartmentSchema,
  allocatedAmount: z.coerce.number().min(0).optional(),
  allocatedPercentage: z.coerce.number().min(0).max(100).optional(),
}).superRefine((value, ctx) => {
  if (value.allocatedAmount == null && value.allocatedPercentage == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Allocation amount or percentage is required.',
      path: ['allocatedAmount'],
    })
  }
})

const budgetAllocationPayloadSchema = z.object({
  allocations: z.array(budgetAllocationEntrySchema).max(BUDGET_ALLOCATION_DEPARTMENTS.length),
})

const createJoinRequestSchema = z.object({
  roleRequested: frontendProjectRoleSchema,
  message: z.string().trim().max(500).optional(),
})

const reviewJoinRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(500).optional(),
})

const joinProjectSchema = z.object({
  codeOrToken: z.string().trim().min(3),
  roleRequested: frontendProjectRoleSchema,
  department: z.enum(['camera', 'art', 'transport', 'production', 'wardrobe', 'post', 'actors']),
})

function generateProjectCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 8)
}

const frontendProjectStatusToDb = {
  'pre-production': 'pre_production',
  shooting: 'shooting',
  post: 'post',
} as const

const dbProjectStatusToFrontend = {
  pre_production: 'pre-production',
  shooting: 'shooting',
  post: 'post',
} as const

const frontendRoleToDbRole = {
  'Executive Producer': 'executive_producer',
  'Line Producer': 'line_producer',
  'Production Manager': 'production_manager',
  '1st AD': 'first_ad',
  DOP: 'dop',
  '1st AC': 'first_ac',
  'Camera Operator': 'camera_operator',
  'Art Director': 'art_director',
  'Art Assistant': 'art_assistant',
  'Transport Captain': 'transport_captain',
  Driver: 'driver',
  Editor: 'editor',
  Colorist: 'colorist',
  'Costume Supervisor': 'costume_supervisor',
  'Wardrobe Stylist': 'wardrobe_stylist',
  'Actor Coordinator': 'actor_coordinator',
  'Junior Artist Coordinator': 'junior_artist_coordinator',
  'Crew Member': 'crew_member',
  'Data Wrangler': 'data_wrangler',
} as const

const frontendRoleToAccessRole = {
  'Executive Producer': 'EP',
  'Line Producer': 'LINE_PRODUCER',
  'Production Manager': 'SUPERVISOR',
  '1st AD': 'SUPERVISOR',
  DOP: 'HOD',
  '1st AC': 'SUPERVISOR',
  'Camera Operator': 'CREW',
  'Art Director': 'HOD',
  'Art Assistant': 'CREW',
  'Transport Captain': 'HOD',
  Driver: 'DRIVER',
  Editor: 'HOD',
  Colorist: 'SUPERVISOR',
  'Costume Supervisor': 'HOD',
  'Wardrobe Stylist': 'CREW',
  'Actor Coordinator': 'HOD',
  'Junior Artist Coordinator': 'CREW',
  'Crew Member': 'CREW',
  'Data Wrangler': 'DATA_WRANGLER',
} as const

const frontendRoleToDepartment = {
  'Executive Producer': 'production',
  'Line Producer': 'production',
  'Production Manager': 'production',
  '1st AD': 'production',
  DOP: 'camera',
  '1st AC': 'camera',
  'Camera Operator': 'camera',
  'Art Director': 'art',
  'Art Assistant': 'art',
  'Transport Captain': 'transport',
  Driver: 'transport',
  Editor: 'post',
  Colorist: 'post',
  'Costume Supervisor': 'wardrobe',
  'Wardrobe Stylist': 'wardrobe',
  'Actor Coordinator': 'actors',
  'Junior Artist Coordinator': 'actors',
  'Crew Member': 'production',
  'Data Wrangler': 'camera',
} as const

type FrontendProjectRole = keyof typeof frontendRoleToDbRole

interface MembershipRow {
  id: string
  project_id: string
  role: string
  access_role: string
  department: string
  approved_at: string | null
}

interface ProjectRow {
  id: string
  name: string
  owner_id: string
  status: keyof typeof dbProjectStatusToFrontend
  location: string | null
  budget: number | string | null
  currency_code: string | null
  start_date: string | null
  end_date: string | null
}

interface ProjectCrewRow {
  project_id: string
  active_crew_count: number | string | null
}

interface BurnSpendRow {
  project_id: string
  grand_total_daily_spend: number | string | null
}

interface DepartmentRow {
  project_id: string
  department: z.infer<typeof departmentSchema>
  enabled: boolean
}

interface SettingsRow {
  project_id: string
  ot_rules_label: string | null
}

interface JoinRequestRow {
  id: string
  user_id: string
  project_id: string
  role_requested: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  message: string | null
  created_at: string
}

interface UserRow {
  id: string
  full_name: string | null
}

type ProjectPayload = {
  id: string
  ownerId: string
  ownerName: string
  name: string
  location: string
  status: 'pre-production' | 'shooting' | 'post'
  progressPercent: number
  spentAmount: number
  isOverBudget: boolean
  budgetUSD: number
  currency: z.infer<typeof currencySchema>
  activeCrew: number
  startDate: string
  endDate: string
  enabledDepartments: z.infer<typeof departmentSchema>[]
  otRulesLabel: string
}

function formatProjectRole(role?: string | null) {
  if (!role) {
    return 'Crew Member'
  }

  return role
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ')
    .replace(/\bAd\b/, 'AD')
    .replace(/\bAc\b/, 'AC')
    .replace(/\bDop\b/, 'DOP')
}

async function buildProjectPayloads(projectIds: string[]) {
  if (projectIds.length === 0) {
    return new Map<string, ProjectPayload>()
  }

  const [{ data: projectRows, error: projectError }, { data: departmentRows, error: departmentError }, { data: settingsRows, error: settingsError }, { data: crewRows, error: crewError }, { data: burnRows, error: burnError }] = await Promise.all([
    adminClient
      .from('projects')
      .select('id, name, owner_id, status, location, budget, currency_code, start_date, end_date')
      .in('id', projectIds)
      .eq('is_archived', false),
    adminClient
      .from('project_departments')
      .select('project_id, department, enabled')
      .in('project_id', projectIds)
      .eq('enabled', true),
    adminClient
      .from('project_settings')
      .select('project_id, ot_rules_label')
      .in('project_id', projectIds),
    adminClient
      .from('project_summary')
      .select('project_id, active_crew_count')
      .in('project_id', projectIds),
    adminClient
      .from('view_daily_burn_rate')
      .select('project_id, grand_total_daily_spend')
      .in('project_id', projectIds),
  ])

  if (projectError) {
    throw projectError
  }
  if (departmentError) {
    throw departmentError
  }
  if (settingsError) {
    throw settingsError
  }
  if (crewError) {
    throw crewError
  }
  if (burnError) {
    throw burnError
  }

  const ownerIds = Array.from(new Set(((projectRows ?? []) as ProjectRow[]).map(row => row.owner_id)))
  const { data: ownerRows, error: ownerError } = ownerIds.length > 0
    ? await adminClient
        .from('users')
        .select('id, full_name')
        .in('id', ownerIds)
    : { data: [], error: null }

  if (ownerError) {
    throw ownerError
  }

  const enabledDepartmentsByProject = new Map<string, z.infer<typeof departmentSchema>[]>()
  for (const row of (departmentRows ?? []) as DepartmentRow[]) {
    const existing = enabledDepartmentsByProject.get(row.project_id) ?? []
    existing.push(row.department)
    enabledDepartmentsByProject.set(row.project_id, existing)
  }

  const settingsByProject = new Map<string, SettingsRow>()
  for (const row of (settingsRows ?? []) as SettingsRow[]) {
    settingsByProject.set(row.project_id, row)
  }

  const ownerNamesById = new Map<string, string>()
  for (const row of (ownerRows ?? []) as UserRow[]) {
    ownerNamesById.set(row.id, row.full_name ?? 'Project Owner')
  }

  const activeCrewByProject = new Map<string, number>()
  for (const row of (crewRows ?? []) as ProjectCrewRow[]) {
    activeCrewByProject.set(row.project_id, Number(row.active_crew_count ?? 0))
  }

  const spendByProject = new Map<string, number>()
  for (const row of (burnRows ?? []) as BurnSpendRow[]) {
    spendByProject.set(
      row.project_id,
      Number(((spendByProject.get(row.project_id) ?? 0) + Number(row.grand_total_daily_spend ?? 0)).toFixed(2)),
    )
  }

  const projects = new Map<string, ProjectPayload>()
  for (const row of (projectRows ?? []) as ProjectRow[]) {
    const budget = Number(row.budget ?? 0)
    const progress = calculateProjectProgress(spendByProject.get(row.id) ?? 0, budget)

    projects.set(row.id, {
      id: row.id,
      ownerId: row.owner_id,
      ownerName: ownerNamesById.get(row.owner_id) ?? 'Project Owner',
      name: row.name,
      location: row.location ?? 'Location pending',
      status: dbProjectStatusToFrontend[row.status] ?? 'pre-production',
      progressPercent: progress.progress,
      spentAmount: progress.spent,
      isOverBudget: progress.isOverBudget,
      budgetUSD: budget,
      currency: currencySchema.catch('INR').parse(row.currency_code ?? 'INR'),
      activeCrew: activeCrewByProject.get(row.id) ?? 0,
      startDate: row.start_date ?? '',
      endDate: row.end_date ?? '',
      enabledDepartments: enabledDepartmentsByProject.get(row.id) ?? [],
      otRulesLabel: settingsByProject.get(row.id)?.ot_rules_label ?? '',
    })
  }

  return projects
}

async function listAccessibleProjects(userId: string) {
  const { data, error } = await adminClient
    .from('project_members')
    .select('id, project_id, role, access_role, department, approved_at')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) {
    throw error
  }

  const memberships = (data ?? []) as MembershipRow[]
  const projectsById = await buildProjectPayloads(memberships.map(membership => membership.project_id))

  return memberships
    .map(membership => ({
      id: membership.id,
      projectId: membership.project_id,
      role: formatProjectRole(membership.role),
      accessRole: membership.access_role,
      department: membership.department,
      approvedAt: membership.approved_at,
      project: projectsById.get(membership.project_id) ?? null,
    }))
    .filter(item => item.project)
}

async function listDiscoverableProjects() {
  const { data, error } = await adminClient
    .from('projects')
    .select('id')
    .eq('is_archived', false)

  if (error) {
    throw error
  }

  const projectIds = (data ?? []).map(row => String((row as { id: string }).id))
  const projectsById = await buildProjectPayloads(projectIds)
  return Array.from(projectsById.values())
}

async function getProjectPayload(projectId: string) {
  return (await buildProjectPayloads([projectId])).get(projectId) ?? null
}

async function listRelevantJoinRequests(userId: string) {
  const [{ data: manageableMemberships, error: manageableError }, { data: ownRequests, error: ownRequestsError }] = await Promise.all([
    adminClient
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or('is_owner.eq.true,access_role.eq.EP,access_role.eq.LINE_PRODUCER'),
    adminClient
      .from('project_join_requests')
      .select('id, user_id, project_id, role_requested, status, message, created_at')
      .eq('user_id', userId),
  ])

  if (manageableError) {
    throw manageableError
  }
  if (ownRequestsError) {
    throw ownRequestsError
  }

  const manageableProjectIds = Array.from(new Set((manageableMemberships ?? []).map(row => String((row as { project_id: string }).project_id))))

  const { data: pendingManagedRequests, error: pendingManagedRequestsError } = manageableProjectIds.length > 0
    ? await adminClient
        .from('project_join_requests')
        .select('id, user_id, project_id, role_requested, status, message, created_at')
        .in('project_id', manageableProjectIds)
        .eq('status', 'pending')
    : { data: [], error: null }

  if (pendingManagedRequestsError) {
    throw pendingManagedRequestsError
  }

  const rows = [...(ownRequests ?? []), ...(pendingManagedRequests ?? [])] as JoinRequestRow[]
  const dedupedRows = Array.from(new Map(rows.map(row => [row.id, row])).values())
  const projectIds = Array.from(new Set(dedupedRows.map(row => row.project_id)))
  const requesterIds = Array.from(new Set(dedupedRows.map(row => row.user_id)))

  const [projectsById, usersResponse] = await Promise.all([
    buildProjectPayloads(projectIds),
    requesterIds.length > 0
      ? adminClient.from('users').select('id, full_name').in('id', requesterIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (usersResponse.error) {
    throw usersResponse.error
  }

  const userNamesById = new Map<string, string>()
  for (const row of (usersResponse.data ?? []) as UserRow[]) {
    userNamesById.set(row.id, row.full_name ?? 'ProdSync User')
  }

  return dedupedRows.map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: userNamesById.get(row.user_id) ?? 'ProdSync User',
    projectId: row.project_id,
    projectName: projectsById.get(row.project_id)?.name ?? 'Project',
    projectDetails: projectsById.get(row.project_id) ?? null,
    roleRequested: formatProjectRole(row.role_requested),
    status: row.status,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }))
}

projectsRouter.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.authUser?.id ?? ''
    console.log('[projects][list] route hit', { userId })

    const projects = await listAccessibleProjects(userId)
    console.log('[projects][list] db result', { userId, count: projects.length })

    res.json({ projects })
  }),
)

projectsRouter.get(
  '/preview/:codeOrToken',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const codeOrToken = req.params.codeOrToken ?? ''
    
    const { data: projectRow, error } = await adminClient
      .from('projects')
      .select('id, name, location, status, start_date, end_date')
      .eq('is_archived', false)
      .eq('invite_enabled', true)
      .or(`project_code.eq.${codeOrToken.toUpperCase()},invite_token.eq.${codeOrToken.toLowerCase()}`)
      .maybeSingle()

    if (error || !projectRow) {
      throw new HttpError(404, 'Invalid or expired project code / link')
    }

    const [{ data: departmentRows }, { data: crewCountRows }, progress] = await Promise.all([
      adminClient.from('project_departments').select('department').eq('project_id', projectRow.id).eq('enabled', true),
      adminClient.from('project_summary').select('active_crew_count').eq('project_id', projectRow.id),
      getProjectProgressSnapshot(projectRow.id),
    ])

    const departments = (departmentRows ?? []).map(row => row.department)
    const activeCrew = Number(crewCountRows?.[0]?.active_crew_count ?? 0)

    res.json({
      project: {
        id: projectRow.id, // We expose ID so the frontend can check if they are already members
        name: projectRow.name,
        location: projectRow.location ?? 'Location pending',
        status: dbProjectStatusToFrontend[projectRow.status] ?? 'pre-production',
        startDate: projectRow.start_date ?? '',
        endDate: projectRow.end_date ?? '',
        enabledDepartments: departments,
        activeCrew,
        progressPercent: progress.progress,
      }
    })
  }),
)

projectsRouter.post(
  '/join',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const payload = joinProjectSchema.parse(req.body)
    const userId = req.authUser?.id

    if (!userId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const { data: projectRow, error } = await adminClient
      .from('projects')
      .select('id')
      .eq('is_archived', false)
      .eq('invite_enabled', true)
      .or(`project_code.eq.${payload.codeOrToken.toUpperCase()},invite_token.eq.${payload.codeOrToken.toLowerCase()}`)
      .maybeSingle()

    if (error || !projectRow) {
      throw new HttpError(404, 'Invalid or expired project code / link')
    }

    const projectId = projectRow.id
    const access = await getProjectAccess(projectId, userId)
    
    // Check membership explicitly (though DB unique constraint also prevents it)
    if (access.isMember || access.isOwner) {
      const project = await getProjectPayload(projectId)
      return res.json({ project })
    }

    const dbRole = frontendRoleToDbRole[payload.roleRequested as FrontendProjectRole]
    const accessRole = frontendRoleToAccessRole[payload.roleRequested as FrontendProjectRole]

    const { error: insertError } = await adminClient
      .from('project_join_requests')
      .insert({
        user_id: userId,
        project_id: projectId,
        department: payload.department,
        role_requested: dbRole,
        access_role_requested: accessRole,
        status: 'pending',
      })

    if (insertError) {
      if (insertError.code === '23505') { // unique violation
        const project = await getProjectPayload(projectId)
        return res.json({ project, joinStatus: 'pending' })
      }
      throw insertError ?? new Error('Failed to request to join project.')
    }

    const project = await getProjectPayload(projectId)
    res.json({ project, joinStatus: 'pending' })
  }),
)

projectsRouter.get(
  '/:projectId/invite-info',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId ?? ''
    const access = await getProjectAccess(projectId, req.authUser?.id ?? '')
    
    if (!access.isMember && !access.isOwner) {
      throw new HttpError(403, 'Access denied.')
    }

    const { data: projectRow, error } = await adminClient
      .from('projects')
      .select('id, name, invite_token, project_code, invite_enabled')
      .eq('id', projectId)
      .maybeSingle()

    if (error || !projectRow) {
      throw new HttpError(404, 'Project not found.')
    }

    // Backfill if missing
    let { invite_token, project_code } = projectRow as { invite_token: string | null; project_code: string | null }

    if (!invite_token || !project_code) {
      let code = generateProjectCode()
      let attempts = 0
      let unique = false
      while (!unique && attempts < 5) {
        const { data: existing } = await adminClient.from('projects').select('id').eq('project_code', code).maybeSingle()
        if (!existing) unique = true
        else { code = generateProjectCode(); attempts++ }
      }

      const updates: Record<string, string> = {}
      if (!invite_token) updates.invite_token = crypto.randomUUID()
      if (!project_code) updates.project_code = code

      const { data: updated } = await adminClient
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select('invite_token, project_code')
        .single()

      if (updated) {
        invite_token = (updated as { invite_token: string }).invite_token
        project_code = (updated as { project_code: string }).project_code
      }
    }

    const baseUrl = process.env.FRONTEND_URL ?? 'https://app.prodsync.com'
    res.json({
      inviteToken: invite_token,
      projectCode: project_code,
      inviteEnabled: (projectRow as { invite_enabled: boolean }).invite_enabled,
      inviteLink: `${baseUrl}/join/${invite_token}`,
    })
  }),
)

projectsRouter.get(
  '/join-requests',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.authUser?.id ?? ''
    console.log('[projects][joinRequests][list] route hit', { userId })
    const requests = await listRelevantJoinRequests(userId)
    console.log('[projects][joinRequests][list] db result', { userId, count: requests.length })
    res.json({ requests })
  }),
)

projectsRouter.get(
  '/:projectId',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId ?? '')
    const project = await getProjectPayload(projectId)

    if (!project) {
      throw new HttpError(404, 'Project not found.')
    }

    const progress = await getProjectProgressSnapshot(projectId)
    res.json({
      project: {
        ...project,
        progressPercent: progress.progress,
        spentAmount: progress.spent,
        isOverBudget: progress.isOverBudget,
        budgetUSD: progress.budget,
      },
    })
  }),
)

projectsRouter.get(
  '/:projectId/progress',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId ?? '')
    const progress = await getProjectProgressSnapshot(projectId)

    res.json({
      progress: progress.progress,
      spent: progress.spent,
      budget: progress.budget,
      isOverBudget: progress.isOverBudget,
      overBudgetAmount: progress.overBudgetAmount,
    })
  }),
)

projectsRouter.get(
  '/:projectId/budget-allocation',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId ?? '')
    const allocations = await listBudgetAllocations(projectId)
    res.json({ allocations })
  }),
)

projectsRouter.post(
  '/:projectId/budget-allocation',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId ?? '')
    const userId = req.authUser?.id

    if (!userId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const access = await getProjectAccess(projectId, userId)
    const canEditProject = access.isOwner || access.membershipRole === 'EP'
    if (!canEditProject) {
      throw new HttpError(403, 'Only an Executive Producer can edit budget allocations.')
    }

    const payload = budgetAllocationPayloadSchema.parse(req.body)
    const result = await saveBudgetAllocations(projectId, payload.allocations)

    emitProjectEvent('project_updated', {
      projectId,
      data: {
        type: 'budget_allocation_updated',
      },
    })

    res.json(result)
  }),
)

projectsRouter.post(
  '/',
  authMiddleware,
  roleMiddleware(['EP', 'LINE_PRODUCER']),
  asyncHandler(async (req, res) => {
    console.log('[projects][create] route hit', { userId: req.authUser?.id ?? null, body: req.body })
    const payload = createProjectSchema.parse(req.body)
    const ownerId = req.authUser?.id

    if (!ownerId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    let projectCode = generateProjectCode()
    let isUnique = false
    let attempts = 0
    while (!isUnique && attempts < 5) {
      const { data } = await adminClient.from('projects').select('id').eq('project_code', projectCode).maybeSingle()
      if (!data) {
        isUnique = true
      } else {
        projectCode = generateProjectCode()
        attempts++
      }
    }
    
    if (!isUnique) {
      throw new HttpError(500, 'Could not generate a unique project code.')
    }

    const { data: insertedProject, error: insertError } = await adminClient
      .from('projects')
      .insert({
        owner_id: ownerId,
        name: payload.name,
        location: payload.location,
        status: frontendProjectStatusToDb[payload.status],
        budget: payload.budgetUSD,
        currency_code: payload.currency,
        progress_percent: 0,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        invite_token: crypto.randomUUID(),
        project_code: projectCode,
      })
      .select('id')
      .single()

    if (insertError || !insertedProject) {
      console.error('[projects][create] db insert error', insertError)
      throw insertError ?? new Error('Project insert did not return a record.')
    }

    const projectId = String((insertedProject as { id: string }).id)
    const enabledDepartments = new Set(['production', ...payload.enabledDepartments])
    const departmentUpserts = Array.from(enabledDepartments).map(department => ({
      project_id: projectId,
      department,
      enabled: true,
    }))
    const departmentDisables = ['camera', 'art', 'transport', 'production', 'wardrobe', 'post', 'actors']
      .filter(department => !enabledDepartments.has(department as z.infer<typeof departmentSchema>))
      .map(department => ({
        project_id: projectId,
        department,
        enabled: false,
      }))

    const [{ error: settingsError }, { error: departmentUpsertError }] = await Promise.all([
      adminClient
        .from('project_settings')
        .upsert({
          project_id: projectId,
          base_location: payload.location,
          ot_rules_label: payload.otRulesLabel?.trim() || 'Standard OT with producer approval',
        }),
      adminClient
        .from('project_departments')
        .upsert([...departmentUpserts, ...departmentDisables], { onConflict: 'project_id,department' }),
    ])

    if (settingsError) {
      console.error('[projects][create] project_settings upsert error', settingsError)
      throw settingsError
    }
    if (departmentUpsertError) {
      console.error('[projects][create] project_departments upsert error', departmentUpsertError)
      throw departmentUpsertError
    }

    const createdProject = await getProjectPayload(projectId)

    console.log('[projects][create] db result', { projectId, ownerId })
    res.status(201).json({ project: createdProject, projectId })
  }),
)

projectsRouter.put(
  '/:projectId',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    const payload = updateProjectSchema.parse(req.body)
    const projectId = String(req.params.projectId ?? '')
    const userId = req.authUser?.id

    if (!userId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const access = await getProjectAccess(projectId, userId)
    const canEditProject = access.isOwner || access.membershipRole === 'EP'
    if (!canEditProject) {
      throw new HttpError(403, 'Only an Executive Producer can edit project settings.')
    }

    const enabledDepartments = new Set(['production', ...payload.enabledDepartments])
    const departmentRows = ['camera', 'art', 'transport', 'production', 'wardrobe', 'post', 'actors'].map(department => ({
      project_id: projectId,
      department,
      enabled: enabledDepartments.has(department as z.infer<typeof departmentSchema>),
    }))

    const [{ error: projectError }, { error: settingsError }, { error: departmentError }] = await Promise.all([
      adminClient
        .from('projects')
        .update({
          name: payload.name,
          location: payload.location,
          status: frontendProjectStatusToDb[payload.status],
          budget: payload.budgetUSD,
          currency_code: payload.currency,
          start_date: payload.startDate || null,
          end_date: payload.endDate || null,
        })
        .eq('id', projectId),
      adminClient
        .from('project_settings')
        .upsert({
          project_id: projectId,
          base_location: payload.location,
          ot_rules_label: payload.otRulesLabel?.trim() || 'Standard OT with producer approval',
        }),
      adminClient
        .from('project_departments')
        .upsert(departmentRows, { onConflict: 'project_id,department' }),
    ])

    if (projectError) {
      throw projectError
    }
    if (settingsError) {
      throw settingsError
    }
    if (departmentError) {
      throw departmentError
    }

    const [projectBase, progress] = await Promise.all([
      getProjectPayload(projectId),
      getProjectProgressSnapshot(projectId),
    ])
    const project = projectBase
      ? {
          ...projectBase,
          progressPercent: progress.progress,
          spentAmount: progress.spent,
          isOverBudget: progress.isOverBudget,
          budgetUSD: progress.budget,
        }
      : null

    emitProjectEvent('project_updated', {
      projectId,
      data: {
        budget: progress.budget,
        spent: progress.spent,
        progress: progress.progress,
      },
    })

    res.json({ project })
  }),
)

projectsRouter.post(
  '/:projectId/join-requests',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const payload = createJoinRequestSchema.parse(req.body)
    const userId = req.authUser?.id
    const projectId = String(req.params.projectId ?? '')

    console.log('[projects][joinRequests][create] route hit', { userId, projectId, body: req.body })

    if (!userId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const access = await getProjectAccess(projectId, userId)
    if (access.isMember || access.isOwner) {
      throw new HttpError(409, 'You already have access to this project.')
    }

    const dbRole = frontendRoleToDbRole[payload.roleRequested as FrontendProjectRole]
    const accessRole = frontendRoleToAccessRole[payload.roleRequested as FrontendProjectRole]
    const department = frontendRoleToDepartment[payload.roleRequested as FrontendProjectRole]

    const { data, error } = await adminClient
      .from('project_join_requests')
      .insert({
        user_id: userId,
        project_id: projectId,
        department,
        role_requested: dbRole,
        access_role_requested: accessRole,
        status: 'pending',
        message: payload.message?.trim() || null,
      })
      .select('id, user_id, project_id, role_requested, status, message, created_at')
      .single()

    if (error || !data) {
      console.error('[projects][joinRequests][create] db insert error', error)
      throw error ?? new Error('Join request insert did not return a record.')
    }

    const [request] = await listRelevantJoinRequests(userId)
      .then(requests => requests.filter(item => item.id === String((data as { id: string }).id)))

    console.log('[projects][joinRequests][create] db result', { requestId: (data as { id: string }).id, userId, projectId })
    res.status(201).json({ request })
  }),
)

projectsRouter.patch(
  '/join-requests/:requestId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const payload = reviewJoinRequestSchema.parse(req.body)
    const reviewerId = req.authUser?.id
    const requestId = String(req.params.requestId ?? '')

    console.log('[projects][joinRequests][review] route hit', { reviewerId, requestId, body: req.body })

    if (!reviewerId) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const { data: joinRequest, error: joinRequestError } = await adminClient
      .from('project_join_requests')
      .select('id, project_id, status')
      .eq('id', requestId)
      .single()

    if (joinRequestError || !joinRequest) {
      throw joinRequestError ?? new HttpError(404, 'Join request not found.')
    }

    const access = await getProjectAccess(String((joinRequest as { project_id: string }).project_id), reviewerId)
    const isManager = access.isOwner || access.membershipRole === 'EP' || access.membershipRole === 'LINE_PRODUCER'
    if (!isManager) {
      throw new HttpError(403, 'You do not have permission to review this join request.')
    }

    const { data: updatedJoinRequest, error: updateError } = await adminClient
      .from('project_join_requests')
      .update({
        status: payload.status,
        review_note: payload.reviewNote?.trim() || null,
        reviewed_by: reviewerId,
      })
      .eq('id', requestId)
      .select('id')
      .single()

    if (updateError || !updatedJoinRequest) {
      console.error('[projects][joinRequests][review] db update error', updateError)
      throw updateError ?? new Error('Join request update did not return a record.')
    }

    const requests = await listRelevantJoinRequests(reviewerId)
    const request = requests.find(item => item.id === requestId) ?? null

    console.log('[projects][joinRequests][review] db result', { requestId, reviewerId, status: payload.status })
    res.json({ request })
  }),
)

projectsRouter.get(
  '/:projectId/access',
  authMiddleware,
  projectAccessMiddleware,
  asyncHandler(async (req, res) => {
    res.json({ access: req.projectAccess })
  }),
)
