import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook that returns refs to attach to a fixed-position bottom nav bar
 * and its companion floating buttons above it.
 *
 * On mobile (< 768px):
 * - Scrolling DOWN → nav slides down + fades out; companion slides down to fill the gap
 * - Scrolling UP  → nav slides back up; companion moves back above it
 *
 * Uses accumulated scroll distance for reliable mobile detection
 * and direct DOM manipulation for smooth 60fps performance.
 */
export function useMobileScrollHide() {
  const navRef = useRef<HTMLElement>(null)
  const companionRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const scrollAccum = useRef(0)
  const isHidden = useRef(false)

  const TRANSITION =
    'transform 0.42s cubic-bezier(0.32,0.72,0,1), opacity 0.38s cubic-bezier(0.32,0.72,0,1)'

  const show = useCallback(() => {
    if (!isHidden.current) return
    if (navRef.current) {
      navRef.current.style.transform = 'translateY(0)'
      navRef.current.style.opacity = '1'
    }
    if (companionRef.current) {
      companionRef.current.style.transform = 'translateY(0)'
    }
    isHidden.current = false
  }, [])

  const hide = useCallback(() => {
    if (isHidden.current) return
    if (navRef.current) {
      navRef.current.style.transform = 'translateY(calc(100% + 24px))'
      navRef.current.style.opacity = '0'
    }
    // Move companion down to where the nav was (nav height ~80px + bottom 12px gap)
    if (companionRef.current) {
      companionRef.current.style.transform = 'translateY(92px)'
    }
    isHidden.current = true
  }, [])

  useEffect(() => {
    const isMobile = () => window.innerWidth < 768

    // Apply transition styles once the refs are available
    const applyTransitions = () => {
      if (navRef.current) {
        navRef.current.style.transition = TRANSITION
        navRef.current.style.willChange = 'transform, opacity'
      }
      if (companionRef.current) {
        companionRef.current.style.transition = TRANSITION
        companionRef.current.style.willChange = 'transform'
      }
    }

    // Apply immediately and also after a short delay for lazy-rendered elements
    applyTransitions()
    const applyTimer = setTimeout(applyTransitions, 500)

    let animId: number | null = null

    const onScroll = () => {
      if (animId) cancelAnimationFrame(animId)
      animId = requestAnimationFrame(() => {
        if (!isMobile()) return

        // Re-apply transition on first scroll if element didn't exist at mount
        if (navRef.current && !navRef.current.style.transition) {
          applyTransitions()
        }

        const scrollY =
          window.scrollY ?? document.documentElement.scrollTop ?? 0
        const delta = scrollY - lastScrollY.current

        // Always show near the top of the page
        if (scrollY <= 80) {
          scrollAccum.current = 0
          show()
          lastScrollY.current = scrollY
          return
        }

        // Reset accumulator when scroll direction changes
        if (
          (delta > 0 && scrollAccum.current < 0) ||
          (delta < 0 && scrollAccum.current > 0)
        ) {
          scrollAccum.current = 0
        }
        scrollAccum.current += delta

        // Hide after 30px of cumulative downward scroll
        if (scrollAccum.current > 30) {
          hide()
          scrollAccum.current = 0
        }
        // Show after 10px of cumulative upward scroll
        else if (scrollAccum.current < -10) {
          show()
          scrollAccum.current = 0
        }

        lastScrollY.current = scrollY
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true })

    // Reset styles when switching to desktop
    const onResize = () => {
      if (!isMobile()) {
        if (navRef.current) {
          navRef.current.style.transform = ''
          navRef.current.style.opacity = ''
          navRef.current.style.transition = ''
          navRef.current.style.willChange = ''
        }
        if (companionRef.current) {
          companionRef.current.style.transform = ''
          companionRef.current.style.transition = ''
          companionRef.current.style.willChange = ''
        }
        isHidden.current = false
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      clearTimeout(applyTimer)
      if (animId) cancelAnimationFrame(animId)
    }
  }, [show, hide])

  return { navRef, companionRef }
}
