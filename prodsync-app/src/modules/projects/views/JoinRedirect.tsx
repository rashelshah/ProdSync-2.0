import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState, LoadingState } from '@/components/system/SystemStates'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectsStore } from '@/features/projects/projects.store'
import { projectsService, type ProjectPreview } from '@/services/projects.service'
import { resolveErrorMessage, showError, showSuccess, showLoading } from '@/lib/toast'
import { invalidateProjectData } from '@/context/project-sync'
import { getDefaultWorkspacePath } from '@/features/auth/access-rules'
import {
  DEPARTMENT_OPTIONS,
  getRoleOptionsForDepartment,
} from '@/features/auth/onboarding'
import { cn, formatDate } from '@/utils'
import { Users, CheckCircle2, ShieldCheck, Briefcase, Camera, Palette, Truck, Film, Sparkles, Building2, Clapperboard, type LucideIcon } from 'lucide-react'
import type { ProjectDepartment, ProjectRequestedRole, ProjectStage, UserRole } from '@/types'
import { useTheme } from '@/components/theme/ThemeProvider'
import { getThemeVars, surfaceStyle, insetStyle, StageFrame, StepFooter } from '@/features/auth/components/AuthUI'

const statusTone: Record<ProjectStage, string> = {
  'pre-production': 'bg-zinc-100 text-zinc-700 dark:bg-white/8 dark:text-zinc-300',
  shooting: 'bg-orange-100 text-orange-700 dark:bg-orange-500/12 dark:text-orange-400',
  post: 'bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300',
}

const departmentIcons: Record<ProjectDepartment, LucideIcon> = {
  production: Briefcase,
  camera: Camera,
  art: Palette,
  transport: Truck,
  post: Film,
  wardrobe: Sparkles,
}

const roleIcons: Partial<Record<ProjectRequestedRole, LucideIcon>> = {
  'Executive Producer': Building2,
  'Line Producer': Briefcase,
  'Production Manager': Users,
  '1st AD': Clapperboard,
  DOP: Camera,
  '1st AC': Camera,
  'Camera Operator': Clapperboard,
  'Art Director': Palette,
  'Art Assistant': Palette,
  'Transport Captain': Truck,
  Driver: Truck,
  Editor: Film,
  Colorist: Film,
  'Costume Supervisor': Sparkles,
  'Wardrobe Stylist': Sparkles,
  'Crew Member': Clapperboard,
  'Data Wrangler': Film,
}

const sectionTitleStyle = {
  fontSize: 'clamp(1.75rem, 3.6vw, 2.9rem)',
  lineHeight: 0.98,
  fontWeight: 700,
  letterSpacing: '-0.07em',
}

const copyStyle = {
  marginTop: '8px',
  fontSize: '0.94rem',
  lineHeight: 1.66,
  color: 'var(--auth-muted)',
}

const localStyles = `
.authfx-stage{width:100%;max-width:var(--stage-width);padding:12px;border-radius:32px;background:var(--stage-bg);border:1px solid var(--stage-border);box-shadow:var(--stage-shadow);backdrop-filter:blur(20px)}
.authfx-panel{animation:authfx-enter .42s cubic-bezier(.22,1,.36,1) both}
.authfx-grid{display:grid;gap:16px}
.authfx-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:900px){.authfx-grid-3{grid-template-columns:1fr 1fr}}
@media (max-width:680px){.authfx-grid-3{grid-template-columns:1fr}.authfx-stage{padding:12px;border-radius:28px}}
@keyframes authfx-enter{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
`

