export const PLANNING_TEMPLATE_SEED_VERSION = 2

export type ExpenseTemplateItemDefinition = {
  item: string
  qty?: number
  unit?: string
  rate?: number
  dailyWagePerDay?: number
  bufferPercent?: number
  notes?: string
}

export type ExpenseTemplateDepartmentDefinition = {
  id: string
  name: string
  moduleKey: string
  items: ExpenseTemplateItemDefinition[]
}

type CrewTemplateRoleDefinition = {
  role: string
}

type CrewTemplateDepartmentDefinition = {
  id: string
  name: string
  moduleKey: string
  roles: CrewTemplateRoleDefinition[]
}

const planningDepartmentRegistry = [
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
] as const

const expenseTemplateRegistry: ExpenseTemplateDepartmentDefinition[] = [
  { ...planningDepartmentRegistry[0], items: ['Camera Body', 'Camera Lens', 'Filters', 'Media Cards', 'Batteries', 'Monitor', 'Gimbal', 'Camera Accessories'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[1], items: ['Set Construction', 'Props', 'Decoration', 'Paint', 'Graphics'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[2], items: ['Vehicle Rental', 'Fuel', 'Driver Charges', 'Toll', 'Parking'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[3], items: ['Hotels', 'Flights', 'Local Travel', 'Guest House', 'Per Diem'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[4], items: ['Breakfast', 'Lunch', 'Dinner', 'Tea / Coffee', 'Water', 'Catering Miscellaneous'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[5], items: ['Director', 'Camera Crew', 'Production Crew', 'Makeup Crew', 'Costume Crew', 'Spot Boys', 'Light Department', 'Sound Crew'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[6], items: ['Lead Actor', 'Supporting Actor', 'Junior Artists', 'Child Artists', 'Crowd Artists'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[7], items: ['Costumes', 'Tailoring', 'Laundry', 'Makeup Kit', 'Hair Styling'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[8], items: ['Location Rent', 'Permissions', 'Police', 'Security', 'Cleaning', 'Electricity'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[9], items: ['Editor', 'Assistant Editor', 'Color Grading', 'DI', 'Sound Design', 'Foley', 'ADR', 'Music Composer', 'Background Score', 'Mixing', 'Mastering', 'Titles', 'Graphics', 'Motion Graphics', 'VFX', 'CGI', 'Subtitles', 'Deliverables'].map(item => ({ item })) },
  { ...planningDepartmentRegistry[10], items: ['Insurance', 'Contingency', 'Office', 'Printing', 'Miscellaneous'].map(item => ({ item })) },
]

const crewTemplateRegistry: CrewTemplateDepartmentDefinition[] = [
  {
    ...planningDepartmentRegistry[0],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[1],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[2],
    roles: [
      'Transport Coordinator',
      'Logistics Manager',
      'Vehicle Supervisor',
      'Driver',
      'Production Driver',
      'Equipment Driver',
      'Logistics Assistant',
      'Runner',
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[3],
    roles: [
      'Travel Coordinator',
      'Accommodation Coordinator',
      'Guest Relations',
      'Hospitality Executive',
      'Per Diem Coordinator',
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[4],
    roles: [
      'Catering Manager',
      'Catering Supervisor',
      'Catering Staff',
      'Pantry Staff',
      'Tea/Coffee Staff',
      'Water Distribution Staff',
      'Kitchen Assistant',
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[5],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[6],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[7],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[8],
    roles: [
      'Location Manager',
      'Assistant Location Manager',
      'Permission Coordinator',
      'Security Supervisor',
      'Security Staff',
      'Police Liaison',
      'Cleaning Supervisor',
      'Cleaning Staff',
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[9],
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
    ].map(role => ({ role })),
  },
  {
    ...planningDepartmentRegistry[10],
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
    ].map(role => ({ role })),
  },
]

function createExpenseTemplateItem(item: ExpenseTemplateItemDefinition, itemIndex: number) {
  return {
    id: `template-item-${itemIndex}-${item.item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    item: item.item,
    qty: item.qty ?? 0,
    unit: item.unit ?? 'Nos',
    rate: item.rate ?? 0,
    dailyWagePerDay: item.dailyWagePerDay ?? 0,
    bufferPercent: item.bufferPercent ?? 0,
    notes: item.notes ?? '',
    sortOrder: itemIndex,
    isPlanned: false,
  }
}

function createCrewTemplateRole(role: CrewTemplateRoleDefinition, departmentId: string, roleIndex: number) {
  return {
    id: `crew-template-role-${departmentId}-${roleIndex}`,
    role: role.role,
    estimatedCount: 0,
    shootDays: 0,
    dailyWage: 0,
    notes: '',
    sortOrder: roleIndex,
    isPlanned: false,
    isPreset: true,
  }
}

export function buildDefaultExpenseTemplatePayload() {
  const departments = expenseTemplateRegistry.map((department, departmentIndex) => ({
    id: `dept-${department.id}`,
    name: department.name,
    moduleKey: department.moduleKey,
    isCustom: false,
    sortOrder: departmentIndex,
    items: department.items.map((item, itemIndex) => createExpenseTemplateItem(item, itemIndex)),
  }))

  return {
    departments,
    categories: departments.flatMap(department =>
      department.items.map(item => ({
        id: item.id,
        departmentId: department.id,
        departmentName: department.name,
        moduleKey: department.moduleKey,
        item: item.item,
        qty: item.qty,
        unit: item.unit,
        rate: item.rate,
        dailyWagePerDay: item.dailyWagePerDay,
        bufferPercent: item.bufferPercent,
        notes: item.notes,
        sortOrder: item.sortOrder,
        isPlanned: item.isPlanned,
      })),
    ),
    estimatedCost: 0,
    departmentCount: departments.length,
    itemCount: departments.reduce((sum, department) => sum + department.items.length, 0),
    plannedItemCount: 0,
  }
}

export function buildDefaultCrewTemplatePayload() {
  const departments = crewTemplateRegistry.map((department, departmentIndex) => ({
    id: `dept-${department.id}`,
    name: department.name,
    moduleKey: department.moduleKey,
    isCustom: false,
    sortOrder: departmentIndex,
    roles: department.roles.map((role, roleIndex) => createCrewTemplateRole(role, department.id, roleIndex)),
  }))

  return {
    departments,
    roles: departments.flatMap(department =>
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
    ),
    estimatedCrew: 0,
    estimatedCost: 0,
    departmentCount: departments.length,
    roleCount: departments.reduce((sum, department) => sum + department.roles.length, 0),
    plannedRoleCount: 0,
  }
}

export const expenseTemplateRegistryDepartments = expenseTemplateRegistry
export const planningTemplateRegistryDepartments = planningDepartmentRegistry
