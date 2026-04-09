import { apiFetch, readApiJson } from '@/lib/api'
import type { BudgetAllocationDepartment, ProjectBudgetAllocation, ProjectCurrency, ProjectDepartment, ProjectJoinRequest, ProjectMember, ProjectProgressSnapshot, ProjectRecord, ProjectRequestedRole } from '@/types'

interface BackendProject {
  id: string
  ownerId: string
  ownerName: string
  name: string
  location: string
  status: ProjectRecord['status']
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

interface AccessibleProjectRow {
  id: string
  projectId: string
  role: ProjectRequestedRole
  accessRole: string
  department: string
  approvedAt: string | null
  project: BackendProject | null
}

interface ProjectsResponse {
  projects: AccessibleProjectRow[]
}

interface DiscoverableProjectsResponse {
  projects: BackendProject[]
}

interface JoinRequestsResponse {
  requests: Array<ProjectJoinRequest & { projectName?: string }>
}

interface CreateProjectInput {
  name: string
  location: string
  status: ProjectRecord['status']
  budgetUSD: number
  currency: ProjectCurrency
  activeCrew: number
  startDate: string
  endDate: string
  enabledDepartments: ProjectDepartment[]
  otRulesLabel: string
}

interface JoinRequestCreateInput {
  projectId: string
  roleRequested: ProjectRequestedRole
  message?: string
}

interface UpdateProjectInput extends CreateProjectInput {
  projectId: string
}

function toProjectRecord(project: BackendProject): ProjectRecord {
  return {
    id: project.id,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    name: project.name,
    location: project.location,
    status: project.status,
    progressPercent: Number(project.progressPercent ?? 0),
    spentAmount: Number(project.spentAmount ?? 0),
    isOverBudget: Boolean(project.isOverBudget),
    budgetUSD: Number(project.budgetUSD ?? 0),
    currency: project.currency ?? 'INR',
    activeCrew: Number(project.activeCrew ?? 0),
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    enabledDepartments: project.enabledDepartments ?? [],
    otRulesLabel: project.otRulesLabel ?? '',
  }
}

function toProjectMember(row: AccessibleProjectRow, userId: string): ProjectMember {
  return {
    id: row.id,
    userId,
    projectId: row.projectId,
    role: row.role,
    permissions: [],
    approvedAt: row.approvedAt ?? new Date(0).toISOString(),
  }
}

export const projectsService = {
  async getAccessibleProjects(userId: string) {
    console.log('[projectsService] fetching accessible projects')
    const response = await apiFetch('/projects')
    const payload = await readApiJson<ProjectsResponse>(response)
    const rows = payload.projects ?? []
    const projects = rows
      .map(row => row.project)
      .filter((project): project is BackendProject => project !== null)
      .map(toProjectRecord)
    const projectMembers = rows.map(row => toProjectMember(row, userId))

    console.log('[projectsService] accessible projects loaded', { count: projects.length })
    return { projects, projectMembers }
  },

  async getDiscoverableProjects() {
    console.log('[projectsService] fetching discoverable projects')
    const response = await apiFetch('/projects/discover')
    const payload = await readApiJson<DiscoverableProjectsResponse>(response)
    const projects = (payload.projects ?? []).map(toProjectRecord)
    console.log('[projectsService] discoverable projects loaded', { count: projects.length })
    return projects
  },

  async getJoinRequests() {
    console.log('[projectsService] fetching join requests')
    const response = await apiFetch('/projects/join-requests')
    const payload = await readApiJson<JoinRequestsResponse>(response)
    console.log('[projectsService] join requests loaded', { count: payload.requests?.length ?? 0 })
    return payload.requests ?? []
  },

  async createProject(input: CreateProjectInput) {
    console.log('[projectsService] creating project', { name: input.name, status: input.status })
    const response = await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ project: BackendProject | null; projectId: string }>(response)
    console.log('[projectsService] project create response', { projectId: payload.projectId })
    return payload.project ? toProjectRecord(payload.project) : null
  },

  async updateProject(input: UpdateProjectInput) {
    console.log('[projectsService] updating project', { projectId: input.projectId, name: input.name })
    const response = await apiFetch(`/projects/${encodeURIComponent(input.projectId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ project: BackendProject | null }>(response)
    console.log('[projectsService] update project response', { projectId: input.projectId })
    return payload.project ? toProjectRecord(payload.project) : null
  },

  async getProject(projectId: string) {
    console.log('[projectsService] fetching live project', { projectId })
    const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}`)
    const payload = await readApiJson<{ project: BackendProject | null }>(response)
    return payload.project ? toProjectRecord(payload.project) : null
  },

  async getProjectProgress(projectId: string) {
    console.log('[projectsService] fetching project progress', { projectId })
    const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/progress`)
    return readApiJson<ProjectProgressSnapshot>(response)
  },

  async getBudgetAllocations(projectId: string) {
    console.log('[projectsService] fetching budget allocations', { projectId })
    const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/budget-allocation`)
    const payload = await readApiJson<{ allocations: ProjectBudgetAllocation[] }>(response)
    return payload.allocations ?? []
  },

  async saveBudgetAllocations(projectId: string, allocations: Array<{
    department: BudgetAllocationDepartment
    allocatedAmount: number
    allocatedPercentage: number
  }>) {
    console.log('[projectsService] saving budget allocations', { projectId, count: allocations.length })
    const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/budget-allocation`, {
      method: 'POST',
      body: JSON.stringify({ allocations }),
    })
    return readApiJson<{
      allocations: ProjectBudgetAllocation[]
      totals: {
        allocatedAmount: number
        allocatedPercentage: number
        remainingAmount: number
        budget: number
      }
    }>(response)
  },

  async createJoinRequest(input: JoinRequestCreateInput) {
    console.log('[projectsService] creating join request', { projectId: input.projectId, roleRequested: input.roleRequested })
    const response = await apiFetch(`/projects/${encodeURIComponent(input.projectId)}/join-requests`, {
      method: 'POST',
      body: JSON.stringify({
        roleRequested: input.roleRequested,
        message: input.message,
      }),
    })
    const payload = await readApiJson<{ request: ProjectJoinRequest | null }>(response)
    console.log('[projectsService] join request response', { projectId: input.projectId })
    return payload.request
  },

  async reviewJoinRequest(requestId: string, status: 'approved' | 'rejected') {
    console.log('[projectsService] reviewing join request', { requestId, status })
    const response = await apiFetch(`/projects/join-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    const payload = await readApiJson<{ request: ProjectJoinRequest | null }>(response)
    console.log('[projectsService] join request review response', { requestId, status })
    return payload.request
  },
}
