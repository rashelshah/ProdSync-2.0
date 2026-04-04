import { useState } from 'react'
import { useAuthStore } from '@/features/auth/auth.store'
import { Surface } from '@/components/shared/Surface'
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
    <div className="page-shell page-shell-narrow">
      <header>
        <span className="page-kicker">Configuration</span>
        <h1 className="page-title page-title-compact">Settings</h1>
        <p className="page-subtitle">Configuration, access control, notifications, and integrations with the same open white, black, and orange system.</p>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <nav className="col-span-12 lg:col-span-3">
          <div className="space-y-2">
            {SETTINGS_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white',
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="col-span-12 lg:col-span-9">
          {activeSection === 'general' && (
            <div className="space-y-8">
              <div>
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Production</p>
                    <h2 className="section-title">Production Settings</h2>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    { label: 'Production Name', value: 'Project Noir - Unit A' },
                    { label: 'Shoot Days (Total)', value: '68' },
                    { label: 'Current Day', value: '42' },
                    { label: 'Base Location', value: 'Chennai, Tamil Nadu' },
                    { label: 'Currency', value: 'USD + INR' },
                  ].map(field => (
                    <div key={field.label} className="flex items-center justify-between rounded-[24px] bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{field.label}</label>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{field.value}</span>
                        <button className="btn-ghost px-0 py-0 text-[10px]">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Surface variant="table" padding="lg">
                <div className="mb-6">
                  <p className="section-title">Alert Thresholds</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Thresholds remain unchanged, but are grouped for easier scanning.</p>
                </div>
                <div className="space-y-5">
                  {[
                    { label: 'Fuel Mismatch Alert Trigger', value: '15%', desc: 'Alert when actual mileage deviates by this percentage' },
                    { label: 'OT Trigger Threshold', value: '10 hrs', desc: 'Shift hours before overtime alert fires' },
                    { label: 'Budget Warning Level', value: '85%', desc: 'Department budget percentage before warning' },
                    { label: 'Budget Critical Level', value: '100%', desc: 'Department budget percentage for critical alert' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 last:border-b-0 last:pb-0 dark:border-zinc-800">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.label}</p>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white">{item.value}</div>
                        <button className="btn-ghost px-0 py-0 text-[10px]">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>
            </div>
          )}

          {activeSection === 'roles' && (
            <div className="space-y-8">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Access</p>
                  <h2 className="section-title">Role-Based Access Control</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => setPreviewRole(role)}
                      className={cn(
                        'rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors',
                        previewRole === role
                          ? 'bg-orange-500 text-black'
                          : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white',
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] bg-zinc-50 p-5 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
                    {user?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{user?.name}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Current Role: {user?.role}</p>
                  </div>
                  <button onClick={() => switchRole(previewRole)} className="btn-primary ml-auto">
                    Switch to {previewRole}
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {(['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports', 'Settings Admin', 'View Department Module', 'Submit Requests', 'View Own Data', 'View Own Trips', 'Upload Fuel Logs'] as const).map(permission => {
                  const hasAccess = ROLE_PERMISSIONS[previewRole].includes(permission)
                  return (
                    <div
                      key={permission}
                      className={cn(
                        'flex items-center justify-between rounded-[24px] px-5 py-4',
                        hasAccess ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-zinc-50 dark:bg-zinc-900',
                      )}
                    >
                      <span className={cn('text-sm font-medium', hasAccess ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400')}>{permission}</span>
                      <span className={cn('material-symbols-outlined text-[18px]', hasAccess ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-500')}>
                        {hasAccess ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Notification Preferences</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Notification rows are grouped with more white space and stronger labels.</p>
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Critical Alerts', desc: 'Fuel anomaly, OT spike, budget overrun', enabled: true },
                  { label: 'Approval Requests', desc: 'New requests requiring your action', enabled: true },
                  { label: 'Crew Updates', desc: 'Attendance and check-in events', enabled: false },
                  { label: 'Daily Summary', desc: 'End-of-day production digest', enabled: true },
                  { label: 'Fleet Exceptions', desc: 'Geo-fence violations and idle warnings', enabled: false },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between border-b border-zinc-200 pb-5 last:border-b-0 last:pb-0 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.label}</p>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                    </div>
                    <div className={cn('flex h-6 w-12 items-center rounded-full px-1', item.enabled ? 'justify-end bg-orange-500' : 'justify-start bg-zinc-200 dark:bg-zinc-800')}>
                      <div className={cn('h-4 w-4 rounded-full', item.enabled ? 'bg-black' : 'bg-zinc-500')} />
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          )}

          {activeSection === 'integrations' && (
            <div>
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Connections</p>
                  <h2 className="section-title">Integrations</h2>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {[
                  { name: 'Supabase', desc: 'Database, auth and real-time', status: 'connected', icon: 'database' },
                  { name: 'Google Maps API', desc: 'Fleet GPS tracking', status: 'pending', icon: 'map' },
                  { name: 'Razorpay', desc: 'Wage and batta disbursement', status: 'pending', icon: 'payments' },
                  { name: 'Twilio SMS', desc: 'Crew alerts and OTP', status: 'disconnected', icon: 'sms' },
                ].map(item => (
                  <div key={item.name} className="flex items-center gap-4 rounded-[26px] bg-zinc-50 p-5 dark:bg-zinc-900">
                    <span className="material-symbols-outlined text-2xl text-zinc-500 dark:text-zinc-400">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.name}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                    </div>
                    <span className={cn(
                      'rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]',
                      item.status === 'connected'
                        ? 'bg-orange-500 text-black'
                        : item.status === 'pending'
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                    )}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'production' && (
            <Surface variant="table" padding="lg">
              <div className="mb-6">
                <p className="section-title">Production Configuration</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Shift timing, overtime multipliers, and budget caps grouped into one compact settings card.</p>
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Standard Shift Duration', value: '10 hours' },
                  { label: 'OT Multiplier', value: '1.5x' },
                  { label: 'Daily Batta Budget (Base)', value: '$3,500' },
                  { label: 'Fuel Allowance per KM', value: '$0.12' },
                  { label: 'Outstation Threshold', value: '80 km from base' },
                  { label: 'Night Shift Premium', value: '25%' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between border-b border-zinc-200 pb-5 last:border-b-0 last:pb-0 dark:border-zinc-800">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </div>
      </div>
    </div>
  )
}
