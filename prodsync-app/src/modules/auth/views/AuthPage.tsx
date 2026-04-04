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
import type { ProjectDepartment, ProjectRequestedRole, User } from '@/types'

type AuthMode = 'signin' | 'signup'
type SignupStep = 'identity' | 'department' | 'role' | 'permissions' | 'confirmation'

interface PasswordChecks {
  minLength: boolean
  uppercase: boolean
  number: boolean
  special: boolean
}

const stageSteps: SignupStep[] = ['identity', 'department', 'role', 'permissions', 'confirmation']
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
.authfx-shell{position:relative;z-index:1;min-height:100vh;max-width:1180px;margin:0 auto;padding:28px 18px 36px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.authfx-stage{width:100%;max-width:var(--stage-width);padding:14px;border-radius:34px;background:var(--stage-bg);border:1px solid var(--stage-border);box-shadow:var(--stage-shadow);backdrop-filter:blur(20px)}
.authfx-panel{animation:authfx-enter .42s cubic-bezier(.22,1,.36,1) both}
.authfx-grid{display:grid;gap:18px}
.authfx-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.authfx-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.authfx-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
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

function getThemeVars(isDark: boolean): CSSProperties {
  return {
    '--auth-bg': isDark
      ? 'radial-gradient(circle at top, rgba(79,70,229,0.16), transparent 28%), radial-gradient(circle at left, rgba(168,85,247,0.14), transparent 24%), radial-gradient(circle at right, rgba(255,106,61,0.16), transparent 26%), #08070b'
      : 'linear-gradient(180deg, #f9f7f3 0%, #ffffff 35%, #f4f1ed 100%)',
    '--auth-text': isDark ? '#ffffff' : '#161616',
    '--auth-muted': isDark ? 'rgba(255,255,255,0.7)' : '#777780',
    '--auth-soft': isDark ? 'rgba(255,255,255,0.48)' : '#ababaf',
    '--stage-bg': isDark
      ? 'linear-gradient(180deg, rgba(19,19,24,0.92) 0%, rgba(9,9,12,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,244,239,0.98) 100%)',
    '--stage-border': isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.86)',
    '--stage-shadow': isDark
      ? '0 34px 72px rgba(0,0,0,0.42), inset 0 1px 1px rgba(255,255,255,0.05)'
      : '0 30px 68px rgba(222,214,205,0.42), inset 0 1px 1px rgba(255,255,255,0.95)',
    '--card-bg': isDark
      ? 'linear-gradient(180deg, rgba(22,22,28,0.88) 0%, rgba(12,12,16,0.94) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,244,239,0.96) 100%)',
    '--card-shadow': isDark
      ? '0 20px 38px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.04)'
      : '0 20px 38px rgba(220,213,205,0.28), inset 0 1px 1px rgba(255,255,255,0.92)',
    '--inset-bg': isDark ? 'rgba(255,255,255,0.04)' : 'linear-gradient(180deg, #f0ece7 0%, #f8f5f1 100%)',
    '--inset-shadow': isDark
      ? 'inset 0 10px 20px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.04)'
      : 'inset 0 10px 20px rgba(224,216,207,0.46), inset 0 1px 1px rgba(255,255,255,0.94)',
  } as CSSProperties
}

function surfaceStyle(isDark: boolean): CSSProperties {
  return {
    background: 'var(--card-bg)',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)',
    boxShadow: 'var(--card-shadow)',
  }
}

function insetStyle(): CSSProperties {
  return {
    background: 'var(--inset-bg)',
    boxShadow: 'var(--inset-shadow)',
  }
}

function primaryButtonStyle(): CSSProperties {
  return {
    minHeight: '54px',
    padding: '0 24px',
    borderRadius: '999px',
    border: 0,
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#111111',
    background: 'linear-gradient(180deg, #ff8c60 0%, #ff6a3d 100%)',
    boxShadow: '0 18px 30px rgba(255,106,61,0.22), inset 0 1px 1px rgba(255,255,255,0.42)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  }
}

function secondaryButtonStyle(isDark: boolean): CSSProperties {
  return {
    minHeight: '52px',
    padding: '0 22px',
    borderRadius: '999px',
    border: 0,
    fontSize: '0.96rem',
    fontWeight: 700,
    color: isDark ? '#ffffff' : '#171717',
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)',
    boxShadow: isDark
      ? '0 16px 28px rgba(0,0,0,0.24), inset 0 1px 1px rgba(255,255,255,0.05)'
      : '0 16px 28px rgba(220,213,205,0.22), inset 0 1px 1px rgba(255,255,255,0.92)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  }
}

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
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

function StageFrame({ width, panelKey, children }: { width: string; panelKey: string; children: ReactNode }) {
  return (
    <div className="authfx-stage" style={{ '--stage-width': width } as CSSProperties}>
      <div key={panelKey} className="authfx-panel" style={{ borderRadius: '30px', padding: '16px' }}>
        {children}
      </div>
    </div>
  )
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ paddingLeft: '6px', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--auth-muted)' }}>
      {children}
      <span style={{ color: '#ff6a3d', marginLeft: '6px' }}>*</span>
    </span>
  )
}

