import type { ProjectDepartment, ProjectRequestedRole, User, UserRole } from '@/types'

export interface DepartmentConfig {
  id: ProjectDepartment
  label: string
  description: string
}

export interface DepartmentRoleConfig {
  id: ProjectRequestedRole
  label: string
  description: string
  accessRole: UserRole
}

export const DEPARTMENT_OPTIONS: DepartmentConfig[] = [
  {
    id: 'production',
    label: 'Production',
    description: 'Project command, scheduling, approvals, and day-to-day unit coordination.',
  },
  {
    id: 'camera',
    label: 'Camera',
    description: 'Camera team operations, shoot execution, and media handling.',
  },
  {
    id: 'art',
    label: 'Art',
    description: 'Set preparation, props, visual continuity, and art execution.',
  },
  {
    id: 'transport',
    label: 'Transport',
    description: 'Fleet movement, dispatching, route planning, and transport control.',
  },
  {
    id: 'post',
    label: 'Post Production',
    description: 'Editing, grading, delivery preparation, and post-production handoff.',
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    description: 'Costume prep, continuity, fittings, and on-set wardrobe support.',
  },
  {
    id: 'actors',
    label: 'Actor & Juniors',
    description: 'Actor scheduling, junior artist coordination, batta tracking, and look continuity.',
  },
]

export const DEPARTMENT_ROLE_OPTIONS: Record<ProjectDepartment, DepartmentRoleConfig[]> = {
  production: [
    {
      id: 'Executive Producer',
      label: 'Executive Producer',
      description: 'Full command access for budgets, approvals, and cross-department visibility.',
      accessRole: 'EP',
    },
    {
      id: 'Line Producer',
      label: 'Line Producer',
      description: 'Operations control across staffing, schedules, and project delivery.',
      accessRole: 'LineProducer',
    },
    {
      id: 'Production Manager',
      label: 'Production Manager',
      description: 'Execution oversight for crew flow, logistics, and daily coordination.',
      accessRole: 'Supervisor',
    },
    {
      id: '1st AD',
      label: '1st AD',
      description: 'Run floor execution, call timing, and set readiness.',
      accessRole: 'Supervisor',
    },
  ],
  camera: [
    {
      id: 'DOP',
      label: 'DOP',
      description: 'Lead camera direction, visual language, and department decisions.',
      accessRole: 'HOD',
    },
    {
      id: '1st AC',
      label: '1st AC',
      description: 'Support camera execution, lens prep, and technical set operations.',
      accessRole: 'Supervisor',
    },
    {
      id: 'Camera Operator',
      label: 'Camera Operator',
      description: 'Focused crew access for assigned camera tasks and shot execution.',
      accessRole: 'Crew',
    },
  ],
  art: [
    {
      id: 'Art Director',
      label: 'Art Director',
      description: 'Lead the art department, set build priorities, and visual delivery.',
      accessRole: 'HOD',
    },
    {
      id: 'Art Assistant',
      label: 'Art Assistant',
      description: 'Handle assigned props, set support, and department execution work.',
      accessRole: 'Crew',
    },
  ],
  transport: [
    {
      id: 'Transport Captain',
      label: 'Transport Captain',
      description: 'Own dispatch visibility, route planning, and transport team control.',
      accessRole: 'HOD',
    },
    {
      id: 'Driver',
      label: 'Driver',
      description: 'See assigned vehicle movement, trip updates, and field requests only.',
      accessRole: 'Driver',
    },
  ],
  post: [
    {
      id: 'Editor',
      label: 'Editor',
      description: 'Lead post timelines, edit review, and delivery coordination.',
      accessRole: 'HOD',
    },
    {
      id: 'Colorist',
      label: 'Colorist',
      description: 'Focused access for grading tasks, review notes, and delivery work.',
      accessRole: 'Supervisor',
    },
  ],
  wardrobe: [
    {
      id: 'Costume Supervisor',
      label: 'Costume Supervisor',
      description: 'Lead wardrobe continuity, fittings, and department priorities.',
      accessRole: 'HOD',
    },
    {
      id: 'Wardrobe Stylist',
      label: 'Wardrobe Stylist',
      description: 'Handle assigned costume prep, continuity, and on-set wardrobe support.',
      accessRole: 'Crew',
    },
  ],
  actors: [
    {
      id: 'Actor Coordinator',
      label: 'Actor Coordinator',
      description: 'Lead actor scheduling, call sheets, payments, and look continuity decisions.',
      accessRole: 'HOD',
    },
    {
      id: 'Junior Artist Coordinator',
      label: 'Junior Artist Coordinator',
      description: 'Handle daily junior artist supply, supporting actor logistics, and set coordination.',
      accessRole: 'Crew',
    },
  ],
}

const DEFAULT_ROLE_LABELS: Record<UserRole, string> = {
  EP: 'Executive Producer',
  LineProducer: 'Line Producer',
  HOD: 'Department Lead',
  Supervisor: 'Crew Member',
  Crew: 'Crew Member',
  Driver: 'Driver',
  DataWrangler: 'Data Wrangler',
}

