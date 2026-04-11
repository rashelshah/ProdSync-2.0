import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Globe,
  KeyRound,
  Mail,
  Moon,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  User as UserIcon,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { getDefaultAuthorizedPath } from '@/features/auth/access-rules'
import { useAuthStore } from '@/features/auth/auth.store'
import {
  DEPARTMENT_OPTIONS,
  getDefaultProjectRoleForDepartment,
  getPermissionCopy,
  getRoleOptionsForDepartment,
  mapProjectRoleToUserRole,
} from '@/features/auth/onboarding'
import { showError, showInfo, showLoading, showSuccess } from '@/lib/toast'
import type { ProjectDepartment, ProjectRequestedRole, User } from '@/types'

import {
  getThemeVars,
  surfaceStyle,
  insetStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  StageFrame,
  Field,
  PasswordField,
} from '@/features/auth/components/AuthUI'

type AuthMode = 'signin' | 'signup'
type SignupStep = 'identity' | 'confirmation'

interface PasswordChecks {
  minLength: boolean
  uppercase: boolean
  number: boolean
  special: boolean
}

// For regular email signup we only show 2 step-dots (identity + confirmation)
const regularStageSteps: SignupStep[] = ['identity', 'confirmation']
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const localStyles = `
.authfx-root{position:relative;min-height:100vh;overflow:hidden;background:var(--auth-bg);color:var(--auth-text)}
.authfx-shell{position:relative;z-index:1;min-height:100vh;max-width:1120px;margin:0 auto;padding:24px 18px 32px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.authfx-stage{width:100%;max-width:var(--stage-width);padding:12px;border-radius:32px;background:var(--stage-bg);border:1px solid var(--stage-border);box-shadow:var(--stage-shadow);backdrop-filter:blur(20px)}
.authfx-panel{animation:authfx-enter .42s cubic-bezier(.22,1,.36,1) both}
.authfx-grid{display:grid;gap:16px}
.authfx-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.authfx-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.authfx-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.authfx-meter{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.authfx-meter span{height:8px;border-radius:999px;background:rgba(160,160,170,.24);transition:background .24s ease,transform .24s ease}
.authfx-meter span.is-on{background:linear-gradient(90deg,#ff8a5f 0%,#ff6a3d 100%);transform:scaleY(1.08)}
.authfx-shell:before,.authfx-shell:after{content:'';position:absolute;border-radius:999px;filter:blur(72px);pointer-events:none}
.authfx-shell:before{left:7%;top:10%;width:300px;height:300px;background:rgba(255,106,61,.16)}
.authfx-shell:after{right:8%;bottom:10%;width:340px;height:340px;background:rgba(118,164,255,.14)}
@media (max-width:900px){.authfx-grid-3{grid-template-columns:1fr 1fr}.authfx-summary{grid-template-columns:1fr}}
@media (max-width:680px){.authfx-shell{padding-top:88px}.authfx-grid-3,.authfx-grid-2{grid-template-columns:1fr}.authfx-stage{padding:12px;border-radius:28px}}
@keyframes authfx-enter{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
`

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
}

function getPasswordStrength(password: string) {
  const checks = getPasswordChecks(password)
  const score = Object.values(checks).filter(Boolean).length
  if (score <= 1) return { score, label: 'Weak' }
  if (score === 2) return { score, label: 'Fair' }
  if (score === 3) return { score, label: 'Good' }
  return { score, label: 'Strong' }
}

