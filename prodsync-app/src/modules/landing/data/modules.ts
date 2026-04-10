/**
 * Module data for the landing page showcase.
 * Icon imports live here so LandingPage is not polluted with seldom-used icons.
 * Leave `imageSrc` empty — user will supply actual screenshots.
 * The `placeholderGradient` is used as a premium fallback until images arrive.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Clapperboard,
  Receipt,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react'

export interface ModuleItem {
  id: string
  title: string
  description: string
  icon: LucideIcon
  /** CSS gradient string rendered as the card image placeholder */
  placeholderGradient: string
  /** Tailwind text-color class for icon + accent elements */
  accentClass: string
  /** Tailwind bg-color class (low opacity) for icon container background */
  accentBgClass: string
  /**
   * Optional path to an actual screenshot.
   * Leave empty — falls back to `placeholderGradient`.
   * Example: '/modules/transport-preview.png'
   */
  imageSrc?: string
}

export const landingModules: ModuleItem[] = [
  {
    id: 'transport',
    title: 'Transport & Fleet Tracking',
    description:
      'Live GPS tracking for every vehicle in the unit, with automatic fuel and route logging.',
    icon: Truck,
    placeholderGradient: 'linear-gradient(145deg, #0d2137 0%, #071522 100%)',
    accentClass: 'text-sky-400',
    accentBgClass: 'bg-sky-400/10',
    imageSrc: '',
  },
  {
    id: 'camera',
    title: 'Camera & Asset Management',
    description:
      'Check-in/out gear, track serial numbers, and manage maintenance logs for high-value equipment.',
    icon: Camera,
    placeholderGradient: 'linear-gradient(145deg, #18103a 0%, #0e0820 100%)',
    accentClass: 'text-violet-400',
    accentBgClass: 'bg-violet-400/10',
    imageSrc: '',
  },
  {
    id: 'crew',
    title: 'Crew & Wage Tracking',
    description:
      'Automated digital timecards, department approvals, and integrated daily wage calculations.',
    icon: Users,
    placeholderGradient: 'linear-gradient(145deg, #2a1505 0%, #1a0d03 100%)',
    accentClass: 'text-orange-400',
    accentBgClass: 'bg-orange-400/10',
    imageSrc: '',
  },
  {
    id: 'expenses',
    title: 'Expense & Budget Control',
    description:
      'Real-time budget burn, PO approvals, and department-wise production finance monitoring.',
    icon: Receipt,
    placeholderGradient: 'linear-gradient(145deg, #0a2218 0%, #061510 100%)',
    accentClass: 'text-emerald-400',
    accentBgClass: 'bg-emerald-400/10',
    imageSrc: '',
  },
  {
    id: 'approvals',
    title: 'Approval Workflows',
    description:
      'Custom approval queues for POs, call sheets, and daily production reports.',
    icon: ShieldCheck,
    placeholderGradient: 'linear-gradient(145deg, #1a1a22 0%, #101016 100%)',
    accentClass: 'text-zinc-300',
    accentBgClass: 'bg-white/[0.06]',
    imageSrc: '',
  },
  {
    id: 'reports',
    title: 'Reports & Insights',
    description:
      'On-demand production efficiency snapshots and stakeholder-ready dashboards.',
    icon: Clapperboard,
    placeholderGradient: 'linear-gradient(145deg, #241a05 0%, #161003 100%)',
    accentClass: 'text-amber-400',
    accentBgClass: 'bg-amber-400/10',
    imageSrc: '',
  },
]