export function JoinRedirect() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const themeVars = getThemeVars(isDark)
  
  const user = useAuthStore(state => state.user)
  const setActiveProject = useProjectsStore(state => state.setActiveProject)

  const [isLoading, setIsLoading] = useState(true)
  const [projectPreview, setProjectPreview] = useState<ProjectPreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [modalStep, setModalStep] = useState<'department' | 'role'>('department')

  // Default to user's own department if available, otherwise 'production'
  const userDept: ProjectDepartment = (user?.departmentId as ProjectDepartment | undefined) ?? 'production'
  const [joinDepartment, setJoinDepartment] = useState<ProjectDepartment>(userDept)
  const [joinRole, setJoinRole] = useState<ProjectRequestedRole>('Crew Member')

  const roleOptions = useMemo(() => getRoleOptionsForDepartment(joinDepartment), [joinDepartment])
  const selectedDepartment = useMemo(
    () => DEPARTMENT_OPTIONS.find(option => option.id === joinDepartment) ?? DEPARTMENT_OPTIONS[0],
    [joinDepartment],
  )
  const joinRoleOptions = roleOptions.map(option => option.id)

  useEffect(() => {
    if (!user) return

    async function loadPreview() {
      if (!token) {
        setErrorMsg('Invalid invitation link.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const preview = await projectsService.previewProject(token)
        setProjectPreview(preview)
      } catch (err) {
        setErrorMsg(resolveErrorMessage(err, 'Invalid or expired invitation link.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadPreview()
  }, [token, user])

  useEffect(() => {
    // If joinRole options change because of department, reset to first available
    if (joinRoleOptions.length > 0 && !joinRoleOptions.includes(joinRole)) {
      setJoinRole(joinRoleOptions[0])
    }
  }, [joinRoleOptions, joinRole])

  if (!user) return null

  async function performJoin() {
    if (!token) return
    setIsJoining(true)
    showLoading('Submitting request...', { id: 'join-flow' })

    try {
      const response = await projectsService.joinProject(token, joinRole, selectedDepartment.id)
      if (response && response.project) {
        if (response.joinStatus === 'pending') {
          showSuccess('Request sent! Waiting for EP approval.', { id: 'join-flow' })
          navigate('/projects')
        } else {
          showSuccess('Successfully joined project!', { id: 'join-flow' })
          setActiveProject(response.project.id, response.project.currency)
          await invalidateProjectData(queryClient, { userId: user?.id })
          
          // user is non-null here (we guard \`if (!user) return null\` before render)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          navigate(getDefaultWorkspacePath({ ...user!, role: 'Crew' as UserRole }))
        }
      } else {
        // Already a member?
        showSuccess('Opened project.', { id: 'join-flow' })
        navigate('/projects') 
      }
    } catch (err) {
      showError(resolveErrorMessage(err, 'Failed to join the project.'), { id: 'join-flow' })
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return <LoadingState message="Verifying context..." />
  }

  if (errorMsg || !projectPreview) {
    return (
      <div className="page-shell flex min-h-[80vh] items-center justify-center">
        <StageFrame width="450px" panelKey="error">
          <EmptyState
            icon="error"
            title="Invitation Unavailable"
            description={errorMsg || 'The project code or token could not be found.'}
          />
          <div className="mt-8 text-center">
            <button onClick={() => navigate('/projects')} className="btn-primary">
              View Available Projects
            </button>
          </div>
        </StageFrame>
      </div>
    )
  }

  const stepKey = `join-${modalStep}`

  return (
    <div className="page-shell flex min-h-[80vh] items-center justify-center" style={themeVars as any}>
      <style>{localStyles}</style>
      <div className="w-full" style={{ display: 'flex', justifyContent: 'center' }}>
        {showRoleModal ? (
          modalStep === 'department' ? (
            <StageFrame width="810px" panelKey={stepKey}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,106,61,0.12)', color: '#cf4c23', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '14px' }}>Joining Project • Step 1</div>
                <h1 style={sectionTitleStyle}>Choose Your Department</h1>
                <p style={copyStyle}>
                  Select the department you will be working under for <span style={{ color: 'var(--auth-text)', fontWeight: 600 }}>{projectPreview.name}</span>.
                </p>
              </div>

              <div className="authfx-grid authfx-grid-3">
                {DEPARTMENT_OPTIONS.map(option => {
                  const Icon = departmentIcons[option.id]
                  const selected = joinDepartment === option.id
                  return (
                    <button key={option.id} type="button" onClick={() => setJoinDepartment(option.id)} style={{ position: 'relative', borderRadius: '26px', padding: '18px 16px', textAlign: 'left', cursor: 'pointer', transform: selected ? 'translateY(-2px)' : 'none', ...surfaceStyle(isDark), boxShadow: selected ? '0 16px 28px rgba(255,106,61,0.12), var(--card-shadow)' : 'var(--card-shadow)', border: selected ? '1px solid rgba(255,106,61,0.3)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)' }}>
                      <span style={{ width: '48px', height: '48px', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c94d23', marginBottom: '16px', ...surfaceStyle(isDark) }}>
                        <Icon size={21} />
                      </span>
                      <div style={{ fontSize: '0.98rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35, color: 'var(--auth-text)' }}>{option.label}</div>
                      <div style={{ marginTop: '8px', fontSize: '0.86rem', lineHeight: 1.62, color: 'var(--auth-muted)' }}>{option.description}</div>
                      {selected ? <span style={{ position: 'absolute', right: '18px', bottom: '18px', color: '#ff6a3d' }}><CheckCircle2 size={18} /></span> : null}
                    </button>
                  )
                })}
              </div>

              <StepFooter
                isDark={isDark}
                onBack={() => setShowRoleModal(false)}
                backLabel="Back to Preview"
                onNext={() => setModalStep('role')}
                note="This selection controls which role options appear next."
              />
            </StageFrame>
          ) : (
            <StageFrame width="810px" panelKey={stepKey}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,106,61,0.12)', color: '#cf4c23', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '14px' }}>Joining Project • Step 2</div>
                <h1 style={sectionTitleStyle}>Select Your Role</h1>
                <p style={copyStyle}>Only roles mapped to {selectedDepartment.label.toLowerCase()} are shown here.</p>
              </div>

              <div className="authfx-grid authfx-grid-3">
                {roleOptions.map(option => {
                  const Icon = roleIcons[option.id] ?? ShieldCheck
                  const selected = joinRole === option.id
                  return (
                    <button key={option.id} type="button" onClick={() => setJoinRole(option.id)} style={{ position: 'relative', borderRadius: '26px', padding: '18px 16px', textAlign: 'left', cursor: 'pointer', transform: selected ? 'translateY(-2px)' : 'none', ...surfaceStyle(isDark), boxShadow: selected ? '0 16px 28px rgba(255,106,61,0.12), var(--card-shadow)' : 'var(--card-shadow)', border: selected ? '1px solid rgba(255,106,61,0.3)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)' }}>
                      <span style={{ width: '48px', height: '48px', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c94d23', marginBottom: '16px', ...surfaceStyle(isDark) }}>
                        <Icon size={21} />
                      </span>
                      <div style={{ fontSize: '0.98rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35, color: 'var(--auth-text)' }}>{option.label}</div>
                      <div style={{ marginTop: '8px', fontSize: '0.86rem', lineHeight: 1.62, color: 'var(--auth-muted)' }}>{option.description}</div>
                      <div style={{ marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--auth-soft)' }}>Mapped access: {option.accessRole}</div>
                      {selected ? <span style={{ position: 'absolute', right: '18px', bottom: '18px', color: '#ff6a3d' }}><CheckCircle2 size={18} /></span> : null}
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 flex justify-end">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                     <button type="button" onClick={() => setModalStep('department')} className="btn-soft px-8">
                       Back
                     </button>
                     <button type="button" onClick={performJoin} disabled={isJoining} className="btn-primary px-8">
                        {isJoining ? 'Submitting...' : 'Submit Request'}
                     </button>
                  </div>
              </div>
            </StageFrame>
          )
        ) : (
          <StageFrame width="720px" panelKey="preview">
            <div className="text-center py-4">
              <div className={cn('mx-auto inline-flex rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]', statusTone[projectPreview.status])}>
                {projectPreview.status}
              </div>
              <h1 style={{...sectionTitleStyle, marginTop: '24px'}}>{projectPreview.name}</h1>
              <p style={copyStyle}>{projectPreview.location}</p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] px-5 py-4" style={insetStyle()}>
                <div className="flex items-center gap-2 text-[var(--auth-muted)]">
                  <Users className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Active crew</span>
                </div>
                <p className="mt-2 text-xl font-semibold text-[var(--auth-text)]">{projectPreview.activeCrew}</p>
              </div>
              <div className="rounded-[24px] px-5 py-4" style={insetStyle()}>
                <div className="flex items-center gap-2 text-[var(--auth-muted)]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Progress</span>
                </div>
                <p className="mt-2 text-xl font-semibold text-[var(--auth-text)]">{projectPreview.progressPercent}%</p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--auth-muted)]">Timeline</p>
              <p className="mt-2 text-sm font-medium text-[var(--auth-text)]">
                {formatDate(projectPreview.startDate)} - {formatDate(projectPreview.endDate)}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
               {projectPreview.enabledDepartments.map(department => (
                <span key={department} className="rounded-full px-3 py-1.5 text-xs font-medium" style={insetStyle()}>{department}</span>
              ))}
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={() => navigate('/projects')} className="btn-soft flex-1 py-3 text-base">
                Cancel
              </button>
              <button onClick={() => setShowRoleModal(true)} className="btn-primary flex-[2] py-3 text-base shadow-lg shadow-orange-500/20">
                Join Project
              </button>
            </div>
          </StageFrame>
        )}
      </div>
    </div>
  )
}