export function AuthPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const themeVars = getThemeVars(isDark)

  const signInWithEmail = useAuthStore(state => state.signInWithEmail)
  const signInWithGoogle = useAuthStore(state => state.signInWithGoogle)
  const completeGoogleOnboarding = useAuthStore(state => state.completeGoogleOnboarding)
  const registerAccount = useAuthStore(state => state.registerAccount)
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)
  const needsOnboarding = useAuthStore(state => state.needsOnboarding)

  const [mode, setMode] = useState<AuthMode>('signin')
  const [signupStep, setSignupStep] = useState<SignupStep>('identity')
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [departmentId, setDepartmentId] = useState<ProjectDepartment>('production')
  const [projectRoleTitle, setProjectRoleTitle] = useState<ProjectRequestedRole>(getDefaultProjectRoleForDepartment('production'))
  const [signInPasswordVisible, setSignInPasswordVisible] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [createdUser, setCreatedUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [authAction, setAuthAction] = useState<'signin' | 'google' | 'signup' | 'workspace' | null>(null)
  const isGoogleOnboarding = Boolean(isAuthenticated && user && needsOnboarding)

  useEffect(() => {
    if (isAuthenticated && user && sessionExpiresAt && sessionExpiresAt > Date.now() && !needsOnboarding) {
      navigate(getDefaultAuthorizedPath(user), { replace: true })
    }
  }, [isAuthenticated, navigate, needsOnboarding, sessionExpiresAt, user])

  useEffect(() => {
    if (!isGoogleOnboarding || !user) {
      return
    }

    setMode('signup')
    setSignupStep('identity')
    setFullName(current => current || user.name)
    setEmail(current => current || user.email || '')
    setDepartmentId(user.departmentId ?? 'production')
    setProjectRoleTitle(user.projectRoleTitle ?? getDefaultProjectRoleForDepartment(user.departmentId ?? 'production'))
    setInfo('Your Google account is connected. Finish department and role setup to continue.')
  }, [isGoogleOnboarding, user])

  const roleOptions = useMemo(() => getRoleOptionsForDepartment(departmentId), [departmentId])
  const selectedDepartment = useMemo(
    () => DEPARTMENT_OPTIONS.find(option => option.id === departmentId) ?? DEPARTMENT_OPTIONS[0],
    [departmentId],
  )
  const selectedRole = useMemo(
    () => roleOptions.find(option => option.id === projectRoleTitle) ?? roleOptions[0],
    [projectRoleTitle, roleOptions],
  )
  const accessRole = useMemo(() => mapProjectRoleToUserRole(selectedRole.id), [selectedRole.id])
  const permissionCopy = useMemo(() => getPermissionCopy(accessRole), [accessRole])
  const passwordChecks = useMemo(() => getPasswordChecks(password), [password])
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const stepKey = `${mode}-${signupStep}`

  useEffect(() => {
    if (!roleOptions.some(option => option.id === projectRoleTitle)) {
      setProjectRoleTitle(roleOptions[0].id)
    }
  }, [projectRoleTitle, roleOptions])

  function resetMessages() {
    setError(null)
    setInfo(null)
  }

  function publishError(message: string) {
    setError(message)
    showError(message, { id: 'auth-error' })
  }

  function openSignIn() {
    if (isGoogleOnboarding) {
      return
    }

    resetMessages()
    setAuthAction(null)
    setMode('signin')
    setSignupStep('identity')
  }

  function openSignUp() {
    if (isGoogleOnboarding) {
      return
    }

    resetMessages()
    setAuthAction(null)
    setMode('signup')
    setSignupStep('identity')
  }

  function handleBack() {
    resetMessages()
    setAuthAction(null)
    if (signupStep === 'confirmation') setSignupStep('identity')
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    if (!signInEmail.trim() || !signInPassword) {
      publishError('Enter your email and password to sign in.')
      return
    }

    setAuthAction('signin')
    showLoading('Signing in...', { id: 'auth-signin' })

    const result = await signInWithEmail(signInEmail, signInPassword)
    if (!result.ok) {
      setAuthAction(null)
      if (result.reason === 'not_configured') {
        publishError('Supabase is not configured yet. Add the frontend environment keys before signing in.')
        return
      }

      const message = result.message ?? (
        result.reason === 'account_not_found'
          ? 'No account was found for this email. Create one to continue.'
          : 'That password does not match this account.'
      )
      publishError(message)
      return
    }

    showSuccess('Welcome back!', { id: 'auth-signin' })
    navigate('/projects', { replace: true })
  }

  async function handleGoogleLogin() {
    resetMessages()
    setAuthAction('google')
    showLoading('Starting Google sign-in...', { id: 'auth-google' })

    const result = await signInWithGoogle()
    if (!result.ok) {
      setAuthAction(null)
      publishError(result.reason === 'not_configured' ? 'Supabase is not configured yet. Add the frontend environment keys before using Google sign-in.' : (result.message ?? 'Google sign-in could not be started.'))
      return
    }

    if (!result.redirected) {
      showSuccess('Welcome back!', { id: 'auth-google' })
      navigate('/projects', { replace: true })
    }
  }

  function handleIdentityContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    if (!fullName.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      publishError('Fill in every required field to continue.')
      return
    }

    if (!emailPattern.test(email.trim())) {
      publishError('Enter a valid email address.')
      return
    }

    if (phone.replace(/\D/g, '').length < 10) {
      publishError('Enter a valid phone number.')
      return
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      publishError('Password must meet all required rules.')
      return
    }

    if (password !== confirmPassword) {
      publishError('Passwords do not match.')
      return
    }

    // For regular signup: skip department/role/permissions steps, register immediately
    if (!isGoogleOnboarding) {
      void completeSignup()
    } else {
      setSignupStep('confirmation')
    }
  }

  async function completeSignup() {
    resetMessages()
    setAuthAction('signup')
    showLoading(isGoogleOnboarding ? 'Saving onboarding...' : 'Creating account...', { id: 'auth-signup' })

    const result = isGoogleOnboarding
      ? await completeGoogleOnboarding({
          departmentId,
          projectRoleTitle: selectedRole.id,
        })
      : await registerAccount({
          name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          role: accessRole,
          roleLabel: selectedRole.label,
          projectRoleTitle: selectedRole.id,
          departmentId,
          avatarUrl: undefined,
        })

    if (!result.ok) {
      setAuthAction(null)
      publishError(
        result.reason === 'not_configured'
          ? 'Supabase is not configured yet. Add the frontend environment keys before creating accounts.'
          : result.reason === 'not_authenticated'
          ? 'Your Google session expired. Please sign in again.'
          : result.reason === 'email_exists'
          ? 'An account with this email already exists.'
          : result.reason === 'phone_exists'
            ? 'An account with this phone number already exists.'
            : (result.message ?? 'Account creation could not be completed.'),
      )
      setSignupStep('identity')
      return
    }

    setCreatedUser(result.user)
    if ('requiresEmailConfirmation' in result && result.requiresEmailConfirmation) {
      setInfo('Account created. Confirm your email in Supabase, then sign in to enter the workspace.')
    } else if (isGoogleOnboarding) {
      setInfo('Your Google account is ready. Continue through the Projects Hub for project access.')
    }
    setAuthAction(null)
    showSuccess(
      'requiresEmailConfirmation' in result && result.requiresEmailConfirmation
        ? 'Account created. Check your email to continue.'
        : isGoogleOnboarding
          ? 'Onboarding completed successfully.'
          : 'Account created successfully.',
      { id: 'auth-signup' },
    )
    setSignupStep('confirmation')
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 'clamp(1.75rem, 3.6vw, 2.9rem)',
    lineHeight: 0.98,
    fontWeight: 700,
    letterSpacing: '-0.07em',
  }

  const copyStyle: CSSProperties = {
    marginTop: '8px',
    fontSize: '0.94rem',
    lineHeight: 1.66,
    color: 'var(--auth-muted)',
  }

  return (
    <div className="authfx-root" style={themeVars}>
      <style>{localStyles}</style>

      <button
        onClick={() => navigate('/')}
        aria-label="Back to landing page"
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 40,
          width: '48px',
          height: '48px',
          borderRadius: '999px',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.76)',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)',
          boxShadow: isDark ? '0 18px 32px rgba(0,0,0,0.28)' : '0 18px 32px rgba(220,213,205,0.24)',
          color: isDark ? '#ffffff' : '#171717',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} />
      </button>

      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 40,
          width: '48px',
          height: '48px',
          borderRadius: '999px',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.76)',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)',
          boxShadow: isDark ? '0 18px 32px rgba(0,0,0,0.28)' : '0 18px 32px rgba(220,213,205,0.24)',
          color: isDark ? '#ffffff' : '#171717',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="authfx-shell">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: '58px', height: '58px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#111111', background: 'linear-gradient(180deg, #ff8a5f 0%, #ff6a3d 100%)', boxShadow: '0 18px 34px rgba(255,106,61,0.26), inset 0 1px 1px rgba(255,255,255,0.5)' }}>
            <Clapperboard size={21} />
          </div>
          <div>
            <div style={{ fontSize: 'clamp(1.8rem, 2.2vw, 2.5rem)', lineHeight: 0.96, fontWeight: 700, letterSpacing: '-0.07em' }}>ProdSync</div>
            <div style={{ marginTop: '6px', fontSize: '0.92rem', color: 'var(--auth-muted)' }}>Structured access for film production teams</div>
          </div>
        </div>
        {mode === 'signin' ? (
          <StageFrame width="470px" panelKey={stepKey}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '7px', borderRadius: '999px', ...insetStyle() }}>
              <button type="button" onClick={openSignIn} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: '#ca441b', background: 'rgba(255,255,255,0.96)' }}>Sign In</button>
              <button type="button" onClick={openSignUp} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--auth-muted)', background: 'transparent' }}>Create Account</button>
            </div>

            <form onSubmit={handleSignIn} style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
              <div>
                <h1 style={sectionTitleStyle}>Welcome Back</h1>
                <p style={copyStyle}>Sign in with your email and password, or use Google to continue into the Projects Hub.</p>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={authAction !== null} style={{ width: '100%', ...secondaryButtonStyle(isDark, authAction !== null) }}>
                {authAction === 'google' ? <span className="ui-spinner" /> : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {authAction === 'google' ? 'Opening Google...' : 'Continue with Google'}
              </button>

              <Field label="Email" icon={Mail} placeholder="crew@prodsync.app" value={signInEmail} onChange={setSignInEmail} type="email" />
              <PasswordField label="Password" value={signInPassword} onChange={setSignInPassword} visible={signInPasswordVisible} onToggleVisibility={() => setSignInPasswordVisible(current => !current)} placeholder="Enter your password" />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { resetMessages(); setInfo('Password recovery is not wired to a backend yet, but the entry point is ready for it.'); showInfo('Password recovery is coming soon.', { id: 'auth-password-recovery' }) }} style={{ border: 0, background: 'transparent', color: '#c54a22', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer' }}>
                  Forgot Password?
                </button>
              </div>

              {error ? <Notice tone="error">{error}</Notice> : null}
              {info ? <Notice tone="info">{info}</Notice> : null}

              <button type="submit" disabled={authAction !== null} style={primaryButtonStyle(authAction !== null)}>
                {authAction === 'signin' ? <span className="ui-spinner" /> : 'Sign In'}
                {authAction === 'signin' ? 'Signing In...' : null}
                {authAction === 'signin' ? null : <ArrowRight size={18} />}
              </button>
            </form>
          </StageFrame>
        ) : signupStep === 'identity' ? (
          <StageFrame width="530px" panelKey={stepKey}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '7px', borderRadius: '999px', ...insetStyle() }}>
              <button type="button" onClick={openSignIn} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--auth-muted)', background: 'transparent' }}>Sign In</button>
              <button type="button" onClick={openSignUp} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: '#ca441b', background: 'rgba(255,255,255,0.96)' }}>Create Account</button>
            </div>

            <form onSubmit={handleIdentityContinue} style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
              <div>
                <h1 style={sectionTitleStyle}>{isGoogleOnboarding ? 'Create Your Workspace Profile' : 'Create Your Account'}</h1>
                <p style={copyStyle}>
                  {isGoogleOnboarding
                    ? 'Your Google identity is already verified. We just need department and role details to finish setup.'
                    : 'Start with your identity and password, then we&apos;ll guide you through department, role, and access setup.'}
                </p>
              </div>

              <div className="authfx-grid authfx-grid-2">
                <Field label="Full Name" icon={UserIcon} placeholder="Biswajit Sahu" value={fullName} onChange={setFullName} required />
                <Field label="Phone Number" icon={Phone} placeholder="+91 98765 43210" value={phone} onChange={setPhone} type="tel" required />
              </div>

              <Field label="Email" icon={Mail} placeholder="you@production.com" value={email} onChange={setEmail} type="email" required />

              <div className="authfx-grid authfx-grid-2">
                <PasswordField label="Password" value={password} onChange={setPassword} visible={passwordVisible} onToggleVisibility={() => setPasswordVisible(current => !current)} placeholder="Create password" required />
                <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} visible={confirmPasswordVisible} onToggleVisibility={() => setConfirmPasswordVisible(current => !current)} placeholder="Repeat password" required />
              </div>

              <div style={{ borderRadius: '24px', padding: '16px', ...surfaceStyle(isDark) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--auth-muted)' }}>Password Strength</div>
                    <div style={{ marginTop: '6px', fontSize: '1rem', fontWeight: 700 }}>{passwordStrength.label}</div>
                  </div>
                  <div style={{ color: passwordStrength.score >= 3 ? '#ff6a3d' : 'var(--auth-soft)', fontSize: '0.9rem' }}>
                    {passwordStrength.score}/4 rules matched
                  </div>
                </div>

                <div className="authfx-meter" style={{ marginTop: '14px' }}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span key={index} className={index < passwordStrength.score ? 'is-on' : ''} />
                  ))}
                </div>

                <div style={{ marginTop: '14px', display: 'grid', gap: '9px' }}>
                  <ChecklistItem passed={passwordChecks.minLength} label="Minimum 8 characters" />
                  <ChecklistItem passed={passwordChecks.uppercase} label="At least 1 uppercase letter" />
                  <ChecklistItem passed={passwordChecks.number} label="At least 1 number" />
                  <ChecklistItem passed={passwordChecks.special} label="At least 1 special character" />
                  <ChecklistItem passed={passwordsMatch} label="Passwords match" />
                </div>
              </div>

              {error ? <Notice tone="error">{error}</Notice> : null}

              <button type="submit" disabled={authAction === 'signup'} style={primaryButtonStyle(authAction === 'signup')}>
                {authAction === 'signup' ? <span className="ui-spinner" /> : null}
                {authAction === 'signup' ? (isGoogleOnboarding ? 'Continue Setup...' : 'Creating Account...') : (isGoogleOnboarding ? 'Continue Setup' : 'Create Account')}
                {authAction !== 'signup' ? <ArrowRight size={18} /> : null}
              </button>
            </form>
          </StageFrame>
        ) : (
          <StageFrame width="720px" panelKey={stepKey}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '74px', height: '74px', margin: '0 auto 18px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#111111', background: 'linear-gradient(180deg, #ff8a5f 0%, #ff6a3d 100%)', boxShadow: '0 20px 36px rgba(255,106,61,0.24)' }}>
                <CheckCircle2 size={24} />
              </div>
              <h1 style={sectionTitleStyle}>You&apos;re Ready</h1>
              <p style={copyStyle}>
                {isGoogleOnboarding
                  ? 'Your Google login is fully linked. Use a project code or invite link from your producer to join a project and access your workspace.'
                  : 'Your account is set up. Use a project code or invite link from your producer to join a project and access your workspace.'}
              </p>

              <div className="authfx-summary" style={{ margin: '22px 0 20px', padding: '14px 16px', borderRadius: '26px', textAlign: 'left', ...surfaceStyle(isDark) }}>
                <SummaryCard title="User Name" value={createdUser?.name ?? (fullName || user?.name || 'ProdSync User')} icon={UserIcon} isDark={isDark} />
                <SummaryCard title="Role" value={selectedRole.label} icon={roleIcons[selectedRole.id] ?? ShieldCheck} isDark={isDark} />
                <SummaryCard title="Department" value={selectedDepartment.label} icon={departmentIcons[selectedDepartment.id]} isDark={isDark} />
              </div>

              <button
                type="button"
                onClick={() => {
                  setAuthAction('workspace')
                  showLoading('Opening workspace...', { id: 'auth-workspace' })
                  navigate('/projects', { replace: true })
                }}
                disabled={authAction === 'workspace'}
                style={{ minWidth: '240px', ...primaryButtonStyle(authAction === 'workspace') }}
              >
                {authAction === 'workspace' ? <span className="ui-spinner" /> : 'Enter Workspace'}
                {authAction === 'workspace' ? 'Opening Workspace...' : null}
                {authAction === 'workspace' ? null : <ArrowRight size={18} />}
              </button>
              {info ? <div style={{ marginTop: '16px' }}><Notice tone="info">{info}</Notice></div> : null}
            </div>
          </StageFrame>
        )}

        <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center', gap: '18px', flexWrap: 'wrap', color: 'var(--auth-soft)', fontSize: '0.88rem' }}>
          <a href="#privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
          <a href="#help" style={{ color: 'inherit', textDecoration: 'none' }}>Help Center</a>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: passed ? '#ff6a3d' : 'var(--auth-muted)', fontSize: '0.92rem' }}>
      {passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{label}</span>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '18px', background: tone === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(255,106,61,0.1)', color: tone === 'error' ? '#c33f2f' : '#c54a22', fontSize: '0.92rem', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

function StepDots({ currentStep, isGoogle }: { currentStep: SignupStep; isGoogle: boolean }) {
  const steps = regularStageSteps
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' }}>
      {steps.map(step => (
        <span key={step} style={{ width: step === currentStep ? '60px' : '34px', height: '10px', borderRadius: '999px', background: step === currentStep ? 'linear-gradient(90deg,#ff8a5f 0%,#ff6a3d 100%)' : 'rgba(255,255,255,0.68)', boxShadow: step === currentStep ? '0 12px 24px rgba(255,106,61,0.16)' : 'none', transition: 'all .24s ease' }} />
      ))}
    </div>
  )
}

