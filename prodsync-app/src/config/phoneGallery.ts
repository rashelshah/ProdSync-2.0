/**
 * phoneGallery — screen content for the iPhone PWA Showcase section.
 *
 * ── HOW TO ADD YOUR IMAGES ──────────────────────────────────────────────────
 * Drop your screenshots into this folder inside your project:
 *
 *   /public/phone/
 *
 * Name them EXACTLY as below (case-sensitive):
 *   transport.png
 *   camera.png
 *   crew.png
 *   expenses.png
 *   approvals.png
 *   reports.png
 *
 * Recommended size: 390×844 px (iPhone 14 Pro Max screen resolution)
 * Format: PNG or JPG, transparent background not needed.
 * ────────────────────────────────────────────────────────────────────────────
 */

export interface PhoneScreen {
  /** Absolute public path to the screenshot (relative to /public) */
  image: string
  /** Module name shown as slide label */
  label: string
  /** Accent colour for the status-bar dot and label */
  accent: string
}

export const phoneGallery: PhoneScreen[] = [
  {
    image: '/phone/transport.png',
    label: 'Transport & Fleet',
    accent: '#f97316', // orange
  },
  {
    image: '/phone/camera.png',
    label: 'Camera & Assets',
    accent: '#8b5cf6', // violet
  },
  {
    image: '/phone/crew.png',
    label: 'Crew & Wages',
    accent: '#0ea5e9', // sky
  },
  {
    image: '/phone/expenses.png',
    label: 'Expense Control',
    accent: '#10b981', // emerald
  },
  {
    image: '/phone/approvals.png',
    label: 'Approvals',
    accent: '#f59e0b', // amber
  },
  {
    image: '/phone/reports.png',
    label: 'Reports & Insights',
    accent: '#ec4899', // pink
  },
]
