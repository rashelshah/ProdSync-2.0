import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring } from 'motion/react'
import type { SpringOptions } from 'motion/react'
import {
  Clapperboard,
  Play,
} from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { TimelineSection } from '@/modules/landing/components/TimelineSection'
import CircularGallery from '@/components/ui/CircularGallery'
import { modulesGallery } from '@/config/modulesGallery'
import { PhoneShowcaseSection } from '@/modules/landing/components/PhoneShowcaseSection'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

function useRevealMotion() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.18, rootMargin: '0px 0px -10% 0px' },
    )

    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])
}

function useParallaxMotion() {
  const previewRef = useRef<HTMLDivElement | null>(null)
  const heroGlowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let raf = 0

    const update = () => {
      const scrollY = window.scrollY

      if (previewRef.current) {
        previewRef.current.style.transform = `translate3d(0, ${Math.min(scrollY * 0.08, 36)}px, 0) scale(${1 - Math.min(scrollY * 0.00008, 0.03)})`
      }

      if (heroGlowRef.current) {
        heroGlowRef.current.style.transform = `translate3d(0, ${Math.min(scrollY * -0.04, 0)}px, 0)`
      }

      raf = 0
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return { previewRef, heroGlowRef }
}

const previewSpring: SpringOptions = { damping: 30, stiffness: 100, mass: 2 }

export function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const { previewRef, heroGlowRef } = useParallaxMotion()
  useRevealMotion()
  const [previewImageFailed, setPreviewImageFailed] = useState(false)

  // Tilt spring values for the whole preview shell
  const tiltX = useSpring(useMotionValue(0), previewSpring)
  const tiltY = useSpring(useMotionValue(0), previewSpring)
  const tiltScale = useSpring(1, previewSpring)

  function handleShellMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ox = e.clientX - rect.left - rect.width / 2
    const oy = e.clientY - rect.top - rect.height / 2
    tiltX.set((oy / (rect.height / 2)) * -7)
    tiltY.set((ox / (rect.width / 2)) * 7)
  }

  function handleShellMouseEnter() {
    tiltScale.set(1.025)
  }

  function handleShellMouseLeave() {
    tiltX.set(0)
    tiltY.set(0)
    tiltScale.set(1)
  }

  const sectionLinks = useMemo(
    () => [
      { label: 'Features', href: '#features' },
      { label: 'Modules', href: '#modules' },
      { label: 'Pricing', href: '#cta' },
      { label: 'About', href: '#footer' },
    ],
    [],
  )
  const previewImageSrc = theme === 'light' ? '/landing/site-preview-light.png' : '/landing/site-preview-dark.png'

  // ── Liquid transition ──────────────────────────────────────────────────────
  const { triggerLiquidNav } = useLiquidTransition()
  const navGetStartedRef = useRef<HTMLButtonElement>(null)
  const heroGetStartedRef = useRef<HTMLButtonElement>(null)
  const ctaGetStartedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPreviewImageFailed(false)
  }, [theme])

  return (
    <div className="landing-shell">
      <div className="pointer-events-none absolute inset-0 hidden opacity-70 dark:block landing-grid" />
      <div
        ref={heroGlowRef}
        className="landing-glow pointer-events-none absolute left-1/2 top-20 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.24)_0%,_rgba(249,115,22,0.2)_42%,_transparent_72%)] dark:opacity-100"
      />
      <div className="landing-glow pointer-events-none absolute right-0 top-[28rem] hidden h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.2)_0%,_transparent_72%)] dark:block" />
      <div className="landing-glow pointer-events-none absolute left-0 top-[58rem] hidden h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.16)_0%,_transparent_72%)] dark:block" />
      <div className="shuttle-orb pointer-events-none absolute top-28 hidden h-1.5 w-32 rounded-full bg-gradient-to-r from-transparent via-orange-400 to-transparent blur-[1px] dark:block" />

      <div className="relative z-10">
        <header className="landing-enter sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1380px] items-center justify-between rounded-full border border-zinc-200/80 bg-white/75 px-4 py-3 shadow-soft backdrop-blur-xl dark:border-white/6 dark:bg-white/[0.03] 2xl:max-w-[1460px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
                <Clapperboard className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
            </div>

            <nav className="hidden items-center gap-8 md:flex">
              {sectionLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-zinc-500 transition-colors hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400"
                >
                  {link.label}
                </a>
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

        <main className="mx-auto max-w-[1400px] px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:pb-22 lg:pt-14 2xl:max-w-[1480px]">
          <section className="landing-enter relative flex min-h-[78vh] flex-col items-center justify-center py-8 text-center lg:min-h-[86vh] lg:py-16">
            <div className="reveal-section is-visible flex max-w-[1040px] flex-col items-center lg:-translate-y-6">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Built for Film & Production Teams
              </div>

              <h1 className="max-w-[1040px] text-balance text-5xl font-bold tracking-[-0.07em] text-zinc-900 dark:bg-gradient-to-b dark:from-white dark:via-zinc-100 dark:to-zinc-500 dark:bg-clip-text dark:text-transparent sm:text-[3.65rem] lg:text-[6.2rem] lg:leading-[0.94]">
                The Mission Control for Modern <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">Production</span>
              </h1>

              <p className="mt-7 max-w-[680px] text-[1.02rem] leading-7 text-zinc-500 dark:text-zinc-300">
                Plan, track, and execute film production with full visibility across departments. From logistics to final wrap, everything in one cinematic view.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <button
                  ref={heroGetStartedRef}
                  onClick={() => triggerLiquidNav(heroGetStartedRef, '/auth')}
                  className="glow-button inline-flex items-center rounded-full bg-orange-500 px-7 py-3.5 text-[0.98rem] font-semibold text-black"
                >
                  Get Started
                </button>
                <a
                  href="#preview"
                  className="glow-button inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-7 py-3.5 text-[0.98rem] font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                >
                  <Play className="h-4 w-4" />
                  View Demo
                </a>
              </div>
            </div>
          </section>

          <section id="preview" data-reveal className="reveal-section scroll-mt-32 pt-6 lg:pt-12">
            {/* Outer div: parallax scroll transform lives here via previewRef */}
            <div
              ref={previewRef}
              className="mx-auto w-full max-w-[1180px]"
              style={{ perspective: '1200px' }}
            >
              {/* motion.div: 3D tilt — the entire shell rotates as one unit */}
              <motion.div
                className="hero-preview-shell relative w-full overflow-hidden rounded-[38px] border border-zinc-200 bg-zinc-950 p-3 dark:border-white/8"
                style={{
                  rotateX: tiltX,
                  rotateY: tiltY,
                  scale: tiltScale,
                  transformStyle: 'preserve-3d',
                }}
                onMouseMove={handleShellMouseMove}
                onMouseEnter={handleShellMouseEnter}
                onMouseLeave={handleShellMouseLeave}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[38px] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_right,rgba(99,102,241,0.16),transparent_28%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.18),transparent_32%)]" />
                <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="aspect-video w-full">
                    {!previewImageFailed ? (
                      <img
                        src={previewImageSrc}
                        alt="ProdSync Dashboard Preview"
                        className="h-full w-full object-cover object-center"
                        onError={() => setPreviewImageFailed(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(22,29,35,0.98),rgba(11,16,20,0.98))] p-6">
                        <div className="grid h-full w-full grid-cols-[88px_1fr] gap-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
                          <div className="rounded-[20px] bg-white/[0.03] p-3">
                            {Array.from({ length: 8 }).map((_, index) => (
                              <div key={index} className="mb-3 h-3 rounded-full bg-white/[0.08] last:mb-0" />
                            ))}
                          </div>
                          <div className="rounded-[22px] bg-[linear-gradient(180deg,rgba(39,60,68,0.95),rgba(16,24,28,0.96))] p-4">
                            <div className="space-y-3">
                              {Array.from({ length: 9 }).map((_, index) => (
                                <div key={index} className="grid grid-cols-[120px_1fr_28px] items-center gap-4 rounded-2xl bg-black/20 px-4 py-4">
                                  <div className="h-3 rounded-full bg-white/10" />
                                  <div className="h-3 rounded-full bg-white/8" />
                                  <div className="h-3 rounded-full bg-white/10" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <TimelineSection />

          <section id="modules" data-reveal className="reveal-section scroll-mt-32 pt-24 lg:pt-32">
            {/* Section header */}
            <div className="mb-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Modules
              </div>
              <h2 className="max-w-[660px] text-[2.15rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.75rem]">
                Granular Control for Every <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">Department</span>
              </h2>
              <p className="mt-4 max-w-[560px] text-[1rem] leading-7 text-zinc-500 dark:text-zinc-300">
                Built for the complexities of professional filmmaking — from fleet logistics to crew payroll.
              </p>
            </div>

            {/* CircularGallery — drag / scroll to explore all 6 modules */}
            <div style={{ height: '500px', position: 'relative', filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.45))' }}>
              <CircularGallery
                items={modulesGallery}
                bend={1}
                textColor={theme === 'dark' ? '#ffffff' : '#111111'}
                borderRadius={0.08}
                scrollSpeed={2}
                scrollEase={0.05}
              />
            </div>
          </section>

          <PhoneShowcaseSection />

          <section id="cta" data-reveal className="reveal-section scroll-mt-32 pt-24 lg:pt-32">
            <div className="overflow-hidden rounded-[38px] bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(249,115,22,0.08))] px-6 py-10 shadow-soft dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(249,115,22,0.18))] sm:px-9 lg:px-14 lg:py-14">
              <div className="mx-auto max-w-[720px] text-center">
                <h2 className="text-[2.2rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.95rem]">
                  Ready for your next feature?
                </h2>
                <p className="mx-auto mt-5 max-w-[600px] text-[1.02rem] leading-7 text-zinc-500 dark:text-zinc-300">
                  Join the world&apos;s leading production houses and switch to the only mission control system designed for cinema.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <button
                    ref={ctaGetStartedRef}
                    onClick={() => triggerLiquidNav(ctaGetStartedRef, '/auth')}
                    className="glow-button inline-flex items-center rounded-full bg-orange-500 px-7 py-3.5 text-[0.98rem] font-semibold text-black"
                  >
                    Get Started for Free
                  </button>
                  <a href="#preview" className="glow-button inline-flex items-center rounded-full bg-zinc-900 px-7 py-3.5 text-[0.98rem] font-semibold text-white dark:bg-white dark:text-zinc-900">
                    Schedule a Demo
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer id="footer" className="mt-10 border-t border-zinc-200/80 px-4 py-10 dark:border-white/6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between 2xl:max-w-[1520px]">
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
                  <Clapperboard className="h-4 w-4" />
                </div>
                <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                The Mission Control for Modern Production. Excellence in every frame, precision in every department.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 lg:self-end">
              {sectionLinks.map(link => (
                <a key={link.label} href={link.href} className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">
                  {link.label}
                </a>
              ))}
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 lg:self-end">© 2024 ProdSync. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
