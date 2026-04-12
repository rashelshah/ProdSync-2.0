/**
 * LiquidTransitionContext
 * ─────────────────────────────────────────────────────────────────────────────
 * App-level context that manages the liquid orange circle transition.
 * Lives above the router so the overlay persists across route changes.
 *
 * Usage:
 *   const { triggerLiquidNav } = useLiquidTransition()
 *   triggerLiquidNav(buttonRef, '/auth')
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiquidOrigin {
  x: number
  y: number
}

interface LiquidTransitionContextValue {
  /** Call with a ref to the clicked element and the target route. */
  triggerLiquidNav: (ref: RefObject<HTMLButtonElement | HTMLAnchorElement | null>, to: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────
const LiquidTransitionContext = createContext<LiquidTransitionContextValue | null>(null)

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLiquidTransition() {
  const ctx = useContext(LiquidTransitionContext)
  if (!ctx) throw new Error('useLiquidTransition must be used inside LiquidTransitionProvider')
  return ctx
}

// ─── Provider + Overlay ──────────────────────────────────────────────────────
export function LiquidTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  // Phase: idle | expanding | collapsing
  const [phase, setPhase] = useState<'idle' | 'expanding' | 'collapsing'>('idle')
  const [origin, setOrigin] = useState<LiquidOrigin>({ x: 0, y: 0 })
  const pendingRoute = useRef<string | null>(null)
  const animating = useRef(false)

  const triggerLiquidNav = useCallback(
    (ref: RefObject<HTMLButtonElement | HTMLAnchorElement | null>, to: string) => {
      if (animating.current) return
      animating.current = true

      // Capture center of the clicked element
      const el = ref.current
      const rect = el?.getBoundingClientRect()
      setOrigin({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      })

      pendingRoute.current = to

      // Prevent scroll during transition
      document.documentElement.style.overflow = 'hidden'

      setPhase('expanding')
    },
    [],
  )

  // Called when the expand animation finishes
  const onExpandComplete = useCallback(() => {
    const to = pendingRoute.current
    if (!to) return

    // Navigate while fully covered
    navigate(to)

    // Brief pause then collapse
    setTimeout(() => {
      setPhase('collapsing')
    }, 60)
  }, [navigate])

  // Called when the collapse animation finishes
  const onCollapseComplete = useCallback(() => {
    setPhase('idle')
    animating.current = false
    pendingRoute.current = null
    document.documentElement.style.overflow = ''
  }, [])

  // Circle must cover the full viewport diagonal from the origin point.
  // Worst-case distance = from the clicked point to the farthest corner.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
  const CIRCLE_SIZE = 60 // px — starting seed size
  // compute the max distance to any corner so the scale covers the screen
  const toCornerMax = Math.ceil(
    Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(vw - origin.x, origin.y),
      Math.hypot(origin.x, vh - origin.y),
      Math.hypot(vw - origin.x, vh - origin.y),
    ),
  )
  const targetScale = Math.ceil((toCornerMax * 2) / CIRCLE_SIZE) + 2

  return (
    <LiquidTransitionContext.Provider value={{ triggerLiquidNav }}>
      {children}

      {/* Overlay — always mounted, phase drives animation */}
      <AnimatePresence>
        {phase !== 'idle' && (
          <div
            className="pointer-events-none fixed inset-0 z-[9999]"
            aria-hidden="true"
          >
            {phase === 'expanding' && (
              <motion.div
                key="liquid-expand"
                initial={{ scale: 0 }}
                animate={{ scale: targetScale }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={onExpandComplete}
                style={{
                  position: 'absolute',
                  left: origin.x,
                  top: origin.y,
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  marginLeft: -CIRCLE_SIZE / 2,
                  marginTop: -CIRCLE_SIZE / 2,
                  borderRadius: '9999px',
                  background: '#f97316', // brand orange
                  transformOrigin: 'center center',
                }}
              />
            )}

            {phase === 'collapsing' && (
              <motion.div
                key="liquid-collapse"
                initial={{ scale: targetScale }}
                animate={{ scale: 0 }}
                transition={{ duration: 0.35, ease: [0.64, 0, 0.78, 0] }}
                onAnimationComplete={onCollapseComplete}
                style={{
                  position: 'absolute',
                  left: origin.x,
                  top: origin.y,
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  marginLeft: -CIRCLE_SIZE / 2,
                  marginTop: -CIRCLE_SIZE / 2,
                  borderRadius: '9999px',
                  background: '#f97316',
                  transformOrigin: 'center center',
                }}
              />
            )}
          </div>
        )}
      </AnimatePresence>
    </LiquidTransitionContext.Provider>
  )
}
