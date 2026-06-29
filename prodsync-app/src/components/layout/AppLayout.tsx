import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useProjectWorkflow } from '@/features/workflow/projectWorkflow'

const SIDEBAR_EXPANDED_WIDTH = 268
const SIDEBAR_MOBILE_EXPANDED_WIDTH = 280
const SIDEBAR_COLLAPSED_WIDTH = 92

export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const { currentNavItem, isCurrentRouteHiddenByPhase, phase } = useProjectWorkflow()
  const phaseNotice = useMemo(() => {
    const state = location.state as { phaseNotice?: string } | null
    return state?.phaseNotice ?? null
  }, [location.state])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('prodsync.sidebar.collapsed') === 'true'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  useEffect(() => {
    window.localStorage.setItem('prodsync.sidebar.collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobileViewport(mobile)

      if (!mobile) {
        setIsMobileSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const sidebarWidth = isMobileViewport
    ? SIDEBAR_MOBILE_EXPANDED_WIDTH
    : isSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH

  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-clip bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(current => !current)}
        width={sidebarWidth}
        isMobileViewport={isMobileViewport}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      <div
        className="relative min-h-screen transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:!ml-0"
        style={{ marginLeft: isMobileViewport ? 0 : sidebarWidth }}
      >
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(current => !current)}
          sidebarOffset={sidebarWidth}
          isMobileViewport={isMobileViewport}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(current => !current)}
        />

        <main className="relative pt-24 max-md:pt-4">
          {(phaseNotice || isCurrentRouteHiddenByPhase) && (
            <div className="mx-4 mb-4 rounded-[22px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300 md:mx-6">
              {phaseNotice ?? `${currentNavItem?.label ?? 'This area'} is not part of the primary ${phase.replace(/_/g, ' ')} workflow right now. You can keep working here and navigation will update around you.`}
            </div>
          )}
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}

