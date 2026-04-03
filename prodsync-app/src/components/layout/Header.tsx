import { useState } from 'react'
import { useAlertStore } from '@/features/alerts/alert.store'
import { useAuthStore } from '@/features/auth/auth.store'
import { cn, timeAgo } from '@/utils'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['EP', 'LineProducer', 'HOD', 'Crew', 'Driver']

export function Header() {
  const alerts = useAlertStore(s => s.alerts)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const acknowledgeAll = useAlertStore(s => s.acknowledgeAll)
  const user = useAuthStore(s => s.user)
  const switchRole = useAuthStore(s => s.switchRole)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showRoles, setShowRoles] = useState(false)

  const recentAlerts = alerts.slice(0, 5)

  return (
    <header className="fixed top-0 left-64 right-0 z-30 h-16 bg-[#131313]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center bg-[#0e0e0e] border border-white/5 px-3 py-1.5 rounded-sm gap-2 w-72">
        <span className="material-symbols-outlined text-sm text-white/30">search</span>
        <input
          type="text"
          placeholder="Search production assets..."
          className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-white/20"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Alert Bell */}
        <div className="relative">
          <button
            onClick={() => { setShowAlerts(v => !v); setShowRoles(false) }}
            className="relative p-2 rounded-sm hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-white/70 hover:text-white text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-[#1c1b1b] border border-white/10 rounded-sm shadow-2xl z-50">
              <div className="flex justify-between items-center px-4 py-3 border-b border-white/5">
                <span className="text-xs font-black uppercase tracking-widest text-white">Alerts</span>
                <button onClick={acknowledgeAll} className="text-[10px] text-white/30 hover:text-white font-bold uppercase tracking-widest">
                  Clear All
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recentAlerts.length === 0 ? (
                  <p className="text-xs text-white/20 text-center py-6">No alerts</p>
                ) : recentAlerts.map(alert => (
                  <div key={alert.id} className={cn(
                    'px-4 py-3 border-b border-white/5 flex gap-3',
                    !alert.acknowledged && 'bg-white/2'
                  )}>
                    <span className={cn(
                      'material-symbols-outlined text-sm shrink-0',
                      alert.severity === 'critical' ? 'text-red-400' :
                      alert.severity === 'warning' ? 'text-amber-400' : 'text-sky-400'
                    )}>
                      {alert.severity === 'critical' ? 'error' : 'warning'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{alert.title}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{timeAgo(alert.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role Switcher (Demo) */}
        <div className="relative">
          <button
            onClick={() => { setShowRoles(v => !v); setShowAlerts(false) }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-colors"
          >
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{user?.role}</span>
            <span className="material-symbols-outlined text-[14px] text-white/50">expand_more</span>
          </button>
          {showRoles && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-[#1c1b1b] border border-white/10 rounded-sm shadow-2xl z-50">
              {ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => { switchRole(role); setShowRoles(false) }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors',
                    user?.role === role ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-sm bg-white/20 flex items-center justify-center text-xs font-black text-white">
          {user?.name.charAt(0) ?? 'U'}
        </div>
      </div>
    </header>
  )
}
