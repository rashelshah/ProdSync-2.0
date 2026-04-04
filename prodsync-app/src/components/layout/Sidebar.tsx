import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/utils'
import { useAuthStore } from '@/features/auth/auth.store'
import { useAlertStore } from '@/features/alerts/alert.store'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { path: '/transport', label: 'Transport & Logistics', icon: 'local_shipping' },
  { path: '/camera', label: 'Camera & Assets', icon: 'photo_camera' },
  { path: '/crew', label: 'Crew & Wages', icon: 'groups' },
  { path: '/expenses', label: 'Art & Expenses', icon: 'palette' },
  { path: '/wardrobe', label: 'Wardrobe & Makeup', icon: 'checkroom' },
  { path: '/approvals', label: 'Approvals', icon: 'verified_user' },
  { path: '/reports', label: 'Reports', icon: 'analytics' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  width: number
}

export function Sidebar({ isCollapsed, onToggle, width }: SidebarProps) {
  const user = useAuthStore(s => s.user)
  const alerts = useAlertStore(s => s.alerts)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
  const location = useLocation()

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 border-r border-zinc-200 bg-white/90 backdrop-blur-md transition-[width] duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950/90"
      style={{ width }}
    >
      <div className={cn('flex h-full flex-col py-6', isCollapsed ? 'px-3' : 'px-5')}>
        <div className={cn('flex items-center gap-3', isCollapsed ? 'justify-center' : 'justify-between')}>
          <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-lg font-bold text-black">
              P
            </div>
            {!isCollapsed && (
              <div>
                <div className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Production Suite
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={onToggle}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              aria-label="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
            </button>
          )}
        </div>

        <div className="mt-10 flex-1">
          {!isCollapsed && (
            <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              Navigation
            </p>
          )}

          <nav className="space-y-1">
            {NAV_ITEMS.map(item => {
              const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
              const hasAlert =
                (item.path === '/transport' || item.path === '/crew' || item.path === '/approvals') &&
                criticalAlerts.some(a => {
                  if (item.path === '/transport' && a.source === 'transport') return true
                  if (item.path === '/crew' && a.source === 'crew') return true
                  if (item.path === '/approvals' && a.source === 'approvals') return true
                  return false
                })

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isCollapsed ? item.label : undefined}
                  className={() =>
                    cn(
                      'group relative flex items-center rounded-2xl text-sm font-medium transition-all',
                      isCollapsed ? 'justify-center px-0 py-3.5' : 'gap-3 px-3 py-3',
                      isActive
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/12 dark:text-orange-400'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white',
                    )
                  }
                >
                  <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                  {hasAlert && (
                    <span className={cn('h-2 w-2 rounded-full bg-orange-500', isCollapsed ? 'absolute right-2 top-2' : '')} />
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className={cn('border-t border-zinc-200 pt-5 dark:border-zinc-800', isCollapsed ? 'mt-4' : 'mt-6')}>
          <div className={cn('flex items-center gap-3', isCollapsed ? 'flex-col' : '')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
              {user?.name.charAt(0) ?? 'U'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{user?.name}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{user?.role}</p>
              </div>
            )}
            <button
              className="material-symbols-outlined rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              title={isCollapsed ? 'Logout' : undefined}
            >
              logout
            </button>
          </div>

          {isCollapsed && (
            <button
              onClick={onToggle}
              className="mt-4 flex w-full items-center justify-center rounded-full border border-zinc-200 px-3 py-2.5 text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
              aria-label="Expand sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">right_panel_open</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
