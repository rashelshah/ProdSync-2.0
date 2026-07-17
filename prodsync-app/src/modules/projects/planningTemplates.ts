export const PLANNING_TEMPLATE_SEED_VERSION = 2

export type CrewPlanningRole = {
  id: string
  role: string
  estimatedCount: number
  shootDays: number
  dailyWage: number
  notes: string
  sortOrder: number
  isPlanned: boolean
  isPreset: boolean
}

export type CrewPlanningDepartment = {
  id: string
  name: string
  moduleKey: string
  isCustom: boolean
  sortOrder: number
  roles: CrewPlanningRole[]
}

export type PlanningDepartmentTemplate = {
  id: string
  name: string
  moduleKey: string
}

type CrewDepartmentTemplate = PlanningDepartmentTemplate & {
  roles: string[]
}

const numberValue = (value: unknown) => Number(value ?? 0) || 0

export const planningDepartmentTemplates: PlanningDepartmentTemplate[] = [
  { id: 'camera-assets', name: 'Camera & Assets', moduleKey: 'camera' },
  { id: 'art-department', name: 'Art Department', moduleKey: 'art' },
  { id: 'transport-logistics', name: 'Transport & Logistics', moduleKey: 'transport' },
  { id: 'accommodation-travel', name: 'Accommodation & Travel', moduleKey: 'accommodation' },
  { id: 'food-beverages', name: 'Food & Beverages', moduleKey: 'food-beverages' },
  { id: 'crew-wages', name: 'Crew & Wages', moduleKey: 'crew' },
  { id: 'actor-juniors', name: 'Actor & Juniors', moduleKey: 'actors' },
  { id: 'wardrobe-makeup', name: 'Wardrobe & Makeup', moduleKey: 'wardrobe' },
  { id: 'locations', name: 'Locations', moduleKey: 'locations' },
  { id: 'post-production', name: 'Post Production', moduleKey: 'post' },
  { id: 'miscellaneous', name: 'Miscellaneous', moduleKey: 'production' },
]

