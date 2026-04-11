import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

export function FooterBranding() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end end'],
  })

  // Subtle parallax effect: moves the text up slightly as you scroll down
  const y = useTransform(scrollYProgress, [0, 1], ['20%', '0%'])

  return (
    <div 
      ref={containerRef}
      className="pointer-events-none relative flex w-full select-none justify-center overflow-hidden" 
      style={{
        maskImage: 'linear-gradient(to top, transparent 0%, black 25%)',
        WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 25%)'
      }}
    >
      <motion.div 
        style={{ y }}
        className="translate-y-[20%]"
      >
        <h2 
          className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent opacity-[0.08] dark:opacity-[0.12]"
          style={{
            fontSize: 'clamp(120px, 18vw, 280px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          PRODSYNC
        </h2>
      </motion.div>
    </div>
  )
}
