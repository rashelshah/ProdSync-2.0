import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAlertStore } from '@/features/alerts/alert.store'
import { getUserRoleLabel } from '@/features/auth/onboarding'
import { useAuthStore } from '@/features/auth/auth.store'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn, timeAgo } from '@/utils'

interface HeaderProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  sidebarOffset: number
}

export function Header({ isSidebarCollapsed, onToggleSidebar, sidebarOffset }: HeaderProps) {
  const navigate = useNavigate()
  const alerts = useAlertStore(s => s.alerts)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const acknowledgeAll = useAlertStore(s => s.acknowledgeAll)
  const user = useAuthStore(s => s.user)
  const { theme, toggleTheme } = useTheme()
  const [showAlerts, setShowAlerts] = useState(false)

  const recentAlerts = alerts.slice(0, 5)
  const userRoleLabel = user ? getUserRoleLabel(user) : 'Crew Member'

  return (
    <header
      className="fixed right-0 top-0 z-30 bg-transparent px-6 py-5 transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:px-8"
      style={{ left: sidebarOffset }}
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isSidebarCollapsed ? 'right_panel_open' : 'left_panel_close'}
            </span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
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
            className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-black transition-colors hover:bg-orange-600"
            aria-label="Create or join project"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="material-symbols-outlined text-[18px]">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowAlerts(value => !value)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showAlerts && (
              <div className="absolute right-0 top-full mt-3 w-[25rem] rounded-[28px] border border-zinc-200 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Alerts</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">Latest production issues</p>
                  </div>
                  <button onClick={acknowledgeAll} className="btn-ghost px-0 py-0 text-[10px]">
                    Clear all
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

          <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-2 py-2 pl-3 pr-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{userRoleLabel}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
              {user?.name.charAt(0) ?? 'U'}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
