/* eslint-disable react-refresh/only-export-components */
import { CSSProperties, ReactNode } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, ArrowRight, ArrowLeft, Sparkles, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const getThemeVars = (isDark: boolean): CSSProperties => ({
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
    ? '0 30px 64px rgba(0,0,0,0.42), inset 0 1px 1px rgba(255,255,255,0.05)'
    : '0 26px 60px rgba(222,214,205,0.42), inset 0 1px 1px rgba(255,255,255,0.95)',
  '--card-bg': isDark
    ? 'linear-gradient(180deg, rgba(22,22,28,0.88) 0%, rgba(12,12,16,0.94) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,244,239,0.96) 100%)',
  '--card-shadow': isDark
    ? '0 18px 34px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.04)'
    : '0 18px 34px rgba(220,213,205,0.28), inset 0 1px 1px rgba(255,255,255,0.92)',
  '--inset-bg': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(244,244,245,0.8)',
  '--inset-shadow': isDark
    ? 'inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 2px 4px rgba(0,0,0,0.2)'
    : 'inset 0 0 0 1px rgba(0,0,0,0.06), inset 0 2px 4px rgba(0,0,0,0.04)',
} as CSSProperties)

export function surfaceStyle(isDark: boolean): CSSProperties {
  return {
    background: 'var(--card-bg)',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)',
    boxShadow: 'var(--card-shadow)',
  }
}

export function insetStyle(): CSSProperties {
  return {
    background: 'var(--inset-bg)',
    boxShadow: 'var(--inset-shadow)',
  }
}

export function primaryButtonStyle(disabled = false): CSSProperties {
  return {
    minHeight: '50px',
    padding: '0 22px',
    borderRadius: '999px',
    border: 0,
    fontSize: '0.94rem',
    fontWeight: 700,
    color: '#111111',
    background: 'linear-gradient(180deg, #ff8c60 0%, #ff6a3d 100%)',
    boxShadow: '0 16px 26px rgba(255,106,61,0.22), inset 0 1px 1px rgba(255,255,255,0.42)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.72 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  }
}

export function secondaryButtonStyle(isDark: boolean, disabled = false): CSSProperties {
  return {
    minHeight: '48px',
    padding: '0 20px',
    borderRadius: '999px',
    border: 0,
    fontSize: '0.92rem',
    fontWeight: 700,
    color: isDark ? '#ffffff' : '#171717',
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)',
    boxShadow: isDark
      ? '0 16px 28px rgba(0,0,0,0.24), inset 0 1px 1px rgba(255,255,255,0.05)'
      : '0 16px 28px rgba(220,213,205,0.22), inset 0 1px 1px rgba(255,255,255,0.92)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.72 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  }
}

export function StageFrame({ width, panelKey, children }: { width: string; panelKey: string; children: ReactNode }) {
  return (
    <div className="authfx-stage" style={{ '--stage-width': width } as CSSProperties}>
      <div key={panelKey} className="authfx-panel" style={{ borderRadius: '28px', padding: '14px' }}>
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

export function Field({
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

export function PasswordField({
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

export function ChecklistItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: passed ? '#ff6a3d' : 'var(--auth-muted)', fontSize: '0.92rem' }}>
      {passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{label}</span>
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '18px', background: tone === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(255,106,61,0.1)', color: tone === 'error' ? '#c33f2f' : '#c54a22', fontSize: '0.92rem', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

export function StepFooter({
  isDark,
  onBack,
  backLabel,
  showBack = true,
  onNext,
  nextLabel = 'Continue',
  note,
}: {
  isDark: boolean
  onBack: () => void
  backLabel: string
  showBack?: boolean
  onNext: () => void
  nextLabel?: string
  note: string | ReactNode
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
        {note ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '999px', padding: '12px 18px', fontSize: '0.88rem', color: 'var(--auth-muted)', ...surfaceStyle(isDark) }}>
            <Sparkles size={16} style={{ color: '#ff6a3d', flexShrink: 0 }} />
            {note}
          </div>
        ) : null}
        <button type="button" onClick={onNext} style={primaryButtonStyle()}>
          {nextLabel}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
