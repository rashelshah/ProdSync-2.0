import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Phone, Mail, Building2, MessageSquare } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { FooterBranding } from '@/modules/landing/components/FooterBranding'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

export function ContactPage() {
  const { theme, toggleTheme } = useTheme()
  const { triggerLiquidNav } = useLiquidTransition()
  const getStartedRef = useRef<HTMLButtonElement>(null)

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'Privacy', to: '/privacy' },
  ]

  return (
    <div className="landing-shell min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 hidden opacity-70 dark:block landing-grid" />
      <div className="landing-glow pointer-events-none absolute left-1/2 top-20 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.24)_0%,_rgba(249,115,22,0.2)_42%,_transparent_72%)] dark:opacity-100" />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Navigation */}
        <header className="landing-enter sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1380px] items-center justify-between rounded-full border border-zinc-200/80 bg-white/75 px-4 py-3 shadow-soft backdrop-blur-xl dark:border-white/6 dark:bg-white/[0.03] 2xl:max-w-[1460px]">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
                <Clapperboard className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex" aria-label="Site navigation">
              {navLinks.map(link => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm font-medium text-zinc-500 transition-colors hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:text-orange-500 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:border-orange-500/30 dark:hover:text-orange-400"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                <span className="material-symbols-outlined text-[18px]">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
              </button>
              <button
                ref={getStartedRef}
                onClick={() => triggerLiquidNav(getStartedRef, '/auth')}
                className="glow-button inline-flex items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black"
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pt-20 flex-1">

          {/* Hero */}
          <section className="mb-14 text-center sm:mb-16" aria-labelledby="contact-heading">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Contact
            </div>

            <h1
              id="contact-heading"
              className="mx-auto max-w-[720px] text-balance text-[2.2rem] font-bold tracking-[-0.06em] text-zinc-900 dark:bg-gradient-to-b dark:from-white dark:via-zinc-100 dark:to-zinc-400 dark:bg-clip-text dark:text-transparent sm:text-[3rem] lg:text-[4rem]"
            >
              Get in{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
                Touch
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-[520px] text-base leading-8 text-zinc-500 dark:text-zinc-300">
              Have a question about ProdSync? Reach out to the team at Tubelight Mediaworks — we're happy to help.
            </p>
          </section>

          {/* Contact cards */}
          <section className="mx-auto max-w-[680px]" aria-label="Contact information">
            <div className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03] sm:p-8 lg:p-10">
              {/* Ambient glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.14)_0%,_transparent_70%)] dark:opacity-80" />
              <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.12)_0%,_transparent_70%)] dark:opacity-80" />

              <div className="relative z-10 space-y-6">
                {/* Company badge */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black shadow-md">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Company</p>
                    <p className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">Tubelight Mediaworks</p>
                  </div>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-white/8" />

                <div className="space-y-3">
                  {/* Phone */}
                  <a
                    href="tel:+919176011604"
                    className="flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                    aria-label="Call ProdSync support at +91 91760 11604"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Phone</div>
                      <div className="text-sm font-semibold sm:text-base">+91 91760 11604</div>
                    </div>
                  </a>

                  {/* Email */}
                  <a
                    href="mailto:dhruva@tubelightmediaworks.com"
                    className="flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                    aria-label="Email ProdSync at dhruva@tubelightmediaworks.com"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Email</div>
                      <div className="truncate text-sm font-semibold sm:text-base">dhruva@tubelightmediaworks.com</div>
                    </div>
                  </a>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-white/8" />

                {/* Support context */}
                <div className="flex gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">About ProdSync</p>
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      ProdSync is a film production management platform by Tubelight Mediaworks. For questions about
                      your account, production features, pricing, or onboarding — reach out via phone or email above.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => triggerLiquidNav(getStartedRef, '/auth')}
                    className="glow-button inline-flex flex-1 items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black"
                  >
                    Get Started Free
                  </button>
                  <Link
                    to="/pricing"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-200 bg-white/90 px-5 py-3 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-10 border-t border-zinc-200/80 px-4 py-10 dark:border-white/6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm">
              <Link to="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
                  <Clapperboard className="h-4 w-4" />
                </div>
                <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
              </Link>
              <p className="mt-4 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                The Mission Control for Modern Production. Excellence in every frame, precision in every department.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 lg:self-end" aria-label="Footer navigation">
              {navLinks.map(link => (
                <Link key={link.label} to={link.to} className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">
                  {link.label}
                </Link>
              ))}
            </nav>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 lg:self-end">© {new Date().getFullYear()} ProdSync. All rights reserved.</p>
          </div>
        </footer>

        <FooterBranding />
      </div>
    </div>
  )
}