const DEFAULT_PROJECT_ROLE_BY_USER_ROLE: Record<UserRole, ProjectRequestedRole> = {
  EP: 'Executive Producer',
  LineProducer: 'Line Producer',
  HOD: 'Production Manager',
  Supervisor: 'Production Manager',
  Crew: 'Crew Member',
  Driver: 'Driver',
  DataWrangler: 'Data Wrangler',
}

const DEFAULT_PROJECT_ROLE_BY_DEPARTMENT: Record<ProjectDepartment, ProjectRequestedRole> = {
  production: 'Production Manager',
  camera: 'Camera Operator',
  art: 'Art Assistant',
  transport: 'Driver',
  post: 'Editor',
  wardrobe: 'Wardrobe Stylist',
  actors: 'Junior Artist Coordinator',
}

const PERMISSION_COPY: Record<
  UserRole,
  {
    can: string[]
    cannot: string[]
  }
> = {
  EP: {
    can: [
      'Create projects and manage project-wide setup',
      'Approve budgets, requests, and department escalations',
      'View cross-department dashboards and reports',
    ],
    cannot: [
      'Bypass final backend permission controls',
      'Access projects you are not a member or owner of',
    ],
  },
  LineProducer: {
    can: [
      'Create projects and manage production operations',
      'Review logistics, crew flow, and budget-sensitive requests',
      'View cross-functional production workspaces',
    ],
    cannot: [
      'Change permissions outside assigned projects',
      'Access projects you are not a member or owner of',
    ],
  },
  HOD: {
    can: [
      'Manage your department workspace and assigned team activity',
      'Review department-specific requests and execution status',
      'View data tied to your project membership and department',
    ],
    cannot: [
      'Approve master budgets or producer-only controls',
      'View unrelated departments without explicit access',
    ],
  },
  Supervisor: {
    can: [
      'Track daily execution, requests, and shift-readiness items',
      'View project data needed for assigned operational work',
      'Submit updates and escalations within your scope',
    ],
    cannot: [
      'Access producer finance controls',
      'View project data outside your department scope',
    ],
  },
  Crew: {
    can: [
      'Submit requests and task updates',
      'View your project assignments and own work data',
      'Access department tools needed for assigned tasks',
    ],
    cannot: [
      'Access budgets or command dashboards',
      'View other departments or unassigned project data',
    ],
  },
  Driver: {
    can: [
      'View assigned transport tasks and project movement details',
      'Submit trip updates and field requests',
      'Access only the project transport data tied to your membership',
    ],
    cannot: [
      'Access budgets or department-wide production controls',
      'View other departments or unrelated projects',
    ],
  },
  DataWrangler: {
    can: [
      'Track media handoff, offloads, and assigned camera-data work',
      'Submit progress updates for your shift',
      'Access project data tied to your approved responsibilities',
    ],
    cannot: [
      'Access budgets or producer-only controls',
      'View unrelated department data or projects',
    ],
  },
}

export function getDepartmentLabel(departmentId?: ProjectDepartment) {
  return DEPARTMENT_OPTIONS.find(option => option.id === departmentId)?.label ?? 'Production'
}

export function getRoleOptionsForDepartment(departmentId: ProjectDepartment) {
  return DEPARTMENT_ROLE_OPTIONS[departmentId]
}

export function mapProjectRoleToUserRole(projectRoleTitle: ProjectRequestedRole): UserRole {
  for (const departmentRoles of Object.values(DEPARTMENT_ROLE_OPTIONS)) {
    const match = departmentRoles.find(option => option.id === projectRoleTitle)
    if (match) return match.accessRole
  }

  if (projectRoleTitle === 'Data Wrangler') return 'DataWrangler'
  if (projectRoleTitle === 'Crew Member') return 'Crew'
  return 'Crew'
}

export function getDefaultProjectRoleForDepartment(departmentId: ProjectDepartment) {
  return DEFAULT_PROJECT_ROLE_BY_DEPARTMENT[departmentId]
}

export function getProjectRoleTitle(user: Pick<User, 'projectRoleTitle' | 'role' | 'departmentId'>) {
  if (user.projectRoleTitle) return user.projectRoleTitle
  if (user.departmentId) return DEFAULT_PROJECT_ROLE_BY_DEPARTMENT[user.departmentId]
  return DEFAULT_PROJECT_ROLE_BY_USER_ROLE[user.role]
}

export function getUserRoleLabel(user: Pick<User, 'roleLabel' | 'role' | 'projectRoleTitle' | 'departmentId'>) {
  return user.roleLabel ?? user.projectRoleTitle ?? getProjectRoleTitle(user) ?? DEFAULT_ROLE_LABELS[user.role]
}

export function getPermissionCopy(userRole: UserRole) {
  return PERMISSION_COPY[userRole]
}
