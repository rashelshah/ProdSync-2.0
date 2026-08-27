import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Flame,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import {
  FEATURE_COMPARISON,
  PRICING_FAQS,
  PRICING_PLANS,
  type PricingPlan,
} from '@/modules/landing/data/pricingConfig'
import { FooterBranding } from '@/modules/landing/components/FooterBranding'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

function PricingCard({ plan }: { plan: PricingPlan }) {
  const { triggerLiquidNav } = useLiquidTransition()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isProPlus = plan.id === 'pro-plus'
  const isPro = plan.recommended

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-[30px] p-6 sm:p-8 transition-all duration-300 ${
        isProPlus
          ? 'border-2 border-orange-500/80 bg-gradient-to-br from-[#1c0d06] via-[#150a1b] to-[#0b0c0e] text-white shadow-[0_0_35px_rgba(249,115,22,0.3)] backdrop-blur-2xl dark:border-amber-500/70 dark:from-[#240e04] dark:via-[#190c23] dark:to-[#0a0a0d] lg:-translate-y-2'
          : isPro
          ? 'border-2 border-orange-500/70 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-orange-500/50 dark:bg-[#110d18]/90 lg:-translate-y-2'
          : 'border border-zinc-200 bg-white/80 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03]'
      }`}
    >
      {/* Lava Flow Ambient Effect for Pro Plus */}
      {isProPlus && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.28),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(234,88,12,0.22),transparent_65%)] opacity-90 animate-pulse" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(251,146,60,0.25)_0%,_transparent_70%)] blur-xl" />
        </>
      )}

      {/* Ambient Glow for Recommended Plan */}
      {isPro && (
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.18)_0%,_transparent_70%)] dark:opacity-80" />
      )}

      <div className="relative z-10 space-y-6">
        {/* Header & Badges */}
        <div className="flex items-center justify-between">
          <h3 className={`text-2xl font-bold tracking-tight sm:text-3xl ${isProPlus ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
            {plan.name}
          </h3>
          {isPro ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black shadow-sm">
              <Sparkles className="h-3 w-3" />
              {plan.recommendedLabel || 'Recommended'}
            </span>
          ) : null}
        </div>

        <p className={`text-xs leading-relaxed ${isProPlus ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {plan.tagline}
        </p>

        {/* Pricing Display Placeholder */}
        <div className={`border-b pb-4 pt-1 ${isProPlus ? 'border-orange-500/25' : 'border-zinc-200/80 dark:border-white/8'}`}>
          <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider ${
            isProPlus
              ? 'border-orange-500/40 bg-orange-500/15 text-orange-300 shadow-inner'
              : 'border-zinc-200/80 bg-zinc-100/90 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200'
          }`}>
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            {plan.pricePlaceholder}
          </div>
        </div>

        {/* Plan Limits & Benefits List */}
        <ul className="space-y-3.5 pt-1">
          {plan.benefits.map((benefit, index) => (
            <li key={index} className={`flex items-start gap-3 text-xs sm:text-sm ${isProPlus ? 'text-zinc-100' : 'text-zinc-700 dark:text-zinc-200'}`}>
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-orange-500" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 space-y-4 pt-8">
        {plan.trialText ? (
          <div className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            isProPlus
              ? 'border-orange-500/30 bg-orange-500/15 text-orange-300'
              : 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400'
          }`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{plan.trialText}</span>
          </div>
        ) : (
          <div className="h-6" />
        )}

        {/* Action Button following Global CTA Design Token System */}
        <button
          ref={buttonRef}
          onClick={() => triggerLiquidNav(buttonRef, '/auth')}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99] ${
            isProPlus
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black hover:-translate-y-[1px] hover:shadow-lg hover:shadow-orange-500/35 focus-visible:ring-orange-500/50 font-extrabold'
              : isPro
              ? 'bg-orange-500 text-black hover:-translate-y-[1px] hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/20 focus-visible:ring-orange-500/40'
              : 'border border-zinc-200 bg-white text-zinc-900 hover:-translate-y-[1px] hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:ring-orange-500/40'
          }`}
        >
          {plan.ctaText}
        </button>
      </div>
    </div>
  )
}

function FaqAccordionItem({ faq }: { faq: typeof PRICING_FAQS[0] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-[22px] border border-zinc-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition-colors dark:border-white/8 dark:bg-white/[0.03]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-base">
          {faq.question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>
      {isOpen && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-sm">
          {faq.answer}
        </p>
      )}
    </div>
  )
}

export function PricingPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { triggerLiquidNav } = useLiquidTransition()
  const [showComparison, setShowComparison] = useState(false)
  const navGetStartedRef = useRef<HTMLButtonElement>(null)
  const ctaGetStartedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.title = 'ProdSync Pricing | Mission Control for Modern Production'
    window.scrollTo(0, 0)
  }, [])

  const navLinks = useMemo(
    () => [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/#features' },
      { label: 'Modules', href: '/#modules' },
      { label: 'Pricing', href: '/pricing', active: true },
      { label: 'About', href: '/#about' },
    ],
    [],
  )

  return (
    <div className="landing-shell min-h-screen">
      <div className="pointer-events-none absolute inset-0 hidden opacity-70 dark:block landing-grid" />
      <div className="landing-glow pointer-events-none absolute left-1/2 top-20 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.24)_0%,_rgba(249,115,22,0.2)_42%,_transparent_72%)] dark:opacity-100" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        {/* Navigation Header */}
        <header className="landing-enter sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1380px] items-center justify-between rounded-full border border-zinc-200/80 bg-white/75 px-4 py-3 shadow-soft backdrop-blur-xl dark:border-white/6 dark:bg-white/[0.03] 2xl:max-w-[1460px]">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
                <Clapperboard className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              {navLinks.map(link => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    link.active
                      ? 'font-semibold text-orange-500 dark:text-orange-400'
                      : 'text-zinc-500 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400'
                  }`}
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
                ref={navGetStartedRef}
                onClick={() => triggerLiquidNav(navGetStartedRef, '/auth')}
                className="glow-button inline-flex items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black"
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          {/* Back to Home Link */}
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Hero Title Header */}
          <div className="mb-12 text-center sm:mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Pricing Plans
            </div>

            <h1 className="text-[2.2rem] font-bold tracking-[-0.06em] text-zinc-900 dark:text-white sm:text-[3.25rem]">
              Choose the Plan That Fits Your <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">Production</span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-[0.98rem] leading-7 text-zinc-500 dark:text-zinc-300 sm:text-[1.05rem]">
              Flexible capacity designed for film production teams — from indie projects to multi-unit studio shoots.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-8">
            {PRICING_PLANS.map(plan => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>

          {/* Glowing Compare All Plans Button */}
          <div className="mt-16 text-center">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="glow-button inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-zinc-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_22px_rgba(249,115,22,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-orange-400 hover:bg-zinc-800 hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] active:scale-[0.99] dark:border-orange-500/50 dark:bg-zinc-900 dark:text-white"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-orange-400" />
              <span>{showComparison ? 'Hide Plan Comparison' : 'Compare All Plans'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showComparison ? 'rotate-180 text-orange-400' : ''}`} />
            </button>
          </div>

          {/* Feature Comparison Content */}
          {showComparison && (
            <div className="mt-8 overflow-hidden rounded-[30px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-[#110d18]/90">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/10">
                      <th className="pb-4 text-base font-bold text-zinc-900 dark:text-white">Features</th>
                      <th className="pb-4 text-center font-bold text-zinc-900 dark:text-white">Go</th>
                      <th className="pb-4 text-center font-bold text-orange-500">Pro (Recommended)</th>
                      <th className="pb-4 text-center font-bold text-amber-500">Pro Plus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-white/6">
                    {FEATURE_COMPARISON.map(group => (
                      <tr key={group.category} className="contents">
                        <tr className="bg-zinc-50 dark:bg-white/[0.02]">
                          <td colSpan={4} className="px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {group.category}
                          </td>
                        </tr>
                        {group.features.map(feature => (
                          <tr key={feature.name} className="transition-colors hover:bg-zinc-50/60 dark:hover:bg-white/[0.01]">
                            <td className="px-2 py-3 font-medium text-zinc-900 dark:text-zinc-200">{feature.name}</td>
                            <td className="px-2 py-3 text-center text-zinc-600 dark:text-zinc-400">
                              {typeof feature.go === 'boolean' ? (
                                feature.go ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                              ) : (
                                feature.go
                              )}
                            </td>
                            <td className="px-2 py-3 text-center font-semibold text-zinc-900 dark:text-white">
                              {typeof feature.pro === 'boolean' ? (
                                feature.pro ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                              ) : (
                                feature.pro
                              )}
                            </td>
                            <td className="px-2 py-3 text-center font-semibold text-amber-400">
                              {typeof feature.proPlus === 'boolean' ? (
                                feature.proPlus ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                              ) : (
                                feature.proPlus
                              )}
                            </td>
                          </tr>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Frequently Asked Questions Section */}
          <div className="mt-20 sm:mt-24">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                Common questions about ProdSync plans, department limits, and trial access.
              </p>
            </div>

            <div className="mx-auto max-w-3xl space-y-4">
              {PRICING_FAQS.map(faq => (
                <FaqAccordionItem key={faq.question} faq={faq} />
              ))}
            </div>
          </div>

          {/* Final Bottom CTA Section */}
          <div className="mt-20 overflow-hidden rounded-[36px] border border-zinc-200/80 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] sm:p-12">
            <div className="mx-auto max-w-2xl space-y-5">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Ready to Streamline Your Film Production?
              </h2>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-300 sm:text-sm">
                Get started today and bring mission control to your projects, departments, crew, and logistics.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  ref={ctaGetStartedRef}
                  onClick={() => triggerLiquidNav(ctaGetStartedRef, '/auth')}
                  className="glow-button inline-flex items-center rounded-full bg-orange-500 px-7 py-3.5 text-sm font-semibold text-black"
                >
                  Get Started
                </button>
                <Link
                  to="/"
                  className="glow-button inline-flex items-center rounded-full border border-zinc-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer id="footer" className="border-t border-zinc-200/80 px-4 py-10 dark:border-white/6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between 2xl:max-w-[1520px]">
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

            <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 lg:self-end">
              {navLinks.map(link => (
                <Link key={link.label} to={link.href} className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">
                  {link.label}
                </Link>
              ))}
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 lg:self-end">© 2026 ProdSync. All rights reserved.</p>
          </div>
        </footer>

        <FooterBranding />
      </div>
    </div>
  )
}
