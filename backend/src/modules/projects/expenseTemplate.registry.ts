export type ExpenseTemplateItemDefinition = {
  item: string
  qty?: number
  unit?: string
  rate?: number
  bufferPercent?: number
  notes?: string
}

export type ExpenseTemplateDepartmentDefinition = {
  id: string
  name: string
  moduleKey: string
  items: ExpenseTemplateItemDefinition[]
}

const expenseTemplateRegistry: ExpenseTemplateDepartmentDefinition[] = [
  { id: 'camera-assets', name: 'Camera & Assets', moduleKey: 'camera', items: ['Camera Body', 'Camera Lens', 'Filters', 'Media Cards', 'Batteries', 'Monitor', 'Gimbal', 'Camera Accessories'].map(item => ({ item })) },
  { id: 'art-department', name: 'Art Department', moduleKey: 'art', items: ['Set Construction', 'Props', 'Decoration', 'Paint', 'Graphics'].map(item => ({ item })) },
  { id: 'transport-logistics', name: 'Transport & Logistics', moduleKey: 'transport', items: ['Vehicle Rental', 'Fuel', 'Driver Charges', 'Toll', 'Parking'].map(item => ({ item })) },
  { id: 'accommodation-travel', name: 'Accommodation & Travel', moduleKey: 'accommodation', items: ['Hotels', 'Flights', 'Local Travel', 'Guest House', 'Per Diem'].map(item => ({ item })) },
  { id: 'food-beverages', name: 'Food & Beverages', moduleKey: 'food-beverages', items: ['Breakfast', 'Lunch', 'Dinner', 'Tea / Coffee', 'Water', 'Catering Miscellaneous'].map(item => ({ item })) },
  { id: 'crew-wages', name: 'Crew & Wages', moduleKey: 'crew', items: ['Director', 'Camera Crew', 'Production Crew', 'Makeup Crew', 'Costume Crew', 'Spot Boys', 'Light Department', 'Sound Crew'].map(item => ({ item })) },
  { id: 'actor-juniors', name: 'Actor & Juniors', moduleKey: 'actors', items: ['Lead Actor', 'Supporting Actor', 'Junior Artists', 'Child Artists', 'Crowd Artists'].map(item => ({ item })) },
  { id: 'wardrobe-makeup', name: 'Wardrobe & Makeup', moduleKey: 'wardrobe', items: ['Costumes', 'Tailoring', 'Laundry', 'Makeup Kit', 'Hair Styling'].map(item => ({ item })) },
  { id: 'locations', name: 'Locations', moduleKey: 'locations', items: ['Location Rent', 'Permissions', 'Police', 'Security', 'Cleaning', 'Electricity'].map(item => ({ item })) },
  { id: 'post-production', name: 'Post Production', moduleKey: 'post', items: ['Editor', 'Assistant Editor', 'Color Grading', 'DI', 'Sound Design', 'Foley', 'ADR', 'Music Composer', 'Background Score', 'Mixing', 'Mastering', 'Titles', 'Graphics', 'Motion Graphics', 'VFX', 'CGI', 'Subtitles', 'Deliverables'].map(item => ({ item })) },
  { id: 'miscellaneous', name: 'Miscellaneous', moduleKey: 'production', items: ['Insurance', 'Contingency', 'Office', 'Printing', 'Miscellaneous'].map(item => ({ item })) },
]

function createExpenseTemplateItem(item: ExpenseTemplateItemDefinition, itemIndex: number) {
  return {
    id: `template-item-${itemIndex}-${item.item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    item: item.item,
    qty: item.qty ?? 0,
    unit: item.unit ?? 'Nos',
    rate: item.rate ?? 0,
    bufferPercent: item.bufferPercent ?? 0,
    notes: item.notes ?? '',
    sortOrder: itemIndex,
    isPlanned: false,
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
        bufferPercent: item.bufferPercent,
        notes: item.notes,
        sortOrder: item.sortOrder,
        isPlanned: item.isPlanned,
      })),
    ),
    estimatedCost: 0,
    departmentCount: departments.length,
    itemCount: departments.reduce((sum, department) => sum + department.items.length, 0),
  }
}

export const expenseTemplateRegistryDepartments = expenseTemplateRegistry