const crewDepartmentTemplates: CrewDepartmentTemplate[] = [
  {
    ...planningDepartmentTemplates[0],
    roles: [
      'Director',
      'Associate Director',
      'Chief Assistant Director',
      'First Assistant Director',
      'Second Assistant Director',
      'Third Assistant Director',
      'Script Supervisor',
      'Continuity Supervisor',
      'Director of Photography (DOP)',
      'Camera Operator',
      'First Assistant Camera (Focus Puller)',
      'Second Assistant Camera',
      'Camera Attendant',
      'Camera Trainee',
      'Digital Imaging Technician (DIT)',
      'Drone Operator',
      'Steadicam Operator',
      'Gaffer',
      'Chief Lighting Technician',
      'Best Boy Electric',
      'Lighting Technician',
      'Lightman',
      'Generator Operator',
      'Electrician',
      'Key Grip',
      'Dolly Grip',
      'Grip Assistant',
      'Rigging Grip',
      'Production Sound Mixer',
      'Boom Operator',
      'Sound Recordist',
      'Sound Assistant',
      'Playback Operator',
    ],
  },
  {
    ...planningDepartmentTemplates[1],
    roles: [
      'Production Designer',
      'Art Director',
      'Assistant Art Director',
      'Set Supervisor',
      'Set Dresser',
      'Props Master',
      'Carpenter',
      'Painter',
      'Sculptor',
      'Fabricator',
      'Graphic Designer',
      'Signage Artist',
      'Prop Assistant',
    ],
  },
  {
    ...planningDepartmentTemplates[2],
    roles: [
      'Transport Coordinator',
      'Logistics Manager',
      'Vehicle Supervisor',
      'Driver',
      'Production Driver',
      'Equipment Driver',
      'Logistics Assistant',
      'Runner',
    ],
  },
  {
    ...planningDepartmentTemplates[3],
    roles: [
      'Travel Coordinator',
      'Accommodation Coordinator',
      'Guest Relations',
      'Hospitality Executive',
      'Per Diem Coordinator',
    ],
  },
  {
    ...planningDepartmentTemplates[4],
    roles: [
      'Catering Manager',
      'Catering Supervisor',
      'Catering Staff',
      'Pantry Staff',
      'Tea/Coffee Staff',
      'Water Distribution Staff',
      'Kitchen Assistant',
    ],
  },
  {
    ...planningDepartmentTemplates[5],
    roles: [
      'Executive Producer',
      'Producer',
      'Line Producer',
      'Unit Production Manager',
      'Production Manager',
      'Production Executive',
      'Production Coordinator',
      'Production Assistant',
      'Office Assistant',
      'Accountant',
      'Payroll Coordinator',
      'Cashier',
    ],
  },
  {
    ...planningDepartmentTemplates[6],
    roles: [
      'Lead Actor',
      'Supporting Actor',
      'Character Artist',
      'Junior Artist',
      'Child Artist',
      'Crowd Artist',
      'Body Double',
      'Stunt Performer',
      'Action Double',
      'Dance Performer',
      'Choreographer',
    ],
  },
  {
    ...planningDepartmentTemplates[7],
    roles: [
      'Costume Designer',
      'Costume Supervisor',
      'Costume Assistant',
      'Wardrobe Assistant',
      'Tailor',
      'Laundry Staff',
      'Chief Makeup Artist',
      'Makeup Artist',
      'Makeup Assistant',
      'Hair Stylist',
      'Hair Assistant',
      'Prosthetic Makeup Artist',
      'Special Effects Makeup Artist',
    ],
  },
  {
    ...planningDepartmentTemplates[8],
    roles: [
      'Location Manager',
      'Assistant Location Manager',
      'Permission Coordinator',
      'Security Supervisor',
      'Security Staff',
      'Police Liaison',
      'Cleaning Supervisor',
      'Cleaning Staff',
    ],
  },
  {
    ...planningDepartmentTemplates[9],
    roles: [
      'Editor',
      'Associate Editor',
      'Assistant Editor',
      'Offline Editor',
      'Online Editor',
      'Colorist',
      'DI Supervisor',
      'DI Artist',
      'Sound Designer',
      'Dialogue Editor',
      'ADR Supervisor',
      'ADR Engineer',
      'Foley Supervisor',
      'Foley Artist',
      'Re-recording Mixer',
      'Mixing Engineer',
      'Mastering Engineer',
      'Music Composer',
      'Background Score Composer',
      'Music Producer',
      'Motion Graphics Artist',
      'Graphic Designer',
      'Title Designer',
      'VFX Supervisor',
      'VFX Producer',
      'VFX Artist',
      'CGI Artist',
      'Compositor',
      'Matchmove Artist',
      'Roto Artist',
      'Paint Artist',
      'Tracking Artist',
      'Subtitle Editor',
      'QC Operator',
      'Mastering Coordinator',
      'DCP Operator',
      'Deliverables Coordinator',
      'Archive Manager',
    ],
  },
  {
    ...planningDepartmentTemplates[10],
    roles: [
      'BTS Photographer',
      'BTS Videographer',
      'Social Media Manager',
      'Public Relations Officer',
      'Marketing Coordinator',
      'Office Boy',
      'General Assistant',
      'Data Entry Operator',
      'Insurance Coordinator',
      'Compliance Officer',
    ],
  },
]

function newCrewPlanningRole(role = 'Crew Role', sortOrder = 0, overrides: Partial<CrewPlanningRole> = {}): CrewPlanningRole {
  return {
    id: `crew-role-${crypto.randomUUID()}`,
    role,
    estimatedCount: 0,
    shootDays: 0,
    dailyWage: 0,
    notes: '',
    sortOrder,
    isPlanned: false,
    isPreset: false,
    ...overrides,
  }
}

function normalizeCrewPlanningRole(role: Partial<CrewPlanningRole>, roleIndex: number): CrewPlanningRole {
  return newCrewPlanningRole(String(role.role ?? 'Crew Role'), Number(role.sortOrder ?? roleIndex), {
    id: String(role.id ?? `crew-role-${roleIndex}`),
    estimatedCount: numberValue(role.estimatedCount),
    shootDays: numberValue(role.shootDays),
    dailyWage: numberValue(role.dailyWage),
    notes: String(role.notes ?? ''),
    sortOrder: Number(role.sortOrder ?? roleIndex),
    isPlanned: Boolean(role.isPlanned),
    isPreset: Boolean(role.isPreset),
  })
}

function normalizeCrewPlanningDepartment(department: Partial<CrewPlanningDepartment>, departmentIndex: number): CrewPlanningDepartment {
  return {
    id: String(department.id ?? `dept-${departmentIndex}`),
    name: String(department.name ?? 'Department'),
    moduleKey: String(department.moduleKey ?? 'custom'),
    isCustom: Boolean(department.isCustom),
    sortOrder: Number(department.sortOrder ?? departmentIndex),
    roles: Array.isArray(department.roles)
      ? department.roles.map((role, roleIndex) => normalizeCrewPlanningRole(role, roleIndex)).sort((left, right) => left.sortOrder - right.sortOrder)
      : [],
  }
}

