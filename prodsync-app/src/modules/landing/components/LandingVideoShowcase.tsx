import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'
import landingVideo from '@/assets/landing-video.mp4'

export function LandingVideoShowcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { triggerLiquidNav } = useLiquidTransition()
  const btnPrimaryRef = useRef<HTMLButtonElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  // Subtle parallax for the video itself
  const videoY = useTransform(scrollYProgress, [0, 1], ['-5%', '5%'])

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as const,
        staggerChildren: 0.15,
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as const,
      }
    }
  }

  return (
    <section id="cta" className="flex flex-col items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32 scroll-mt-32">
      <motion.div
        ref={containerRef}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-10%' }}
        className="relative w-full max-w-[1340px] 2xl:max-w-[1440px] overflow-hidden rounded-[24px] sm:rounded-[32px] lg:rounded-[38px] border border-zinc-200/50 bg-zinc-950 p-1.5 sm:p-2 lg:p-3 shadow-2xl dark:border-white/10"
      >
        <div className="relative flex min-h-[340px] sm:min-h-[55vh] lg:min-h-[750px] w-full flex-col items-center justify-center overflow-hidden rounded-[18px] sm:rounded-[26px] lg:rounded-[30px] border border-white/10">
          {/* Video Background */}
          <motion.div
            style={{ y: videoY }}
            className="absolute inset-[-10%] z-0 h-[120%] w-[120%]"
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover opacity-80 mix-blend-screen"
            >
              <source src={landingVideo} type="video/mp4" />
            </video>
          </motion.div>

          {/* Cinematic Overlay */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/40 via-zinc-950/60 to-zinc-950/80 mix-blend-multiply" />
          <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

          {/* Content */}
          <div className="relative z-20 flex w-full max-w-[800px] flex-col items-center px-5 text-center sm:px-8 lg:px-12">
            <motion.div variants={itemVariants} className="mb-4 sm:mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Final Cut
            </motion.div>
            
            <motion.h2 
              variants={itemVariants}
              className="text-balance text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-[-0.05em] text-white"
            >
              Run your entire production from one system
            </motion.h2>

            <motion.p 
              variants={itemVariants}
              className="mt-4 sm:mt-6 max-w-[600px] text-sm sm:text-base lg:text-lg font-medium leading-relaxed text-zinc-300"
            >
              From crew to logistics to approvals — everything synced in real time.
            </motion.p>
            
            <motion.div variants={itemVariants} className="mt-7 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                ref={btnPrimaryRef}
                onClick={() => triggerLiquidNav(btnPrimaryRef, '/auth')}
                className="glow-button inline-flex items-center rounded-full bg-orange-500 px-6 py-3 sm:px-8 sm:py-4 text-[0.9rem] sm:text-[1.05rem] font-semibold text-black transition-transform hover:scale-105 active:scale-95"
              >
                Get Started
              </button>
              <a 
                href="#preview" 
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 sm:px-8 sm:py-4 text-[0.9rem] sm:text-[1.05rem] font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
              >
                Schedule Demo
              </a>
            </motion.div>
          </div>
        </div>
      </motion.div>
      <div className="mt-4 sm:mt-6 flex w-full max-w-[1340px] 2xl:max-w-[1440px] justify-center px-4">
        <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 text-center">
          video credits: makers of KAITHI &{' '}
          <a
            href="https://youtu.be/_8TvuB3U5vc?si=3v3m9kNGQIXtSy05"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-500 hover:text-orange-600 transition-colors dark:text-orange-400 dark:hover:text-orange-300 hover:underline"
          >
            Dream Warrior Pictures
          </a>
        </p>
      </div>
    </section>
  )
}
