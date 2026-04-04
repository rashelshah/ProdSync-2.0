import { useState } from 'react'
import { useAuthStore } from '@/features/auth/auth.store'
import { Surface } from '@/components/shared/Surface'
import { EmptyState } from '@/components/system/SystemStates'
import { cn } from '@/utils'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['EP', 'LineProducer', 'HOD', 'Supervisor', 'Crew', 'Driver', 'DataWrangler']

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  EP: ['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports', 'Settings Admin'],
  LineProducer: ['View All Modules', 'Approve Expenses', 'Manage Crew', 'Access Financials', 'Export Reports'],
  HOD: ['View Department Module', 'Manage Crew', 'Submit Requests'],
  Supervisor: ['View Department Module', 'Manage Execution', 'Coordinate Crew', 'Submit Requests'],
  Crew: ['View Own Data', 'Submit Requests'],
  Driver: ['View Own Trips', 'Upload Fuel Logs'],
  DataWrangler: ['View Camera Data', 'Sync Media Logs', 'Submit Reports'],
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

  return (
    <div className="page-shell page-shell-narrow">
      <header>
        <span className="page-kicker">Configuration</span>
        <h1 className="page-title page-title-compact">Settings</h1>
        <p className="page-subtitle">Backend-backed configuration surfaces will appear here as each feature is wired to Supabase.</p>
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
          {activeSection === 'roles' ? (
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
                    {user?.name.charAt(0) ?? 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{user?.name ?? 'Current user'}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      Current role: {user?.role ?? 'Unassigned'}
                    </p>
                  </div>
                  <div className="ml-auto rounded-full bg-zinc-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Managed by onboarding + project approval
                  </div>
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
                      <span className={cn('text-sm font-medium', hasAccess ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400')}>
                        {permission}
                      </span>
                      <span className={cn('material-symbols-outlined text-[18px]', hasAccess ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-500')}>
                        {hasAccess ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <Surface variant="table" padding="lg">
              <EmptyState
                icon={activeSection === 'general' ? 'tune' : activeSection === 'notifications' ? 'notifications' : activeSection === 'integrations' ? 'extension' : 'movie'}
                title="No live settings data yet"
                description="This section is now ready for backend integration, but demo values have been removed so real Supabase-backed configuration can be added feature by feature."
              />
            </Surface>
          )}
        </div>
      </div>
    </div>
  )
}
