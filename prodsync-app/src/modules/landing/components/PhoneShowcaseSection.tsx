/**
 * PhoneShowcaseSection — iPhone PWA Showcase
 * ----------------------------------------------------------------------------
 * A premium marketing section placed after the CircularGallery.
 *
 * - CSS-only iPhone 14 Pro Max frame (no external assets required)
 * - Desktop keeps the original Framer Motion slide transition path
 * - Mobile uses a pre-rendered opacity stack to avoid remount churn
 * - Auto-cycles through all 6 module screens
 * - Responsive: side-by-side (desktop) → stacked (mobile)
 * ----------------------------------------------------------------------------
 */

import { memo, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Wifi, BatteryFull, Signal } from 'lucide-react'
import { phoneGallery, type PhoneScreen } from '@/config/phoneGallery'
import { useDevicePerformance } from '@/hooks/useDevicePerformance'

const DESKTOP_INTERVAL = 2500
const MOBILE_VISIBILITY_THRESHOLD = 0.3

const slideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
}

const slideTransition = {
  duration: 0.42,
  ease: [0.32, 0.72, 0, 1] as const,
}

function useTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  return time
}

function getMobileInterval(isLowEnd: boolean) {
  return isLowEnd ? 3500 : 2800
}

function getPhoneShadow(isMobile: boolean, isLowEnd: boolean) {
  if (!isMobile) {
    return 'drop-shadow(0 40px 60px rgba(0,0,0,0.35)) drop-shadow(0 8px 20px rgba(0,0,0,0.2))'
  }

  if (isLowEnd) {
    return 'drop-shadow(0 18px 26px rgba(0,0,0,0.24)) drop-shadow(0 4px 10px rgba(0,0,0,0.14))'
  }

  return 'drop-shadow(0 28px 42px rgba(0,0,0,0.3)) drop-shadow(0 6px 16px rgba(0,0,0,0.18))'
}

function handleNextIndex(activeIndex: number) {
  return (activeIndex + 1) % phoneGallery.length
}