function StepFooter({
  isDark,
  onBack,
  backLabel,
  showBack = true,
  onNext,
  note,
}: {
  isDark: boolean
  onBack: () => void
  backLabel: string
  showBack?: boolean
  onNext: () => void
  note: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginTop: '28px', flexWrap: 'wrap' }}>
      {showBack ? (
        <button type="button" onClick={onBack} style={secondaryButtonStyle(isDark)}>
          <ArrowLeft size={18} />
          {backLabel}
        </button>
      ) : <span />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '999px', padding: '12px 18px', fontSize: '0.88rem', color: 'var(--auth-muted)', ...surfaceStyle(isDark) }}>
          <Sparkles size={16} style={{ color: '#ff6a3d', flexShrink: 0 }} />
          {note}
        </div>
        <button type="button" onClick={onNext} style={primaryButtonStyle()}>
          Continue
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}

function PermissionPanel({
  title,
  items,
  tone,
  isDark,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'negative'
  isDark: boolean
}) {
  return (
    <div style={{ borderRadius: '24px', padding: '18px', ...surfaceStyle(isDark) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--auth-muted)' }}>
        {tone === 'positive' ? <CheckCircle2 size={18} style={{ color: '#ff6a3d' }} /> : <XCircle size={18} style={{ color: '#ff6a3d' }} />}
        {title}
      </div>
      <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
        {items.map(item => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '12px', alignItems: 'start', fontSize: '0.94rem', lineHeight: 1.65, color: 'var(--auth-muted)' }}>
            <span style={{ color: '#ff6a3d', fontWeight: 700 }}>{tone === 'positive' ? '✔' : '✖'}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  isDark,
}: {
  title: string
  value: string
  icon: LucideIcon
  isDark: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c94d23', ...surfaceStyle(isDark) }}>
        <Icon size={18} />
      </div>
      <div>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--auth-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
      </div>
    </div>
  )
}
