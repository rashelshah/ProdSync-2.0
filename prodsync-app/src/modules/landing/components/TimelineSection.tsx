/**
 * TimelineSection
 * ──────────────────────────────────────────────────────────────────────────────
 * A scroll-driven storytelling timeline with:
 *   • A vertical spine that progressively draws as the user scrolls
 *   • A traveling orange dot that marks progress along the spine
 *   • Alternating left / right feature cards that reveal when the dot arrives
 *   • Horizontal connector lines that scale-in between the dot and each card
 *
 * Desktop: full alternating layout with center spine
 * Mobile : simple stacked card list (no horizontal branching)
 */

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { BarChart3, CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '@/utils'

// ─── Timeline data ────────────────────────────────────────────────────────────
// Matches the three existing feature-card items from the landing page.

type Side = 'left' | 'right'

interface TimelineItem {
  id: string
  side: Side
  icon: React.FC<{ className?: string }>
  iconClass: string
  iconBg: string
  /** Color class for the branch-node ring glow */
  nodeGlow: string
  /** Background color class for the node dot */
  nodeBg: string
  /** Gradient class for the horizontal connector line */
  connectorFrom: string
  connectorTo: string
  /** Card background */
  cardBg: string
  /** Card border */
  cardBorder: string
  /** Scroll progress (0–1) at which this card starts to reveal */
  threshold: number
  title: string
  description: string
}

const timelineItems: TimelineItem[] = [
  {
    id: 'feature-centralized',
    side: 'right',
    icon: Sparkles,
    iconClass: 'text-orange-500',
    iconBg: 'bg-orange-100/90 dark:bg-orange-950/50',
    nodeGlow: 'shadow-[0_0_0_7px_rgba(249,115,22,0.14)]',
    nodeBg: 'bg-orange-500',
    connectorFrom: 'from-orange-400/20',
    connectorTo: 'to-orange-400',
    cardBg: 'bg-[#FFF6EE] dark:bg-[#2A1A0E]',
    cardBorder: 'border-orange-200/80 dark:border-orange-900/40',
    threshold: 0.18,
    title: 'Centralized Production Control',
    description:
      'A single source of truth for production assets, scripts, and timelines. Eliminate fragmented workflows instantly.',
  },
  {
    id: 'feature-realtime',
    side: 'left',
    icon: BarChart3,
    iconClass: 'text-violet-500',
    iconBg: 'bg-violet-100/90 dark:bg-violet-950/50',
    nodeGlow: 'shadow-[0_0_0_7px_rgba(139,92,246,0.14)]',
    nodeBg: 'bg-violet-500',
    connectorFrom: 'from-violet-400',
    connectorTo: 'to-violet-400/20',
    cardBg: 'bg-[#F6F2FF] dark:bg-[#1C1530]',
    cardBorder: 'border-violet-200/80 dark:border-violet-900/40',
    threshold: 0.50,
    title: 'Real-Time Tracking',
    description:
      'Monitor unit movements, shooting progress, and asset utilization as it happens on set or on the road.',
  },
  {
    id: 'feature-insights',
    side: 'right',
    icon: CheckCircle2,
    iconClass: 'text-sky-500',
    iconBg: 'bg-sky-100/90 dark:bg-sky-950/50',
    nodeGlow: 'shadow-[0_0_0_7px_rgba(14,165,233,0.14)]',
    nodeBg: 'bg-sky-500',
    connectorFrom: 'from-sky-400/20',
    connectorTo: 'to-sky-400',
    cardBg: 'bg-[#EFF8FF] dark:bg-[#0E1D2A]',
    cardBorder: 'border-sky-200/80 dark:border-sky-900/40',
    threshold: 0.76,
    title: 'Department-Level Insights',
    description:
      'Granular data for Camera, Transport, Grip, and Catering. See exactly where your resources are going.',
  },
]

// ─── Shared spring config (same physics as TiltedCard) ───────────────────────
const SPRING = { damping: 25, stiffness: 70, mass: 1 } as const

// ─── Helper: single timeline card ────────────────────────────────────────────
interface CardContentProps {
  item: TimelineItem
}
function CardContent({ item }: CardContentProps) {
  const Icon = item.icon
  return (
    <>
      <div
        className={cn(
          'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-sm',
          item.iconBg,
          item.iconClass,
        )}
      >
        <Icon className="h-[19px] w-[19px]" />
      </div>
      <h3 className="text-[1.03rem] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">
        {item.title}
      </h3>
      <p className="mt-2.5 text-[0.88rem] leading-[1.65] text-zinc-600 dark:text-zinc-300">
        {item.description}
      </p>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TimelineSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  /** Ref to the rows container — used to determine dot travel range in px */
  const rowsRef = useRef<HTMLDivElement>(null)
  /** Always-fresh height; avoids stale closure inside useTransform */
  const rowsHeightRef = useRef(700)
  const [revealed, setRevealed] = useState([false, false, false])

  // ── Measure rows container on mount + resize ──────────────────────────────
  useEffect(() => {
    function measure() {
      if (rowsRef.current) rowsHeightRef.current = rowsRef.current.offsetHeight
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (rowsRef.current) ro.observe(rowsRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Scroll progress (0 → 1) for the section ──────────────────────────────
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    // Start counting when section top hits 75% of viewport;
    // finish when section bottom hits 30% of viewport.
    offset: ['start 0.75', 'end 0.3'],
  })

  // Spring-smoothed progress for butter-smooth animations
  const smooth = useSpring(scrollYProgress, SPRING)

  // ── scaleY for the line fill — smooth IS already 0→1 ─────────────────────
  // Used directly as style prop; no separate useTransform needed.

  // ── Dot Y position in pixels ──────────────────────────────────────────────
  // Using function-form so it always reads the latest rowsHeightRef value
  // even after a resize (avoids needing rowsHeight as state).
  const DOT_PX = 16
  const dotY = useTransform(smooth, (v) =>
    Math.round(v * Math.max(0, rowsHeightRef.current - DOT_PX)),
  )

  // Reversible: hide when scrolling back up
  useMotionValueEvent(smooth, 'change', (v) => {
    setRevealed((prev) => {
      const next = timelineItems.map((item) => v >= item.threshold)
      const changed = next.some((n, i) => n !== prev[i])
      return changed ? next : prev
    })
  })

  // Handle edge-case: user arrives with section already scrolled past
  useEffect(() => {
    const v = scrollYProgress.get()
    if (v > 0) {
      setRevealed(timelineItems.map((item) => v >= item.threshold))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      data-reveal
      className="reveal-section scroll-mt-32 pt-24 lg:pt-32"
    >
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="mb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          How It Works
        </div>
        <h2 className="mx-auto mt-6 max-w-[600px] text-[2rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.55rem]">
          Everything in one cinematic view
        </h2>
        <p className="mx-auto mt-4 max-w-[480px] text-[1rem] leading-7 text-zinc-500 dark:text-zinc-300">
          A structured story of how ProdSync keeps every department in perfect sync.
        </p>
      </div>

      {/* ── Desktop: animated timeline ─────────────────────────────────────── */}
      <div className="relative mx-auto hidden max-w-[1100px] px-4 md:block">

        {/* Center spine overlay — absolutely positioned, spans full rows height */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex justify-center">
          {/* 2 px column containing track, fill, and traveling dot */}
          <div className="relative w-[2px]">

            {/* Gray background track (always full height) */}
            <div className="absolute inset-0 rounded-full bg-zinc-200 dark:bg-white/[0.09]" />

            {/* Gradient fill — grows from top as user scrolls */}
            <motion.div
              style={{ scaleY: smooth }}
              className="absolute inset-0 origin-top rounded-full bg-gradient-to-b from-orange-400 via-violet-500 to-sky-400"
            />

            {/* Traveling orange dot */}
            <motion.div
              style={{ y: dotY }}
              className="absolute left-1/2 top-0 z-20 -translate-x-1/2"
            >
              <div className="h-4 w-4 rounded-full border-[3px] border-white bg-orange-500 dark:border-zinc-950 shadow-[0_0_0_4px_rgba(249,115,22,0.22),0_0_18px_2px_rgba(249,115,22,0.45)]" />
            </motion.div>
          </div>
        </div>

        {/* Item rows — their combined height drives the dot travel range */}
        <div ref={rowsRef}>
          {timelineItems.map((item, i) => {
            const isRight = item.side === 'right'
            const isRevealed = revealed[i]

            // Card entrance animation
            const cardVariant = {
              hidden: { opacity: 0, x: isRight ? 38 : -38, scale: 0.92 },
              visible: { opacity: 1, x: 0, scale: 1 },
            }

            // Connector line entrance animation
            const connectorVariant = {
              hidden: { scaleX: 0 },
              visible: { scaleX: 1 },
            }

            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_56px_1fr] items-center py-[4.5rem]"
              >
                {/* ── Left column ─────────────────────────────────────────── */}
                <div className="flex items-center justify-end">
                  {!isRight && (
                    <div className="flex w-full items-center gap-0">
                      {/* Card */}
                      <motion.div
                        variants={cardVariant}
                        initial="hidden"
                        animate={isRevealed ? 'visible' : 'hidden'}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          'flex-1 rounded-[24px] border p-7',
                          'bg-white dark:bg-[#121417] shadow-soft dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:border-white/10'
                        )}
                      >
                        <CardContent item={item} />
                      </motion.div>

                      {/* Horizontal connector: scales from right → left (toward center) */}
                      <motion.div
                        variants={connectorVariant}
                        initial="hidden"
                        animate={isRevealed ? 'visible' : 'hidden'}
                        transition={{ duration: 0.38, ease: 'easeOut', delay: 0.12 }}
                        style={{ transformOrigin: 'right' }}
                        className={cn(
                          'h-[2px] w-20 flex-shrink-0 rounded-full bg-gradient-to-r',
                          item.connectorFrom,
                          item.connectorTo,
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* ── Center column: branch node dot ──────────────────────── */}
                <div className="flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={isRevealed ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                    transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1], delay: 0.08 }}
                    className={cn(
                      'relative z-10 h-[22px] w-[22px] rounded-full border-[3px] border-white dark:border-zinc-950',
                      item.nodeBg,
                      item.nodeGlow,
                    )}
                  />
                </div>

                {/* ── Right column ─────────────────────────────────────────── */}
                <div className="flex items-center justify-start">
                  {isRight && (
                    <div className="flex w-full items-center gap-0">
                      {/* Horizontal connector: scales from left → right (away from center) */}
                      <motion.div
                        variants={connectorVariant}
                        initial="hidden"
                        animate={isRevealed ? 'visible' : 'hidden'}
                        transition={{ duration: 0.38, ease: 'easeOut', delay: 0.12 }}
                        style={{ transformOrigin: 'left' }}
                        className={cn(
                          'h-[2px] w-20 flex-shrink-0 rounded-full bg-gradient-to-r',
                          item.connectorFrom,
                          item.connectorTo,
                        )}
                      />

                      {/* Card */}
                      <motion.div
                        variants={cardVariant}
                        initial="hidden"
                        animate={isRevealed ? 'visible' : 'hidden'}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          'flex-1 rounded-[24px] border p-7',
                          'bg-white dark:bg-[#121417] shadow-soft dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:border-white/10'
                        )}
                      >
                        <CardContent item={item} />
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Mobile fallback: simple stacked cards ───────────────────────────── */}
      <div className="mx-auto max-w-[480px] space-y-5 px-4 md:hidden">
        {timelineItems.map((item) => (
          <div
            key={item.id}
            data-reveal
            className={cn(
              'reveal-section rounded-[24px] border p-7',
              'bg-white dark:bg-[#121417] shadow-soft dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:border-white/10'
            )}
          >
            <CardContent item={item} />
          </div>
        ))}
      </div>
    </section>
  )
}