function Field({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  icon: LucideIcon
  placeholder: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'tel'
  required?: boolean
}) {
  return (
    <label style={{ display: 'grid', gap: '10px' }}>
      {required ? <RequiredLabel>{label}</RequiredLabel> : <span style={{ paddingLeft: '6px', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--auth-muted)' }}>{label}</span>}
      <span style={{ minHeight: '58px', borderRadius: '22px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px', ...insetStyle() }}>
        <Icon size={18} style={{ color: 'var(--auth-soft)', flexShrink: 0 }} />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          type={type}
          placeholder={placeholder}
          style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--auth-text)', fontSize: '0.98rem' }}
        />
      </span>
    </label>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggleVisibility: () => void
  placeholder: string
  required?: boolean
}) {
  return (
    <label style={{ display: 'grid', gap: '10px' }}>
      {required ? <RequiredLabel>{label}</RequiredLabel> : <span style={{ paddingLeft: '6px', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--auth-muted)' }}>{label}</span>}
      <span style={{ minHeight: '58px', borderRadius: '22px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px 0 18px', ...insetStyle() }}>
        <KeyRound size={18} style={{ color: 'var(--auth-soft)', flexShrink: 0 }} />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--auth-text)', fontSize: '0.98rem' }}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{ width: '40px', height: '40px', border: 0, borderRadius: '999px', background: 'transparent', color: 'var(--auth-soft)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const themeVars = getThemeVars(isDark)

  const signInWithEmail = useAuthStore(state => state.signInWithEmail)
  const signInWithGoogle = useAuthStore(state => state.signInWithGoogle)
  const registerAccount = useAuthStore(state => state.registerAccount)
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const sessionExpiresAt = useAuthStore(state => state.sessionExpiresAt)

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

  useEffect(() => {
    if (isAuthenticated && user && sessionExpiresAt && sessionExpiresAt > Date.now()) {
      navigate(getDefaultAuthorizedPath(user), { replace: true })
    }
  }, [isAuthenticated, navigate, sessionExpiresAt, user])

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

  function openSignIn() {
    resetMessages()
    setMode('signin')
    setSignupStep('identity')
  }

  function openSignUp() {
    resetMessages()
    setMode('signup')
    setSignupStep('identity')
  }

  function handleBack() {
    resetMessages()
    if (signupStep === 'department') setSignupStep('identity')
    if (signupStep === 'role') setSignupStep('department')
    if (signupStep === 'permissions') setSignupStep('role')
    if (signupStep === 'confirmation') setSignupStep('permissions')
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    if (!signInEmail.trim() || !signInPassword) {
      setError('Enter your email and password to sign in.')
      return
    }

    const result = signInWithEmail(signInEmail, signInPassword)
    if (!result.ok) {
      setError(
        result.reason === 'account_not_found'
          ? 'No account was found for this email. Create one to continue.'
          : 'That password does not match this account.',
      )
      return
    }

    navigate('/projects', { replace: true })
  }

  function handleGoogleLogin() {
    resetMessages()
    signInWithGoogle()
    navigate('/projects', { replace: true })
  }

  function handleIdentityContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    if (!fullName.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Fill in every required field to continue.')
      return
    }

    if (!emailPattern.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }

    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number.')
      return
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError('Password must meet all required rules.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSignupStep('department')
  }

  function completeSignup() {
    resetMessages()
    const result = registerAccount({
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
      setError(
        result.reason === 'email_exists'
          ? 'An account with this email already exists.'
          : 'An account with this phone number already exists.',
      )
      setSignupStep('identity')
      return
    }

    setCreatedUser(result.user)
    setSignupStep('confirmation')
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: 'clamp(1.9rem, 4vw, 3.15rem)',
    lineHeight: 0.98,
    fontWeight: 700,
    letterSpacing: '-0.07em',
  }

  const copyStyle: CSSProperties = {
    marginTop: '10px',
    fontSize: '0.98rem',
    lineHeight: 1.72,
    color: 'var(--auth-muted)',
  }

  return (
    <div className="authfx-root" style={themeVars}>
      <style>{localStyles}</style>

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#111111', background: 'linear-gradient(180deg, #ff8a5f 0%, #ff6a3d 100%)', boxShadow: '0 22px 40px rgba(255,106,61,0.26), inset 0 1px 1px rgba(255,255,255,0.5)' }}>
            <Clapperboard size={23} />
          </div>
          <div>
            <div style={{ fontSize: 'clamp(1.95rem, 2.5vw, 2.75rem)', lineHeight: 0.96, fontWeight: 700, letterSpacing: '-0.07em' }}>ProdSync</div>
            <div style={{ marginTop: '8px', fontSize: '0.96rem', color: 'var(--auth-muted)' }}>Structured access for film production teams</div>
          </div>
        </div>
        {mode === 'signin' ? (
          <StageFrame width="500px" panelKey={stepKey}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '7px', borderRadius: '999px', ...insetStyle() }}>
              <button type="button" onClick={openSignIn} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: '#ca441b', background: 'rgba(255,255,255,0.96)' }}>Sign In</button>
              <button type="button" onClick={openSignUp} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--auth-muted)', background: 'transparent' }}>Create Account</button>
            </div>

            <form onSubmit={handleSignIn} style={{ display: 'grid', gap: '16px', marginTop: '22px' }}>
              <div>
                <h1 style={sectionTitleStyle}>Welcome Back</h1>
                <p style={copyStyle}>Sign in with your email and password, or use Google to continue into the Projects Hub.</p>
              </div>

              <button type="button" onClick={handleGoogleLogin} style={{ width: '100%', ...secondaryButtonStyle(isDark) }}>
                <Globe size={18} />
                Continue with Google
              </button>

              <Field label="Email" icon={Mail} placeholder="crew@prodsync.app" value={signInEmail} onChange={setSignInEmail} type="email" />
              <PasswordField label="Password" value={signInPassword} onChange={setSignInPassword} visible={signInPasswordVisible} onToggleVisibility={() => setSignInPasswordVisible(current => !current)} placeholder="Enter your password" />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { resetMessages(); setInfo('Password recovery is not wired to a backend yet, but the entry point is ready for it.') }} style={{ border: 0, background: 'transparent', color: '#c54a22', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer' }}>
                  Forgot Password?
                </button>
              </div>

              {error ? <Notice tone="error">{error}</Notice> : null}
              {info ? <Notice tone="info">{info}</Notice> : null}

              <button type="submit" style={primaryButtonStyle()}>
                Sign In
                <ArrowRight size={18} />
              </button>
            </form>
          </StageFrame>
        ) : signupStep === 'identity' ? (
          <StageFrame width="560px" panelKey={stepKey}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '7px', borderRadius: '999px', ...insetStyle() }}>
              <button type="button" onClick={openSignIn} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--auth-muted)', background: 'transparent' }}>Sign In</button>
              <button type="button" onClick={openSignUp} style={{ border: 0, borderRadius: '999px', minHeight: '48px', fontSize: '0.96rem', fontWeight: 700, color: '#ca441b', background: 'rgba(255,255,255,0.96)' }}>Create Account</button>
            </div>

            <form onSubmit={handleIdentityContinue} style={{ display: 'grid', gap: '16px', marginTop: '22px' }}>
              <div>
                <h1 style={sectionTitleStyle}>Create Your Account</h1>
                <p style={copyStyle}>Start with your identity and password, then we&apos;ll guide you through department, role, and access setup.</p>
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

              <div style={{ borderRadius: '26px', padding: '18px', ...surfaceStyle(isDark) }}>
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

                <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                  <ChecklistItem passed={passwordChecks.minLength} label="Minimum 8 characters" />
                  <ChecklistItem passed={passwordChecks.uppercase} label="At least 1 uppercase letter" />
                  <ChecklistItem passed={passwordChecks.number} label="At least 1 number" />
                  <ChecklistItem passed={passwordChecks.special} label="At least 1 special character" />
                  <ChecklistItem passed={passwordsMatch} label="Passwords match" />
                </div>
              </div>

              {error ? <Notice tone="error">{error}</Notice> : null}

              <button type="submit" style={primaryButtonStyle()}>
                Continue Setup
                <ArrowRight size={18} />
              </button>
            </form>
          </StageFrame>
        ) : signupStep === 'department' ? (
          <StageFrame width="860px" panelKey={stepKey}>
            <StepDots currentStep={signupStep} />
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,106,61,0.12)', color: '#cf4c23', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '14px' }}>Step 02 • Department</div>
              <h1 style={sectionTitleStyle}>Choose Your Department</h1>
              <p style={copyStyle}>Select your primary department group. The next step will only show roles relevant to that department.</p>
            </div>
            <div className="authfx-grid authfx-grid-3">
              {DEPARTMENT_OPTIONS.map(option => {
                const Icon = departmentIcons[option.id]
                const selected = departmentId === option.id
                return (
                  <button key={option.id} type="button" onClick={() => setDepartmentId(option.id)} style={{ position: 'relative', borderRadius: '28px', padding: '20px 18px', textAlign: 'left', cursor: 'pointer', transform: selected ? 'translateY(-2px)' : 'none', ...surfaceStyle(isDark), boxShadow: selected ? '0 18px 32px rgba(255,106,61,0.12), var(--card-shadow)' : 'var(--card-shadow)', border: selected ? '1px solid rgba(255,106,61,0.3)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)' }}>
                    <span style={{ width: '52px', height: '52px', borderRadius: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c94d23', marginBottom: '18px', ...surfaceStyle(isDark) }}>
                      <Icon size={21} />
                    </span>
                    <div style={{ fontSize: '1.02rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35 }}>{option.label}</div>
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', lineHeight: 1.68, color: 'var(--auth-muted)' }}>{option.description}</div>
                    {selected ? <span style={{ position: 'absolute', right: '18px', bottom: '18px', color: '#ff6a3d' }}><CheckCircle2 size={18} /></span> : null}
                  </button>
                )
              })}
            </div>

            <StepFooter
              isDark={isDark}
              onBack={handleBack}
              backLabel="Back to Account"
              onNext={() => { resetMessages(); setSignupStep('role') }}
              note="This selection controls which role options appear next."
            />
          </StageFrame>
        ) : signupStep === 'role' ? (
          <StageFrame width="860px" panelKey={stepKey}>
            <StepDots currentStep={signupStep} />
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,106,61,0.12)', color: '#cf4c23', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '14px' }}>Step 03 • Role</div>
              <h1 style={sectionTitleStyle}>Select Your Role</h1>
              <p style={copyStyle}>Only roles mapped to {selectedDepartment.label.toLowerCase()} are shown here.</p>
            </div>

            <div className="authfx-grid authfx-grid-3">
              {roleOptions.map(option => {
                const Icon = roleIcons[option.id] ?? ShieldCheck
                const selected = projectRoleTitle === option.id
                return (
                  <button key={option.id} type="button" onClick={() => setProjectRoleTitle(option.id)} style={{ position: 'relative', borderRadius: '28px', padding: '20px 18px', textAlign: 'left', cursor: 'pointer', transform: selected ? 'translateY(-2px)' : 'none', ...surfaceStyle(isDark), boxShadow: selected ? '0 18px 32px rgba(255,106,61,0.12), var(--card-shadow)' : 'var(--card-shadow)', border: selected ? '1px solid rgba(255,106,61,0.3)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)' }}>
                    <span style={{ width: '52px', height: '52px', borderRadius: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c94d23', marginBottom: '18px', ...surfaceStyle(isDark) }}>
                      <Icon size={21} />
                    </span>
                    <div style={{ fontSize: '1.02rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35 }}>{option.label}</div>
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', lineHeight: 1.68, color: 'var(--auth-muted)' }}>{option.description}</div>
                    <div style={{ marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--auth-soft)' }}>Mapped access: {option.accessRole}</div>
                    {selected ? <span style={{ position: 'absolute', right: '18px', bottom: '18px', color: '#ff6a3d' }}><CheckCircle2 size={18} /></span> : null}
                  </button>
                )
              })}
            </div>

            <StepFooter
              isDark={isDark}
              onBack={handleBack}
              backLabel="Back to Department"
              onNext={() => { resetMessages(); setSignupStep('permissions') }}
              note={`${selectedRole.label} will be used as your visible role label across the app.`}
            />
          </StageFrame>
        ) : signupStep === 'permissions' ? (
          <StageFrame width="760px" panelKey={stepKey}>
            <StepDots currentStep={signupStep} />
            <div style={{ borderRadius: '28px', padding: '26px 24px 22px', ...surfaceStyle(isDark) }}>
              <div style={{ width: '72px', height: '72px', margin: '0 auto 18px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#111111', background: 'linear-gradient(180deg, #ff8a5f 0%, #ff6a3d 100%)', boxShadow: '0 24px 42px rgba(255,106,61,0.24)' }}>
                <ShieldCheck size={24} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h1 style={sectionTitleStyle}>Permissions Preview</h1>
                <p style={copyStyle}>Review what this role can and cannot do before entering the Projects Hub.</p>
              </div>

              <div style={{ marginTop: '18px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '999px', fontSize: '0.83rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--auth-muted)', ...surfaceStyle(isDark) }}>
                <span>{selectedDepartment.label}</span>
                <span style={{ color: '#ca441b' }}>{selectedRole.label}</span>
              </div>

              <div className="authfx-grid authfx-grid-2" style={{ marginTop: '24px' }}>
                <PermissionPanel title="Can Do" items={permissionCopy.can} tone="positive" isDark={isDark} />
                <PermissionPanel title="Cannot Do" items={permissionCopy.cannot} tone="negative" isDark={isDark} />
              </div>

              {error ? <div style={{ marginTop: '18px' }}><Notice tone="error">{error}</Notice></div> : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginTop: '26px', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleBack} style={secondaryButtonStyle(isDark)}>
                  <ArrowLeft size={18} />
                  Adjust Role
                </button>
                <button type="button" onClick={completeSignup} style={primaryButtonStyle()}>
                  Continue
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </StageFrame>
        ) : (
          <StageFrame width="720px" panelKey={stepKey}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '82px', height: '82px', margin: '0 auto 22px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#111111', background: 'linear-gradient(180deg, #ff8a5f 0%, #ff6a3d 100%)', boxShadow: '0 24px 42px rgba(255,106,61,0.24)' }}>
                <CheckCircle2 size={28} />
              </div>
              <h1 style={sectionTitleStyle}>You&apos;re Ready</h1>
              <p style={copyStyle}>Your account is set up. Next stop is the Projects Hub, where project membership unlocks the rest of the workspace.</p>

              <div className="authfx-summary" style={{ margin: '26px 0 22px', padding: '16px 18px', borderRadius: '28px', textAlign: 'left', ...surfaceStyle(isDark) }}>
                <SummaryCard title="User Name" value={createdUser?.name ?? (fullName || 'ProdSync User')} icon={UserIcon} isDark={isDark} />
                <SummaryCard title="Role" value={selectedRole.label} icon={roleIcons[selectedRole.id] ?? ShieldCheck} isDark={isDark} />
                <SummaryCard title="Department" value={selectedDepartment.label} icon={departmentIcons[selectedDepartment.id]} isDark={isDark} />
              </div>

              <button type="button" onClick={() => navigate('/projects', { replace: true })} style={{ minWidth: '240px', ...primaryButtonStyle() }}>
                Enter Workspace
                <ArrowRight size={18} />
              </button>
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

function StepDots({ currentStep }: { currentStep: SignupStep }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' }}>
      {stageSteps.map(step => (
        <span key={step} style={{ width: step === currentStep ? '60px' : '34px', height: '10px', borderRadius: '999px', background: step === currentStep ? 'linear-gradient(90deg,#ff8a5f 0%,#ff6a3d 100%)' : 'rgba(255,255,255,0.68)', boxShadow: step === currentStep ? '0 12px 24px rgba(255,106,61,0.16)' : 'none', transition: 'all .24s ease' }} />
      ))}
    </div>
  )
}

function StepFooter({
  isDark,
  onBack,
  backLabel,
  onNext,
  note,
}: {
  isDark: boolean
  onBack: () => void
  backLabel: string
  onNext: () => void
  note: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginTop: '28px', flexWrap: 'wrap' }}>
      <button type="button" onClick={onBack} style={secondaryButtonStyle(isDark)}>
        <ArrowLeft size={18} />
        {backLabel}
      </button>
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