function PhoneImageFallback({
  screen,
  isVisible,
  reducedEffects,
}: {
  screen: PhoneScreen
  isVisible: boolean
  reducedEffects: boolean
}) {
  return (
    <div
      className="absolute inset-0 flex-col items-center justify-center gap-4 p-6"
      style={{
        background: reducedEffects
          ? 'linear-gradient(160deg, #18181b 0%, #111113 100%)'
          : 'linear-gradient(160deg, #18181b 0%, #0f0f10 100%)',
        display: isVisible ? 'flex' : 'none',
      }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-[20px] text-2xl"
        style={{ backgroundColor: `${screen.accent}22` }}
      >
        📱
      </div>
      <p className="text-center text-[0.78rem] font-semibold text-white" style={{ color: screen.accent }}>
        {screen.label}
      </p>
      <p className="text-center text-[0.7rem] text-zinc-500">
        Drop screenshot in{'\n'}/public/phone/
      </p>
    </div>
  )
}

const PhoneFrame = memo(function PhoneFrame({
  activeIndex,
  direction,
  isMobile,
  isLowEnd,
}: {
  activeIndex: number
  direction: number
  isMobile: boolean
  isLowEnd: boolean
}) {
  const time = useTime()
  const current = phoneGallery[activeIndex]
  const [failedImages, setFailedImages] = useState<Record<number, true>>({})
  const enableEffects = !(isMobile && isLowEnd)

  const shellBackground = enableEffects
    ? 'linear-gradient(160deg, #2d2d2f 0%, #1a1a1c 40%, #0d0d0e 100%)'
    : 'linear-gradient(160deg, #262628 0%, #171719 44%, #0d0d0e 100%)'

  const shellBoxShadow = enableEffects
    ? [
        'inset 0 0 0 1.5px rgba(255,255,255,0.12)',
        'inset 0 1px 0 rgba(255,255,255,0.18)',
        '0 0 0 1px rgba(0,0,0,0.8)',
      ].join(', ')
    : [
        'inset 0 0 0 1px rgba(255,255,255,0.08)',
        '0 0 0 1px rgba(0,0,0,0.8)',
      ].join(', ')

  function handleImageError(index: number) {
    setFailedImages((previous) => {
      if (previous[index]) {
        return previous
      }

      return {
        ...previous,
        [index]: true,
      }
    })
  }

  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative phone-showcase-frame"
      style={{
        filter: getPhoneShadow(isMobile, isLowEnd),
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: '328px',
          height: '640px',
          borderRadius: '56px',
          background: shellBackground,
          boxShadow: shellBoxShadow,
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          contain: 'layout paint',
        }}
      >
        <div className="pointer-events-none absolute -left-[3px] top-[130px] h-[34px] w-[3px] rounded-l-md bg-zinc-600" />
        <div className="pointer-events-none absolute -left-[3px] top-[180px] h-[64px] w-[3px] rounded-l-md bg-zinc-600" />
        <div className="pointer-events-none absolute -left-[3px] top-[256px] h-[64px] w-[3px] rounded-l-md bg-zinc-600" />
        <div className="pointer-events-none absolute -right-[3px] top-[180px] h-[96px] w-[3px] rounded-r-md bg-zinc-600" />

        <div
          className="absolute overflow-hidden bg-black"
          style={{
            inset: '8px',
            borderRadius: '48px',
            transform: 'translateZ(0)',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            contain: 'layout paint',
          }}
        >
          <div className="relative z-20 flex h-11 items-center justify-between px-6 pt-1">
            <span className="text-[12px] font-semibold text-white">{time}</span>

            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 bg-black"
              style={{
                width: '120px',
                height: '36px',
                borderRadius: '20px',
                boxShadow: enableEffects ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              <div className="absolute right-[20px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
              <div className="absolute right-[36px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-zinc-900" />
            </div>

            <div className="flex items-center gap-1.5">
              <Signal className="h-3 w-3 text-white" strokeWidth={2} />
              <Wifi className="h-3 w-3 text-white" strokeWidth={2} />
              <BatteryFull className="h-3.5 w-3.5 text-white" strokeWidth={2} />
            </div>
          </div>

          <div
            className="absolute inset-0 top-11"
            style={{
              transform: 'translateZ(0)',
              willChange: 'opacity, transform',
              backfaceVisibility: 'hidden',
              contain: 'layout paint',
            }}
          >
            {isMobile ? (
              <div className="relative h-full w-full">
                {phoneGallery.map((screen, index) => {
                  const isActive = activeIndex === index
                  const hasFailed = Boolean(failedImages[index])

                  return (
                    <div
                      key={screen.image}
                      className="absolute inset-0"
                      style={{
                        opacity: isActive ? 1 : 0,
                        zIndex: isActive ? 10 : 0,
                        transition: 'opacity 700ms cubic-bezier(0.32, 0.72, 0, 1)',
                        transform: 'translateZ(0)',
                        willChange: 'opacity',
                        backfaceVisibility: 'hidden',
                      }}
                      aria-hidden={!isActive}
                    >
                      {!hasFailed && (
                        <img
                          src={screen.image}
                          alt={screen.label}
                          className="h-full w-full object-cover object-top"
                          draggable={false}
                          loading="lazy"
                          decoding="async"
                          onError={() => handleImageError(index)}
                        />
                      )}
                      <PhoneImageFallback
                        screen={screen}
                        isVisible={hasFailed}
                        reducedEffects={!enableEffects}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
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
                  {!failedImages[activeIndex] && (
                    <img
                      src={current.image}
                      alt={current.label}
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                      onError={() => handleImageError(activeIndex)}
                    />
                  )}
                  <PhoneImageFallback
                    screen={current}
                    isVisible={Boolean(failedImages[activeIndex])}
                    reducedEffects={false}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/30" />
        </div>

        {enableEffects ? (
          <div
            className="pointer-events-none absolute left-0 top-0 h-48 w-48 rounded-[52px]"
            style={{
              background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.08) 0%, transparent 60%)',
            }}
          />
        ) : null}
      </div>
    </motion.div>
  )
})

PhoneFrame.displayName = 'PhoneFrame'

const PhoneShowcaseSectionComponent = function PhoneShowcaseSection() {
  const { isMobile, isLowEnd } = useDevicePerformance()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [slideState, setSlideState] = useState({ activeIndex: 0, direction: 1 })
  const [isVisible, setIsVisible] = useState(true)

  const { activeIndex, direction } = slideState
  const current = phoneGallery[activeIndex]
  const mobileInterval = getMobileInterval(isLowEnd)

  useEffect(() => {
    if (!isMobile) {
      setIsVisible(true)
      return
    }

    const frameElement = frameRef.current
    if (!frameElement) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: MOBILE_VISIBILITY_THRESHOLD },
    )

    observer.observe(frameElement)

    return () => observer.disconnect()
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) {
      const intervalId = window.setInterval(() => {
        setSlideState((previous) => ({
          activeIndex: handleNextIndex(previous.activeIndex),
          direction: 1,
        }))
      }, DESKTOP_INTERVAL)

      return () => window.clearInterval(intervalId)
    }

    if (!isVisible) return

    let rafId = 0
    let lastTime = 0

    const animate = (time: number) => {
      if (lastTime === 0) {
        lastTime = time
      }

      if (time - lastTime >= mobileInterval) {
        lastTime = time
        setSlideState((previous) => ({
          activeIndex: handleNextIndex(previous.activeIndex),
          direction: 1,
        }))
      }

      rafId = window.requestAnimationFrame(animate)
    }

    rafId = window.requestAnimationFrame(animate)

    return () => window.cancelAnimationFrame(rafId)
  }, [isMobile, isVisible, mobileInterval])

  function handleDotClick(index: number) {
    setSlideState((previous) => {
      if (previous.activeIndex === index) {
        return previous
      }

      return {
        activeIndex: index,
        direction: index > previous.activeIndex ? 1 : -1,
      }
    })
  }

  return (
    <section
      id="pwa"
      data-reveal
      className="reveal-section scroll-mt-32 pt-20 sm:pt-24 lg:pt-32"
    >
      <div className="flex flex-col-reverse items-center gap-12 sm:gap-16 lg:flex-row lg:items-center lg:gap-20">
        <div className="flex-1 w-full text-center lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            PWA · Works on Any Device
          </div>

          <h2 className="max-w-[560px] mx-auto lg:mx-0 text-[1.85rem] sm:text-[2.1rem] font-bold tracking-[-0.06em] text-zinc-900 dark:text-white lg:text-[2.65rem] lg:leading-[1.06]">
            Phone{' '}
            <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">
              Optimised
            </span>{' '}
            <br className="hidden sm:block" />
            for Your Crew
          </h2>

          <p className="mx-auto mt-5 max-w-[500px] text-[0.95rem] leading-7 text-zinc-500 dark:text-zinc-300 lg:mx-0">
            Every crew member on set gets instant access to call sheets, approvals,
            and gear check-ins — directly on their phone. No app store required.
            Install once, use everywhere on any device.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
            {phoneGallery.map((screen, index) => (
              <button
                key={screen.image}
                onClick={() => handleDotClick(index)}
                aria-label={`Show ${screen.label}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: index === activeIndex ? '24px' : '6px',
                  backgroundColor: index === activeIndex ? current.accent : '#a1a1aa',
                }}
              />
            ))}
          </div>

          <p
            className="mt-4 text-[0.82rem] font-semibold uppercase tracking-[0.18em] transition-colors duration-500"
            style={{ color: current.accent }}
          >
            {current.label}
          </p>
        </div>

        <div ref={frameRef} className="flex flex-shrink-0 items-center justify-center">
          <PhoneFrame
            activeIndex={activeIndex}
            direction={direction}
            isMobile={isMobile}
            isLowEnd={isLowEnd}
          />
        </div>
      </div>
    </section>
  )
}

export const PhoneShowcaseSection = memo(PhoneShowcaseSectionComponent)

PhoneShowcaseSection.displayName = 'PhoneShowcaseSection'

export default PhoneShowcaseSection
