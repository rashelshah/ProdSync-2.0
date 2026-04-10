import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjectAlerts } from '@/features/alerts/useProjectAlerts'
import { getUserRoleLabel } from '@/features/auth/onboarding'
import { useAuthStore } from '@/features/auth/auth.store'
import { useTheme } from '@/components/theme/ThemeProvider'
import { showSuccess } from '@/lib/toast'
import { cn, timeAgo } from '@/utils'

interface HeaderProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  sidebarOffset: number
  isMobileViewport: boolean
  onToggleMobileSidebar?: () => void
}

export function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  sidebarOffset,
  isMobileViewport,
  onToggleMobileSidebar,
}: HeaderProps) {
  const navigate = useNavigate()
  const { alerts, unreadCount, acknowledgeAll, isAcknowledgingAll } = useProjectAlerts()
  const user = useAuthStore(s => s.user)
  const { theme, toggleTheme } = useTheme()
  const logout = useAuthStore(s => s.logout)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!isMobileViewport) {
      setIsVisible(true)
      return
    }

    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          // Require at least 5px scroll to trigger change to avoid flickering
          if (Math.abs(currentScrollY - lastScrollY) > 5) {
            if (currentScrollY > lastScrollY && currentScrollY > 40) {
              setIsVisible(false) // scrolling down
            } else if (currentScrollY < lastScrollY) {
              setIsVisible(true) // scrolling up
            }
          }
          // Always show near top
          if (currentScrollY <= 40) {
            setIsVisible(true)
          }
          lastScrollY = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobileViewport])

  const recentAlerts = alerts.slice(0, 5)
  const userRoleLabel = user ? getUserRoleLabel(user) : 'Crew Member'

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 border-b border-zinc-200/80 bg-white/85 px-6 py-5 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-zinc-800/80 dark:bg-zinc-950/85 lg:px-8 max-md:border-b-0 max-md:border-transparent max-md:bg-transparent max-md:px-4 max-md:py-4 max-md:backdrop-blur-none max-md:pointer-events-none max-md:dark:bg-transparent",
        !isVisible && isMobileViewport ? "max-md:-translate-y-[120%] max-md:opacity-0" : "max-md:translate-y-0 max-md:opacity-100"
      )}
      style={{ left: isMobileViewport ? 0 : sidebarOffset }}
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Mobile Hamburger Menu */}
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors pointer-events-auto active:scale-95 duration-200"
            aria-label="Toggle mobile menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          
          <button
            onClick={onToggleSidebar}
            className="max-md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 pointer-events-auto"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isSidebarCollapsed ? 'right_panel_open' : 'left_panel_close'}
            </span>
          </button>

          <div className="max-md:hidden flex min-w-0 flex-1 items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 pointer-events-auto">
            <span className="material-symbols-outlined text-[18px] text-zinc-400 dark:text-zinc-500">search</span>
            <input
              type="text"
              placeholder="Search production assets..."
              className="w-full min-w-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="max-md:hidden flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-black transition-colors hover:bg-orange-600 pointer-events-auto"
            aria-label="Create or join project"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={toggleTheme}
            className="max-md:hidden flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 pointer-events-auto"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="material-symbols-outlined text-[18px]">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
          </button>

          <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowAlerts(value => !value)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 max-md:border-white/60 max-md:bg-white/88 max-md:shadow-[0_12px_24px_rgba(15,23,42,0.08)] max-md:backdrop-blur-xl max-md:dark:border-white/10 max-md:dark:bg-zinc-900/78"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showAlerts && (
              <div className="absolute right-0 top-full mt-3 w-[25rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[28px] border border-zinc-200 bg-white/96 p-3 shadow-soft backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/96 max-md:right-0 max-md:w-[min(22rem,calc(100vw-1.5rem))]">
                <div className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Alerts</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">Latest production issues</p>
                  </div>
                  <button onClick={acknowledgeAll} disabled={recentAlerts.length === 0 || isAcknowledgingAll} className="btn-ghost px-0 py-0 text-[10px] disabled:opacity-50">
                    {isAcknowledgingAll ? 'Clearing...' : 'Clear all'}
                  </button>
                </div>

                <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                  {recentAlerts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No alerts</p>
                  ) : (
                    recentAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={cn(
                          'rounded-[22px] border px-4 py-3',
                          alert.severity === 'critical'
                            ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'
                            : alert.severity === 'warning'
                              ? 'border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10'
                              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950',
                          alert.acknowledged && 'opacity-50',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'material-symbols-outlined mt-0.5 text-[18px]',
                              alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-orange-500' : 'text-zinc-500 dark:text-zinc-400',
                            )}
                          >
                            {alert.severity === 'critical' ? 'error' : 'warning'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{alert.title}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{timeAgo(alert.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setShowProfileMenu(prev => !prev)} className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-2 py-2 pl-3 pr-2.5 dark:border-zinc-800 dark:bg-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 max-md:border-white/60 max-md:bg-white/88 max-md:p-1.5 max-md:pl-1.5 max-md:pr-1.5 max-md:shadow-[0_12px_24px_rgba(15,23,42,0.08)] max-md:dark:border-white/10 max-md:dark:bg-zinc-900/78 pointer-events-auto outline-none">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{userRoleLabel}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-black/5 dark:shadow-black/20">
                {user?.name.charAt(0) ?? 'U'}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full z-50 mt-3 w-48 max-w-[calc(100vw-1.5rem)] rounded-[24px] border border-zinc-200 bg-white/96 p-2 shadow-soft backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/96 pointer-events-auto flex flex-col gap-1">
                 <button onClick={() => { toggleTheme(); setShowProfileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[16px] text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50 transition-colors text-left">
                    <span className="material-symbols-outlined text-[18px]">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
                    {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                 </button>
                 <button onClick={() => { navigate('/projects'); setShowProfileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[16px] text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50 transition-colors text-left hidden max-md:flex">
                    <Plus className="h-4 w-4" />
                    Projects
                 </button>
                 <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1 mx-2" />
                 <button onClick={async () => { await logout(); showSuccess('Signed out successfully.', { id: 'auth-logout' }); navigate('/auth'); setShowProfileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[16px] text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors text-left">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
