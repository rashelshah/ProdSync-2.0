/**
 * modulesGallery — items for the CircularGallery on the landing page.
 * Images will be added manually to /public/modules/.
 * Until then, picsum placeholders are used as fallback via the component.
 */

import transportImg from '@/assets/modules/transport.png'
import cameraImg from '@/assets/modules/camera.png'
import crewImg from '@/assets/modules/crew.png'
import expensesImg from '@/assets/modules/expenses.png'
import approvalsImg from '@/assets/modules/approvals.png'
import reportsImg from '@/assets/modules/reports.png'

export const modulesGallery: { image: string; text: string }[] = [
  {
    image: transportImg,
    text: 'Transport & Fleet Tracking',
  },
  {
    image: cameraImg,
    text: 'Camera & Asset Management',
  },
  {
    image: crewImg,
    text: 'Crew & Wage Tracking',
  },
  {
    image: expensesImg,
    text: 'Expense & Budget Control',
  },
  {
    image: approvalsImg,
    text: 'Approval Workflows',
  },
  {
    image: reportsImg,
    text: 'Reports & Insights',
  },
]
