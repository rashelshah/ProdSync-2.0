import type { User } from '@/types'

export type LocationsSectionId =
  | 'overview'
  | 'scouting'
  | 'permissions'
  | 'amenities'
  | 'documents'
  | 'timeline'

export interface LocationsSectionConfig {
  id: LocationsSectionId
  label: string
  mobileLabel: string
  path: string
  icon: string
  description: string
  isVisible?: (user: User | null) => boolean
}

export const LOCATIONS_SECTION_CONFIG: LocationsSectionConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    mobileLabel: 'Overview',
    path: '/locations',
    icon: 'dashboard',
    description: 'Readiness, status, map preview, and key location details.',
  },
  {
    id: 'scouting',
    label: 'Scouting Gallery',
    mobileLabel: 'Scouting Gallery',
    path: '/locations/scouting',
    icon: 'photo_library',
    description: 'Recce images, videos, and field upload activity.',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    mobileLabel: 'Permissions',
    path: '/locations/permissions',
    icon: 'fact_check',
    description: 'Authority checklist, expiry tracking, and compliance state.',
  },
  {
    id: 'amenities',
    label: 'Nearby Amenities',
    mobileLabel: 'Nearby Amenities',
    path: '/locations/amenities',
    icon: 'local_hospital',
    description: 'Hospitals, police stations, and petrol bunks near the location.',
  },
  {
    id: 'documents',
    label: 'Documents',
    mobileLabel: 'Documents',
    path: '/locations/documents',
    icon: 'folder_open',
    description: 'NOCs, owner agreements, permissions, and location files.',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    mobileLabel: 'Timeline',
    path: '/locations/timeline',
    icon: 'timeline',
    description: 'Audit-safe milestone history and custom events.',
  },
]

export function getVisibleLocationsSections(user: User | null) {
  return LOCATIONS_SECTION_CONFIG.filter(section => section.isVisible ? section.isVisible(user) : true)
}

export function getLocationsSectionFromPath(pathname: string, user: User | null) {
  const visibleSections = getVisibleLocationsSections(user)
  const directMatch = visibleSections.find(section => pathname === section.path)
  if (directMatch) return directMatch

  const nestedMatch = visibleSections.find(section => section.path !== '/locations' && pathname.startsWith(`${section.path}/`))
  if (nestedMatch) return nestedMatch

  return visibleSections[0] ?? LOCATIONS_SECTION_CONFIG[0]
}
