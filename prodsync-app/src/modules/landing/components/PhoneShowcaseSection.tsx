/**
 * PhoneShowcaseSection — iPhone PWA Showcase
 * ──────────────────────────────────────────────────────────────────────────────
 * A premium marketing section placed after the CircularGallery.
 *
 * - CSS-only iPhone 14 Pro Max frame (no external assets required)
 * - Framer Motion AnimatePresence for left-swipe screen transitions
 * - Auto-cycles through all 6 module screens every 2.5 s
 * - Subtle floating animation on the device
 * - Responsive: side-by-side (desktop) → stacked (mobile)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Wifi, BatteryFull, Signal } from 'lucide-react'
import { phoneGallery } from '@/config/phoneGallery'

// ─── Slide transition variants ────────────────────────────────────────────────
const slideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
}

const slideTransition = {
  duration: 0.42,
  ease: [0.32, 0.72, 0, 1] as const,
}

// ─── Status bar time ──────────────────────────────────────────────────────────
function useTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  )
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PhoneShowcaseSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const time = useTime()

  // Auto-advance every 2.5 s
  useEffect(() => {
    const id = setInterval(() => {
      setDirection(1)
      setActiveIndex((i) => (i + 1) % phoneGallery.length)
    }, 2500)
    return () => clearInterval(id)
  }, [])

  const current = phoneGallery[activeIndex]

  return (
    <section
      id="pwa"
      data-reveal
      className="reveal-section scroll-mt-32 pt-20 sm:pt-24 lg:pt-32"
    >
      <div className="flex flex-col-reverse items-center gap-12 sm:gap-16 lg:flex-row lg:items-center lg:gap-20">

        {/* ── LEFT: Copy ─────────────────────────────────────────────────── */}
        <div className="flex-1 w-full text-center lg:text-left">
          {/* Eyebrow badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            PWA · Works on Any Device
          </div>

          {/* Headline */}
          <h2 className="max-w-[560px] mx-auto lg:mx-0 text-[1.85rem] sm:text-[2.1rem] font-bold tracking-[-0.06em] text-zinc-900 dark:text-white lg:text-[2.65rem] lg:leading-[1.06]">
            Phone{' '}
            <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
              Optimised
            </span>{' '}
            <br className="hidden sm:block" />
            for Your Crew
          </h2>

          {/* Description */}
          <p className="mx-auto mt-5 max-w-[500px] text-[0.95rem] leading-7 text-zinc-500 dark:text-zinc-300 lg:mx-0">
            Every crew member on set gets instant access to call sheets, approvals,
            and gear check-ins — directly on their phone. No app store required.
            Install once, use everywhere on any device.
          </p>

          {/* Slide indicator dots */}
          <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
            {phoneGallery.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > activeIndex ? 1 : -1)
                  setActiveIndex(i)
                }}
                aria-label={`Show ${phoneGallery[i].label}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === activeIndex ? '24px' : '6px',
                  backgroundColor: i === activeIndex ? current.accent : '#a1a1aa',
                }}
              />
            ))}
          </div>

          {/* Active module name */}
          <p
            className="mt-4 text-[0.82rem] font-semibold uppercase tracking-[0.18em] transition-colors duration-500"
            style={{ color: current.accent }}
          >
            {current.label}
          </p>
        </div>

        {/* ── RIGHT: iPhone frame ─────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-center justify-center">
          <PhoneFrame activeIndex={activeIndex} direction={direction} time={time} />
        </div>
      </div>
    </section>
  )
}

// ─── iPhone 14 Pro Max CSS Frame ──────────────────────────────────────────────
interface PhoneFrameProps {
  activeIndex: number
  direction: number
  time: string
}

function PhoneFrame({ activeIndex, direction, time }: PhoneFrameProps) {
  const current = phoneGallery[activeIndex]

  return (
    // Floating wrapper — subtle sinusoidal lift
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative phone-showcase-frame"
      style={{
        // Realistic phone shadow
        filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.35)) drop-shadow(0 8px 20px rgba(0,0,0,0.2))',
      }}
    >
      {/*
        iPhone 16 Pro Max shell
        Physical size: 163.0 × 77.6 mm → ratio ≈ 2.1 : 1
        CSS: height 640px → width ≈ 328px
      */}
      <div
        className="relative overflow-hidden"
        style={{
          width: '328px',
          height: '640px',
          borderRadius: '56px',
          background: 'linear-gradient(160deg, #2d2d2f 0%, #1a1a1c 40%, #0d0d0e 100%)',
          boxShadow: [
            'inset 0 0 0 1.5px rgba(255,255,255,0.12)',     // inner rim highlight
            'inset 0 1px 0 rgba(255,255,255,0.18)',           // top sheen
            '0 0 0 1px rgba(0,0,0,0.8)',                      // outer edge
          ].join(', '),
        }}
      >
        {/* Side button accents (left) */}
        <div className="pointer-events-none absolute -left-[3px] top-[130px] h-[34px] w-[3px] rounded-l-md bg-zinc-600" />
        <div className="pointer-events-none absolute -left-[3px] top-[180px] h-[64px] w-[3px] rounded-l-md bg-zinc-600" />
        <div className="pointer-events-none absolute -left-[3px] top-[256px] h-[64px] w-[3px] rounded-l-md bg-zinc-600" />
        {/* Side button accents (right) */}
        <div className="pointer-events-none absolute -right-[3px] top-[180px] h-[96px] w-[3px] rounded-r-md bg-zinc-600" />

        {/* Screen area — slightly inset from the shell */}
        <div
          className="absolute overflow-hidden bg-black"
          style={{
            inset: '8px',
            borderRadius: '48px',
          }}
        >
          {/* Status bar */}
          <div className="relative z-20 flex h-11 items-center justify-between px-6 pt-1">
            <span className="text-[12px] font-semibold text-white">{time}</span>

            {/* Dynamic Island */}
            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 bg-black"
              style={{
                width: '120px',
                height: '36px',
                borderRadius: '20px',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              {/* Tiny camera/sensor dots inside island */}
              <div className="absolute right-[20px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
              <div className="absolute right-[36px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-zinc-900" />
            </div>

            <div className="flex items-center gap-1.5">
              <Signal className="h-3 w-3 text-white" strokeWidth={2} />
              <Wifi className="h-3 w-3 text-white" strokeWidth={2} />
              <BatteryFull className="h-3.5 w-3.5 text-white" strokeWidth={2} />
            </div>
          </div>

          {/* Slide-transitioning screen content */}
          <div className="absolute inset-0 top-11">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.div
                key={activeIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="absolute inset-0"
              >
                {/* Screenshot image */}
                <img
                  src={current.image}
                  alt={current.label}
                  className="h-full w-full object-cover object-top"
                  draggable={false}
                  onError={(e) => {
                    // Graceful fallback: show a branded placeholder if image missing
                    const target = e.currentTarget
                    target.style.display = 'none'
                    const sibling = target.nextElementSibling as HTMLElement | null
                    if (sibling) sibling.style.display = 'flex'
                  }}
                />

                {/* Placeholder shown only when image fails to load */}
                <div
                  className="absolute inset-0 hidden flex-col items-center justify-center gap-4 p-6"
                  style={{
                    background: `linear-gradient(160deg, #18181b 0%, #0f0f10 100%)`,
                    display: 'none',
                  }}
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-[20px] text-2xl"
                    style={{ backgroundColor: `${current.accent}22` }}
                  >
                    📱
                  </div>
                  <p className="text-center text-[0.78rem] font-semibold text-white" style={{ color: current.accent }}>
                    {current.label}
                  </p>
                  <p className="text-center text-[0.7rem] text-zinc-500">
                    Drop screenshot in{'\n'}/public/phone/
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom home indicator bar */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/30" />
        </div>

        {/* Subtle inner lens flare on top-left corner */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-48 w-48 rounded-[52px]"
          style={{
            background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }}
        />
      </div>
    </motion.div>
  )
}
