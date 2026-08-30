import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Shield } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { FooterBranding } from '@/modules/landing/components/FooterBranding'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

const LAST_UPDATED = '30 August 2026'

function PolicySection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-3">
      <h2 id={`${id}-heading`} className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white sm:text-xl">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base sm:leading-8">
        {children}
      </div>
    </section>
  )
}

export function PrivacyPage() {
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
        <main className="mx-auto w-full max-w-[860px] px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pt-20 flex-1">

          {/* Hero */}
          <section className="mb-10 text-center sm:mb-12" aria-labelledby="privacy-heading">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Privacy Policy
            </div>

            <h1
              id="privacy-heading"
              className="mx-auto max-w-[720px] text-balance text-[2.2rem] font-bold tracking-[-0.06em] text-zinc-900 dark:bg-gradient-to-b dark:from-white dark:via-zinc-100 dark:to-zinc-400 dark:bg-clip-text dark:text-transparent sm:text-[3rem] lg:text-[3.5rem]"
            >
              Privacy{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
                Policy
              </span>
            </h1>

            <p className="mx-auto mt-4 text-sm text-zinc-400 dark:text-zinc-500">
              Last updated: {LAST_UPDATED}
            </p>
          </section>

          {/* Notice banner */}
          <div className="mb-8 flex gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 dark:border-orange-500/10 dark:bg-orange-500/[0.07]">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              <strong className="text-zinc-800 dark:text-zinc-200">Note:</strong> ProdSync is a B2B SaaS platform for professional production teams.
              This policy describes how we handle information when you use ProdSync.
              Sections marked <em>[Requires Legal Review]</em> should be finalized with qualified legal counsel
              before publication as a binding policy.
            </p>
          </div>

          {/* Policy content */}
          <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03] sm:p-8 lg:p-10">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.10)_0%,_transparent_70%)] dark:opacity-80" />

            <div className="relative z-10 space-y-10">

              <PolicySection id="introduction" title="1. Introduction">
                <p>
                  ProdSync ("we", "our", or "us") is a production management platform developed by Tubelight Mediaworks.
                  This Privacy Policy explains how we collect, use, and protect information when you access or use ProdSync
                  at <a href="https://prodsync.in" className="text-orange-500 hover:underline">prodsync.in</a>.
                </p>
                <p>
                  By using ProdSync, you agree to the practices described in this policy.
                  If you do not agree, please discontinue use of the platform.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="information-collected" title="2. Information We Collect">
                <p>We collect the following categories of information:</p>
                <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300">
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Account information</strong> — name, email address,
                    and credentials provided when you register or log in via Google OAuth or email/password.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Production data</strong> — project information,
                    crew details, scheduling data, expense records, logistics, and other production-related content
                    that you or your team enter into ProdSync. This data belongs to you and your organization.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Usage data</strong> — information about how you
                    interact with the platform, including pages visited, features used, and actions taken. This is used
                    to improve the product.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Technical data</strong> — IP address, browser type,
                    device information, and similar technical signals collected automatically when you access the platform.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Uploaded files</strong> — files, documents, and images
                    you upload to the platform (e.g., call sheets, location photos, expense receipts).
                  </li>
                </ul>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="how-we-use" title="3. How We Use Your Information">
                <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300">
                  <li>To provide, operate, and maintain the ProdSync platform.</li>
                  <li>To authenticate your account and manage access control within your production team.</li>
                  <li>To process and display production data you and your team enter.</li>
                  <li>To communicate with you about your account, product updates, or support requests.</li>
                  <li>To analyze and improve ProdSync features and user experience.</li>
                  <li>To detect and prevent fraud, abuse, or unauthorized access.</li>
                </ul>
                <p>
                  We do not sell your personal data to third parties. We do not use your production data for
                  advertising purposes.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="data-storage" title="4. Data Storage and Security">
                <p>
                  ProdSync uses Supabase as its database and authentication backend. Your data is stored on
                  Supabase-managed infrastructure. We apply reasonable technical and organizational measures
                  to protect your data from unauthorized access, disclosure, or loss.
                </p>
                <p>
                  Authentication is handled via Supabase Auth, supporting email/password and Google OAuth.
                  User sessions and tokens are managed securely.
                </p>
                <p className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-400">
                  <em>[Requires Legal Review]</em> Specific data retention periods, backup policies, breach notification procedures,
                  and infrastructure security certifications should be confirmed and documented here with qualified legal and technical guidance.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="cookies" title="5. Cookies and Local Storage">
                <p>
                  ProdSync uses browser local storage and session storage to maintain your authentication state,
                  theme preferences, and application settings. These are necessary for the platform to function correctly.
                </p>
                <p>
                  We may use cookies for session management. We do not use advertising or tracking cookies.
                  Third-party services integrated into the platform (see section 6) may set their own cookies
                  according to their respective privacy policies.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="third-party" title="6. Third-Party Services">
                <p>ProdSync integrates with the following third-party services:</p>
                <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300">
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Supabase</strong> — database, authentication,
                    and file storage. Governed by <a href="https://supabase.com/privacy" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">Supabase's Privacy Policy</a>.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Google OAuth</strong> — for sign-in with Google.
                    Governed by <a href="https://policies.google.com/privacy" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-200">Mapbox</strong> — for location mapping features.
                    Governed by <a href="https://www.mapbox.com/legal/privacy" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">Mapbox's Privacy Policy</a>.
                  </li>
                </ul>
                <p>
                  We are not responsible for the privacy practices of these third-party providers.
                  We recommend reviewing their respective policies.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="data-sharing" title="7. Data Sharing">
                <p>
                  We do not sell, rent, or share your personal data with unaffiliated third parties for their
                  marketing purposes.
                </p>
                <p>
                  We may share data in limited circumstances:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300">
                  <li>With service providers who assist in operating the platform (e.g., Supabase).</li>
                  <li>If required by law, court order, or valid legal process.</li>
                  <li>To protect the rights, property, or safety of ProdSync, its users, or the public.</li>
                </ul>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="your-rights" title="8. Your Rights">
                <p>
                  You may have rights regarding your personal data depending on your jurisdiction. These may include
                  the right to access, correct, or delete your personal data, and the right to withdraw consent
                  where processing is based on consent.
                </p>
                <p>
                  To exercise any of these rights, or if you have questions about your data, please contact us at:
                </p>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <p><strong className="text-zinc-700 dark:text-zinc-300">Tubelight Mediaworks</strong></p>
                  <p>Email: <a href="mailto:dhruva@tubelightmediaworks.com" className="text-orange-500 hover:underline">dhruva@tubelightmediaworks.com</a></p>
                  <p>Phone: <a href="tel:+919176011604" className="text-orange-500 hover:underline">+91 91760 11604</a></p>
                </div>
                <p className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-400">
                  <em>[Requires Legal Review]</em> Specific regulatory compliance (GDPR, DPDPA, CCPA, etc.) and formal
                  data subject request procedures should be confirmed with qualified legal counsel for your jurisdiction.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="children" title="9. Children's Privacy">
                <p>
                  ProdSync is a professional B2B platform not intended for use by individuals under the age of 18.
                  We do not knowingly collect personal data from minors. If you believe we have inadvertently
                  collected such information, please contact us so we can remove it.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="changes" title="10. Changes to This Policy">
                <p>
                  We may update this Privacy Policy from time to time. When we make material changes, we will
                  update the "Last updated" date at the top of this page. We encourage you to review this policy
                  periodically.
                </p>
                <p>
                  Continued use of ProdSync after any changes constitutes your acceptance of the updated policy.
                </p>
              </PolicySection>

              <div className="h-px bg-zinc-200 dark:bg-white/8" />

              <PolicySection id="contact-privacy" title="11. Contact">
                <p>
                  For any questions about this Privacy Policy or how we handle your data, contact us:
                </p>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <p><strong className="text-zinc-700 dark:text-zinc-300">Tubelight Mediaworks</strong></p>
                  <p>Email: <a href="mailto:dhruva@tubelightmediaworks.com" className="text-orange-500 hover:underline">dhruva@tubelightmediaworks.com</a></p>
                  <p>Phone: <a href="tel:+919176011604" className="text-orange-500 hover:underline">+91 91760 11604</a></p>
                </div>
              </PolicySection>

            </div>
          </div>
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
