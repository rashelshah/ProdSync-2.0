import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Clapperboard,
  Phone,
  Mail,
  Building2,
  Users,
  LayoutDashboard,
  Truck,
  Camera,
  UtensilsCrossed,
  MapPin,
  CheckCircle2,
  FileBarChart2,
  Hotel,
  Shirt,
} from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { FooterBranding } from '@/modules/landing/components/FooterBranding'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

const CAPABILITIES = [
  { icon: LayoutDashboard, label: 'Project Management', desc: 'Create and manage production projects with phases, milestones, and planning tools.' },
  { icon: Users, label: 'Crew Planning', desc: 'Schedule and manage crew members across all departments.' },
  { icon: Users, label: 'Cast & Actor Management', desc: 'Manage cast schedules, call times, and logistics for actors.' },
  { icon: FileBarChart2, label: 'Expense & Budget Tracking', desc: 'Track per-department budgets, expenses, and daily wages.' },
  { icon: MapPin, label: 'Location Management', desc: 'Manage shooting locations with maps, permits, and logistics details.' },
  { icon: Truck, label: 'Transport & Logistics', desc: 'Coordinate vehicles, drivers, and transport for crew and cast.' },
  { icon: UtensilsCrossed, label: 'Food & Beverages', desc: 'Plan catering, meal schedules, and food costs per department.' },
  { icon: Hotel, label: 'Accommodation & Travel', desc: 'Manage hotel bookings and travel arrangements for the production.' },
  { icon: Camera, label: 'Camera & Assets', desc: 'Track cameras, equipment, props, and production assets.' },
  { icon: Shirt, label: 'Wardrobe & Makeup', desc: 'Plan and manage wardrobe and makeup for cast and crew.' },
  { icon: CheckCircle2, label: 'Approval Workflows', desc: 'Structured approval workflows for budgets, changes, and decisions.' },
  { icon: FileBarChart2, label: 'Production Reports', desc: 'Generate and export reports for production activity and expenses.' },
]

export function AboutPage() {
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
      <div className="landing-glow pointer-events-none absolute right-0 top-[28rem] hidden h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.2)_0%,_transparent_72%)] dark:block" />

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

          {/* Hero section */}
          <section className="mb-16 text-center sm:mb-20" aria-labelledby="about-heading">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              About ProdSync
            </div>

            <h1
              id="about-heading"
              className="mx-auto max-w-[820px] text-balance text-[2.2rem] font-bold tracking-[-0.06em] text-zinc-900 dark:bg-gradient-to-b dark:from-white dark:via-zinc-100 dark:to-zinc-400 dark:bg-clip-text dark:text-transparent sm:text-[3rem] lg:text-[4rem]"
            >
              The Mission Control for Modern{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
                Production
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-[640px] text-base leading-8 text-zinc-500 dark:text-zinc-300 sm:text-lg">
              ProdSync is a production management platform built to simplify and organize film production workflows — from planning and crew coordination to logistics, expenses, approvals, and reporting.
            </p>
          </section>

          {/* About card */}
          <section className="mb-16" aria-label="About ProdSync details">
            <div className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03] sm:p-8 lg:p-10">
              {/* Ambient glows */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.14)_0%,_transparent_70%)] dark:opacity-80" />
              <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.12)_0%,_transparent_70%)] dark:opacity-80" />

              <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-start">
                {/* Description */}
                <div className="space-y-6 lg:col-span-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black shadow-md">
                      <Clapperboard className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-bold tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-2xl">
                      ProdSync
                    </span>
                  </div>

                  <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-200 sm:text-lg">
                    ProdSync is a production management platform built specifically for film and media production teams.
                    It provides centralized tools to plan, coordinate, and execute every aspect of a production —
                    from pre-production logistics to final wrap.
                  </p>

                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-base">
                    Designed to replace fragmented spreadsheets, email threads, and disconnected tools with a single
                    platform where every department can collaborate in real time. ProdSync gives executive producers,
                    production managers, and department heads full visibility across crew, cast, logistics, budgets,
                    and reports — all in one place.
                  </p>

                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-base">
                    ProdSync is developed by <strong className="text-zinc-700 dark:text-zinc-300">Tubelight Mediaworks</strong>.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      ref={getStartedRef}
                      onClick={() => triggerLiquidNav(getStartedRef, '/auth')}
                      className="glow-button inline-flex items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black"
                    >
                      Get Started Free
                    </button>
                    <Link
                      to="/pricing"
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-white/90 px-5 py-2.5 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                    >
                      View Pricing
                    </Link>
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden lg:col-span-1 lg:flex lg:justify-center lg:pt-2">
                  <div className="h-40 w-px bg-zinc-200 dark:bg-white/10" />
                </div>

                {/* Contact card */}
                <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-5 shadow-sm dark:border-white/8 dark:bg-white/[0.03] lg:col-span-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Tubelight Mediaworks
                    </span>
                  </div>

                  <div className="space-y-3">
                    <a
                      href="tel:+919176011604"
                      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Phone</div>
                        <div className="truncate text-xs font-semibold sm:text-sm">+91 91760 11604</div>
                      </div>
                    </a>

                    <a
                      href="mailto:dhruva@tubelightmediaworks.com"
                      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Email</div>
                        <div className="truncate text-xs font-semibold sm:text-sm">dhruva@tubelightmediaworks.com</div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Capabilities grid */}
          <section aria-labelledby="capabilities-heading">
            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                What ProdSync Does
              </div>
              <h2 id="capabilities-heading" className="text-[1.6rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.2rem]">
                Granular Control for Every{' '}
                <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
                  Department
                </span>
              </h2>
              <p className="mt-3 max-w-[560px] text-sm leading-7 text-zinc-500 dark:text-zinc-300 sm:text-base">
                Built for the complexities of professional filmmaking — from fleet logistics to crew payroll.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-zinc-200/90 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-orange-500/30 hover:shadow-md dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-orange-500/30"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mb-1.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">{label}</h3>
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
                </article>
              ))}
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
