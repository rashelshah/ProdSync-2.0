import { useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const SIDEBAR_EXPANDED_WIDTH = 268
const SIDEBAR_MOBILE_EXPANDED_WIDTH = 280
const SIDEBAR_COLLAPSED_WIDTH = 92

export function AppLayout({ children }: { children?: ReactNode }) {
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
    <div className="relative min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
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
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
