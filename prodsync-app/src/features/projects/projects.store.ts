import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getProjectRoleTitle } from '@/features/auth/onboarding'
import type {
  ProjectDepartment,
  ProjectJoinRequest,
  ProjectMember,
  ProjectRecord,
  ProjectRequestedRole,
  User,
} from '@/types'

interface CreateProjectInput {
  name: string
  location: string
  status: ProjectRecord['status']
  budgetUSD: number
  activeCrew: number
  startDate: string
  endDate: string
  enabledDepartments: ProjectDepartment[]
  otRulesLabel: string
}

interface JoinRequestInput {
  projectId: string
  user: User
  roleRequested: ProjectRequestedRole
  message?: string
}

interface ProjectsStore {
  projects: ProjectRecord[]
  projectMembers: ProjectMember[]
  joinRequests: ProjectJoinRequest[]
  activeProjectId: string | null
  setActiveProject: (projectId: string | null) => void
  createProject: (input: CreateProjectInput, owner: User) => void
  requestJoin: (input: JoinRequestInput) => void
  approveJoinRequest: (requestId: string) => void
  rejectJoinRequest: (requestId: string) => void
}

const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj-noir',
    name: 'Project Noir',
    ownerId: 'producer-seed-1',
    ownerName: 'K. Sharma',
    location: 'Chennai',
    status: 'shooting',
    progressPercent: 62,
    budgetUSD: 1250000,
    activeCrew: 146,
    startDate: '2026-03-02',
    endDate: '2026-06-28',
    enabledDepartments: ['camera', 'art', 'transport', 'production', 'wardrobe'],
    otRulesLabel: 'FEFSI OT with night premium',
  },
  {
    id: 'proj-skyline',
    name: 'Skyline Unit B',
    ownerId: 'producer-seed-2',
    ownerName: 'R. Kapoor',
    location: 'Hyderabad',
    status: 'pre-production',
    progressPercent: 24,
    budgetUSD: 860000,
    activeCrew: 58,
    startDate: '2026-04-18',
    endDate: '2026-08-03',
    enabledDepartments: ['camera', 'art', 'transport', 'production', 'post'],
    otRulesLabel: 'Standard OT with capped overtime buffer',
  },
  {
    id: 'proj-atlas',
    name: 'Atlas After Dark',
    ownerId: 'producer-seed-3',
    ownerName: 'A. Verma',
    location: 'Mumbai',
    status: 'post',
    progressPercent: 87,
    budgetUSD: 1430000,
    activeCrew: 32,
    startDate: '2025-11-10',
    endDate: '2026-04-21',
    enabledDepartments: ['camera', 'post', 'production'],
    otRulesLabel: 'Post-heavy OT approval by producer only',
  },
]

const INITIAL_MEMBERS: ProjectMember[] = [
  {
    id: 'member-1',
    userId: 'producer-seed-1',
    projectId: 'proj-noir',
    role: 'Line Producer',
    permissions: ['project:*', 'budget:approve', 'member:approve'],
    approvedAt: new Date().toISOString(),
  },
  {
    id: 'member-2',
    userId: 'producer-seed-2',
    projectId: 'proj-skyline',
    role: 'Executive Producer',
    permissions: ['project:*', 'budget:approve', 'member:approve'],
    approvedAt: new Date().toISOString(),
  },
]

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function mapUserRoleToRequestedRole(user: User): ProjectRequestedRole {
  return getProjectRoleTitle(user)
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set) => ({
      projects: INITIAL_PROJECTS,
      projectMembers: INITIAL_MEMBERS,
      joinRequests: [],
      activeProjectId: null,

      setActiveProject: (projectId) => set({ activeProjectId: projectId }),

      createProject: (input, owner) =>
        set(state => {
          const projectId = createId('project')
          const nextProject: ProjectRecord = {
            id: projectId,
            ownerId: owner.id,
            ownerName: owner.name,
            progressPercent: input.status === 'pre-production' ? 12 : input.status === 'shooting' ? 48 : 84,
            ...input,
          }

          const ownerMembership: ProjectMember = {
            id: createId('member'),
            userId: owner.id,
            projectId,
            role: mapUserRoleToRequestedRole(owner),
            permissions: ['project:*', 'budget:approve', 'member:approve'],
            approvedAt: new Date().toISOString(),
          }

          return {
            projects: [nextProject, ...state.projects],
            projectMembers: [ownerMembership, ...state.projectMembers],
            activeProjectId: projectId,
          }
        }),

      requestJoin: ({ projectId, user, roleRequested, message }) =>
        set(state => {
          const existingRequest = state.joinRequests.find(
            request => request.projectId === projectId && request.userId === user.id && request.status === 'pending',
          )
          const existingMembership = state.projectMembers.find(
            member => member.projectId === projectId && member.userId === user.id,
          )

          if (existingRequest || existingMembership) {
            return state
          }

          const nextRequest: ProjectJoinRequest = {
            id: createId('request'),
            userId: user.id,
            userName: user.name,
            projectId,
            roleRequested,
            status: 'pending',
            message,
            createdAt: new Date().toISOString(),
          }

          return {
            joinRequests: [nextRequest, ...state.joinRequests],
          }
        }),

      approveJoinRequest: (requestId) =>
        set(state => {
          const request = state.joinRequests.find(item => item.id === requestId)
          if (!request) return state

          const existingMembership = state.projectMembers.find(
            member => member.projectId === request.projectId && member.userId === request.userId,
          )

          return {
            joinRequests: state.joinRequests.map(item =>
              item.id === requestId ? { ...item, status: 'approved' } : item,
            ),
            projectMembers: existingMembership
              ? state.projectMembers
              : [
                  {
                    id: createId('member'),
                    userId: request.userId,
                    projectId: request.projectId,
                    role: request.roleRequested,
                    permissions: ['project:read', 'attendance:write', 'request:create'],
                    approvedAt: new Date().toISOString(),
                  },
                  ...state.projectMembers,
                ],
            activeProjectId: state.activeProjectId ?? request.projectId,
          }
        }),

      rejectJoinRequest: (requestId) =>
        set(state => ({
          joinRequests: state.joinRequests.map(item =>
            item.id === requestId ? { ...item, status: 'rejected' } : item,
          ),
        })),
    }),
    {
      name: 'prodsync-projects',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        projects: state.projects,
        projectMembers: state.projectMembers,
        joinRequests: state.joinRequests,
        activeProjectId: state.activeProjectId,
      }),
    },
  ),
)
