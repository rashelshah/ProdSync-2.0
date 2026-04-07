import { useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const SIDEBAR_EXPANDED_WIDTH = 268
const SIDEBAR_COLLAPSED_WIDTH = 92

export function AppLayout({ children }: { children?: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('prodsync.sidebar.collapsed') === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem('prodsync.sidebar.collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const sidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH

  return (
    <div className="relative min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(current => !current)}
        width={sidebarWidth}
      />

      <div
        className="relative min-h-screen transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:!ml-0"
        style={{ marginLeft: sidebarWidth }}
      >
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(current => !current)}
          sidebarOffset={sidebarWidth}
        />

        <main className="relative pt-24 max-md:pt-4">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
