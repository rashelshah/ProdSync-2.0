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

export function Sidebar() {
  const user = useAuthStore(s => s.user)
  const alerts = useAlertStore(s => s.alerts)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
  const location = useLocation()

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/5 bg-[#0e0e0e] flex flex-col pt-0 pb-6 px-4 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-2 border-b border-white/5 shrink-0">
        <div>
          <div className="text-lg font-black text-white tracking-tighter uppercase">ProdSync</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/30">Production Alpha</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 py-4 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)
          const hasAlert = (item.path === '/transport' || item.path === '/crew' || item.path === '/approvals')
            && criticalAlerts.some(a => {
              if (item.path === '/transport' && a.source === 'transport') return true
              if (item.path === '/crew' && a.source === 'crew') return true
              if (item.path === '/approvals' && a.source === 'approvals') return true
              return false
            })

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={() => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sm font-medium text-xs uppercase tracking-widest transition-all duration-150 relative',
                isActive
                  ? 'bg-white text-[#131313]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              <span className={cn('material-symbols-outlined text-[18px]', isActive && 'text-[#131313]')}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {hasAlert && !isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/5 pt-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center text-xs font-black text-white">
            {user?.name.charAt(0) ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">{user?.role}</p>
          </div>
          <button className="material-symbols-outlined text-white/30 hover:text-white text-[18px] transition-colors">
            logout
          </button>
        </div>
      </div>
    </aside>
  )
}
