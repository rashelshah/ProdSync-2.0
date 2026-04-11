import { useEffect, useRef, useState, forwardRef } from 'react'
import { cn } from '@/utils'

export interface LiquidGlassNavbarProps {
  tabs: {
    id: string
    icon: string
    label: string
  }[]
  activeTabId: string
  onTabChange: (id: string) => void
}

export const LiquidGlassNavbar = forwardRef<HTMLElement, LiquidGlassNavbarProps>(({ tabs, activeTabId, onTabChange }, forwardedRef) => {
  const localNavRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const activeIndex = tabs.findIndex(tab => tab.id === activeTabId)

  useEffect(() => {
    const activeEl = itemRefs.current[activeIndex]
    const navEl = localNavRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const elRect = activeEl.getBoundingClientRect()
      setIndicatorStyle({
        left: elRect.left - navRect.left,
        width: elRect.width,
      })
    }
  }, [activeIndex, tabs.length])

  return (
    <>
      <svg width="0" height="0" className="absolute hidden pointer-events-none">
        <defs>
          <filter id="liquid-glass-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -8" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <nav ref={forwardedRef} className="fixed bottom-6 left-1/2 z-40 w-[calc(100vw-3rem)] max-w-sm -translate-x-1/2 pointer-events-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <div 
          ref={localNavRef}
          className="relative flex items-center h-[4.5rem] rounded-[2.25rem] bg-white/70 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-white/60 dark:bg-zinc-900/70 dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
        >
          {/* Gooey Background Layer */}
          <div 
            className="absolute inset-0 rounded-[2.25rem] overflow-hidden pointer-events-none"
            style={{ filter: 'url(#liquid-glass-goo)' }}
          >
            {/* The base path layer to merge with */}
            <div className="absolute inset-0 rounded-[2.25rem] bg-transparent" />
            
            {/* The moving active indicator */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-14 rounded-[1.5rem] bg-orange-500 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
          </div>

          {/* Foreground Layer with Icons (no blur) */}
          <div className="relative z-10 flex w-full h-full items-center justify-between px-2">
            {tabs.map((tab, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  ref={el => { itemRefs.current[index] = el; }}
                  className={cn(
                    'group relative flex flex-1 min-w-0 h-full flex-col items-center justify-center gap-1 transition-colors duration-300',
                    isActive ? 'text-black dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'
                  )}
                >
                  <span className="material-symbols-outlined text-[24px] shrink-0" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                    {tab.icon}
                  </span>
                  <span className="text-[9px] font-bold tracking-wide uppercase mt-0.5 px-0.5 w-full truncate text-center">
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
})
LiquidGlassNavbar.displayName = 'LiquidGlassNavbar'