function uniqueDepartmentName(baseName: string, usedNames: Set<string>) {
  const trimmedBase = baseName.trim() || 'Department'
  if (!usedNames.has(trimmedBase.toLowerCase())) {
    usedNames.add(trimmedBase.toLowerCase())
    return trimmedBase
  }

  let suffix = 2
  while (usedNames.has(`${trimmedBase} ${suffix}`.toLowerCase())) {
    suffix += 1
  }

  const nextName = `${trimmedBase} ${suffix}`
  usedNames.add(nextName.toLowerCase())
  return nextName
}

function normalizeLegacyCrewDepartments(payload: Record<string, unknown>) {
  const rows = Array.isArray(payload.departments) ? payload.departments as Array<Record<string, unknown>> : []
  const templateByName = new Map(planningDepartmentTemplates.map(template => [template.name.trim().toLowerCase(), template]))
  const usedNames = new Set<string>()

  return rows.map((row, index) => {
    const requestedName = String(row.department ?? `Department ${index + 1}`)
    const template = templateByName.get(requestedName.trim().toLowerCase())
    const departmentName = uniqueDepartmentName(template?.name ?? requestedName, usedNames)
    const roleName = String(row.role ?? row.department ?? `Crew Role ${index + 1}`)
    return {
      id: String(row.id ?? `legacy-crew-${index}`),
      name: departmentName,
      moduleKey: template?.moduleKey ?? 'custom',
      isCustom: !template,
      sortOrder: index,
      roles: [
        newCrewPlanningRole(roleName, 0, {
          id: `legacy-crew-role-${index}`,
          estimatedCount: numberValue(row.estimatedCrew),
          shootDays: numberValue(row.estimatedDays),
          dailyWage: numberValue(row.estimatedDailyWage),
          isPlanned: Boolean(row.isPlanned ?? (numberValue(row.estimatedCrew) > 0 || numberValue(row.estimatedDays) > 0 || numberValue(row.estimatedDailyWage) > 0)),
          isPreset: false,
        }),
      ],
    } satisfies CrewPlanningDepartment
  })
}

export function buildDefaultCrewPlanningDepartments(): CrewPlanningDepartment[] {
  return crewDepartmentTemplates.map((department, departmentIndex) => ({
    id: `dept-${department.id}`,
    name: department.name,
    moduleKey: department.moduleKey,
    isCustom: false,
    sortOrder: departmentIndex,
    roles: department.roles.map((role, roleIndex) =>
      newCrewPlanningRole(role, roleIndex, {
        id: `crew-template-role-${department.id}-${roleIndex}`,
        isPreset: true,
      })),
  }))
}

export function normalizeCrewPlanningDepartments(payload: Record<string, unknown> | undefined | null): CrewPlanningDepartment[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload.departments) && payload.departments.length > 0) {
    const nestedDepartments = payload.departments as Array<Record<string, unknown>>
    if (nestedDepartments.some(department => Array.isArray(department.roles))) {
      return nestedDepartments
        .map((department, departmentIndex) => normalizeCrewPlanningDepartment(department as Partial<CrewPlanningDepartment>, departmentIndex))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    }

    return normalizeLegacyCrewDepartments(payload)
  }

  return []
}

export function flattenCrewPlanningDepartments(departments: CrewPlanningDepartment[]) {
  return departments.flatMap(department =>
    department.roles.map(role => ({
      id: role.id,
      departmentId: department.id,
      departmentName: department.name,
      moduleKey: department.moduleKey,
      role: role.role,
      estimatedCount: role.estimatedCount,
      shootDays: role.shootDays,
      dailyWage: role.dailyWage,
      notes: role.notes,
      sortOrder: role.sortOrder,
      isPlanned: role.isPlanned,
      isPreset: role.isPreset,
    })),
  )
}

export function crewPlanningRoleTotal(role: CrewPlanningRole) {
  return numberValue(role.estimatedCount) * numberValue(role.shootDays) * numberValue(role.dailyWage)
}

export function crewPlanningDepartmentTotal(department: CrewPlanningDepartment) {
  return department.roles.reduce((sum, role) => sum + crewPlanningRoleTotal(role), 0)
}

export function summarizeCrewPlanningDepartments(departments: CrewPlanningDepartment[]) {
  return {
    estimatedCrew: departments.reduce((sum, department) => sum + department.roles.reduce((roleSum, role) => roleSum + numberValue(role.estimatedCount), 0), 0),
    estimatedCost: departments.reduce((sum, department) => sum + crewPlanningDepartmentTotal(department), 0),
    departmentCount: departments.length,
    roleCount: departments.reduce((sum, department) => sum + department.roles.length, 0),
    plannedRoleCount: departments.reduce((sum, department) => sum + department.roles.filter(role => role.isPlanned).length, 0),
  }
}
