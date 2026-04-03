import { useState } from 'react'
import { useAuthStore, Permissions } from '@/features/auth/auth.store'
import { cn } from '@/utils'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['EP', 'LineProducer', 'HOD', 'Crew', 'Driver']

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  EP: ['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports', 'Settings Admin'],
  LineProducer: ['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports'],
  HOD: ['View Department Module', 'Manage Crew', 'Submit Requests'],
  Crew: ['View Own Data', 'Submit Requests'],
  Driver: ['View Own Trips', 'Upload Fuel Logs'],
}

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General', icon: 'tune' },
  { id: 'roles', label: 'Roles & Permissions', icon: 'admin_panel_settings' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'integrations', label: 'Integrations', icon: 'extension' },
  { id: 'production', label: 'Production Config', icon: 'movie' },
]

export function SettingsView() {
  const [activeSection, setActiveSection] = useState('general')
  const [previewRole, setPreviewRole] = useState<UserRole>('EP')
  const user = useAuthStore(s => s.user)
  const switchRole = useAuthStore(s => s.switchRole)

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1 uppercase tracking-wide">Configuration · Roles · Notifications · Integrations</p>
      </header>

      <div className="grid grid-cols-12 gap-5">
        {/* Sidebar nav */}
        <nav className="col-span-12 lg:col-span-3 space-y-1">
          {SETTINGS_SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm',
                activeSection === s.id
                  ? 'bg-white text-black'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              )}
            >
              <span className={cn('material-symbols-outlined text-[18px]', activeSection === s.id ? 'text-black' : '')}>
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="col-span-12 lg:col-span-9 space-y-5">

          {activeSection === 'general' && (
            <>
              <div className="bg-[#131313] border border-white/5 p-6 rounded-sm space-y-6">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Production Settings</h2>
                {[
                  { label: 'Production Name', value: 'Project Noir — Unit A' },
                  { label: 'Shoot Days (Total)', value: '68' },
                  { label: 'Current Day', value: '42' },
                  { label: 'Base Location', value: 'Chennai, Tamil Nadu' },
                  { label: 'Currency', value: 'USD + INR' },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">{f.label}</label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{f.value}</span>
                      <button className="text-[10px] text-white/30 hover:text-white uppercase tracking-widest font-bold transition-colors">Edit</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#131313] border border-white/5 p-6 rounded-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-6">Alert Thresholds</h2>
                <div className="space-y-5">
                  {[
                    { label: 'Fuel Mismatch Alert Trigger', value: '15%', desc: 'Alert when actual mileage deviates by this %' },
                    { label: 'OT Trigger Threshold', value: '10 hrs', desc: 'Shift hours before OT alert fires' },
                    { label: 'Budget Warning Level', value: '85%', desc: 'Dept budget % before warning is raised' },
                    { label: 'Budget Critical Level', value: '100%', desc: 'Dept budget % for critical alert' },
                  ].map(t => (
                    <div key={t.label} className="flex items-start justify-between gap-4 border-b border-white/5 pb-5 last:border-0 last:pb-0">
                      <div>
                        <p className="text-xs font-bold text-white">{t.label}</p>
                        <p className="text-[10px] text-white/30 mt-1">{t.desc}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="bg-[#0e0e0e] border border-white/10 px-3 py-1.5 text-xs font-mono font-bold text-white min-w-[72px] text-center">
                          {t.value}
                        </div>
                        <button className="text-[10px] text-white/30 hover:text-white uppercase tracking-widest font-bold">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSection === 'roles' && (
            <div className="bg-[#131313] border border-white/5 p-6 rounded-sm space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Role-Based Access Control</h2>
                  <p className="text-[11px] text-white/30 mt-1">Preview permissions per role. Use the role switcher in the header to test live.</p>
                </div>
                <div className="flex gap-1">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => setPreviewRole(r)}
                      className={cn(
                        'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors rounded-sm',
                        previewRole === r ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current user */}
              <div className="bg-[#0e0e0e] border border-white/10 p-4 rounded-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-white/10 flex items-center justify-center text-sm font-black text-white">
                  {user?.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{user?.name}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Current Role: {user?.role}</p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => switchRole(previewRole)}
                    className="text-[10px] font-black uppercase tracking-widest bg-white text-black px-4 py-2 hover:bg-white/90 transition-colors"
                  >
                    Switch to {previewRole}
                  </button>
                </div>
              </div>

              {/* Permission table */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Permissions for <span className="text-white">{previewRole}</span></p>
                <div className="space-y-2">
                  {(['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports', 'Settings Admin', 'View Department Module', 'Submit Requests', 'View Own Data', 'View Own Trips', 'Upload Fuel Logs'] as const).map(perm => {
                    const hasAccess = ROLE_PERMISSIONS[previewRole].includes(perm)
                    return (
                      <div key={perm} className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-sm border',
                        hasAccess ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-white/2 border-white/5'
                      )}>
                        <span className={cn('text-xs font-medium', hasAccess ? 'text-white' : 'text-white/20')}>{perm}</span>
                        <span className={cn('material-symbols-outlined text-base', hasAccess ? 'text-emerald-400' : 'text-white/10')}>
                          {hasAccess ? 'check_circle' : 'cancel'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-[#131313] border border-white/5 p-6 rounded-sm space-y-6">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Notification Preferences</h2>
              {[
                { label: 'Critical Alerts', desc: 'Fuel anomaly, OT spike, budget overrun', enabled: true },
                { label: 'Approval Requests', desc: 'New requests requiring your action', enabled: true },
                { label: 'Crew Updates', desc: 'Attendance, check-in/out events', enabled: false },
                { label: 'Daily Summary', desc: 'End-of-day production digest', enabled: true },
                { label: 'Fleet Exceptions', desc: 'Geo-fence violations, idle warnings', enabled: false },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between border-b border-white/5 pb-5 last:border-0 last:pb-0">
                  <div>
                    <p className="text-xs font-bold text-white">{n.label}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{n.desc}</p>
                  </div>
                  <div className={cn(
                    'w-10 h-5 rounded-full flex items-center px-0.5 transition-colors cursor-pointer',
                    n.enabled ? 'bg-white justify-end' : 'bg-white/10 justify-start'
                  )}>
                    <div className={cn('w-4 h-4 rounded-full', n.enabled ? 'bg-black' : 'bg-white/30')} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'integrations' && (
            <div className="bg-[#131313] border border-white/5 p-6 rounded-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-6">Integrations</h2>
              {[
                { name: 'Supabase', desc: 'Database, Auth & Real-time', status: 'connected', icon: 'database' },
                { name: 'Google Maps API', desc: 'Fleet GPS tracking', status: 'pending', icon: 'map' },
                { name: 'Razorpay', desc: 'Wage & batta disbursement', status: 'pending', icon: 'payments' },
                { name: 'Twilio SMS', desc: 'Crew alerts & OTP', status: 'disconnected', icon: 'sms' },
              ].map(i => (
                <div key={i.name} className="flex items-center gap-4 border border-white/5 p-4 rounded-sm">
                  <span className="material-symbols-outlined text-white/30 text-2xl">{i.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{i.name}</p>
                    <p className="text-[11px] text-white/30">{i.desc}</p>
                  </div>
                  <span className={cn(
                    'text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full',
                    i.status === 'connected' ? 'bg-emerald-900/40 text-emerald-400' :
                    i.status === 'pending' ? 'bg-amber-900/30 text-amber-400' : 'bg-white/5 text-white/20'
                  )}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'production' && (
            <div className="bg-[#131313] border border-white/5 p-6 rounded-sm space-y-5">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Production Configuration</h2>
              <p className="text-xs text-white/30">Configure shift timings, OT multipliers, batta rates and department budget caps.</p>
              {[
                { label: 'Standard Shift Duration', value: '10 hours' },
                { label: 'OT Multiplier', value: '1.5×' },
                { label: 'Daily Batta Budget (Base)', value: '$3,500' },
                { label: 'Fuel Allowance per KM', value: '$0.12' },
                { label: 'Outstation Threshold', value: '80 km from base' },
                { label: 'Night Shift Premium', value: '25%' },
              ].map(f => (
                <div key={f.label} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{f.label}</span>
                  <span className="text-sm font-bold text-white">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
