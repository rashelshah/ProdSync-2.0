import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAV_ITEMS, canAccessRoute } from '@/features/auth/access-rules'
import { useAuthStore } from '@/features/auth/auth.store'
import { useProjectAlerts } from '@/features/alerts/useProjectAlerts'
import { cn } from '@/utils'

export function MobileNavbar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const user = useAuthStore(s => s.user)
  const location = useLocation()
  const navigate = useNavigate()
  const { alerts } = useProjectAlerts()
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged)

  const rawNavItems = user ? APP_NAV_ITEMS.filter(item => item.routeId !== 'projects' && canAccessRoute(user, item.routeId)) : []
  
  const hasMore = rawNavItems.length > 4
  const visibleItems = hasMore ? rawNavItems.slice(0, 4) : rawNavItems

  if (hasMore) {
    visibleItems.push({
      path: '#more',
      label: 'More',
      icon: 'menu',
      routeId: 'dashboard' as any
    })
  }

  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let index = visibleItems.findIndex(item => 
      item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
    )
    if (index === -1) {
      if (location.pathname === '/' || location.pathname === '/projects') {
          // If we are at root, keep active index out of bounds or at 0? 
          // For now let's just keep whatever was active, or 0
          index = 0
      } else {
          // if we are somewhere matching 'More', maybe set it to the last item
          index = hasMore ? 4 : 0
      }
    }
    // only update activeIndex if the user didn't click #more
    if (visibleItems[index]?.path !== '#more') {
      setActiveIndex(index)
    }
  }, [location.pathname, visibleItems, hasMore])

  useEffect(() => {
    const activeEl = itemRefs.current[activeIndex]
    const navEl = navRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const elRect = activeEl.getBoundingClientRect()
      setIndicatorStyle({
        left: elRect.left - navRect.left,
        width: elRect.width,
      })
    }
  }, [activeIndex, visibleItems.length])

  if (!user || visibleItems.length === 0) return null

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

      <div className="md:hidden fixed bottom-6 left-1/2 z-50 w-[calc(100vw-3rem)] max-w-sm -translate-x-1/2 pointer-events-auto">
        <div 
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
          <nav ref={navRef} className="relative z-10 flex w-full h-full items-center justify-between px-2">
            {visibleItems.map((item, index) => {
              const isActive = index === activeIndex
              const hasAlert =
                (item.path === '/transport' || item.path === '/crew' || item.path === '/approvals') &&
                criticalAlerts.some(a => {
                  if (item.path === '/transport' && a.source === 'transport') return true
                  if (item.path === '/crew' && a.source === 'crew') return true
                  if (item.path === '/approvals' && a.source === 'approvals') return true
                  return false
                })

              const isMoreItem = item.path === '#more'
              const classNameStr = cn(
                'group relative flex flex-1 h-full flex-col items-center justify-center gap-1 transition-colors duration-300',
                isActive ? 'text-black dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'
              )
              const content = (
                <>
                  <span className="material-symbols-outlined text-[24px]">
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-medium tracking-tight">
                    {/* Display shorter names for compact bottom bar */}
                    {item.label.split(' ')[0]}
                  </span>
                  {hasAlert && !isActive && (
                    <span className="absolute top-3 right-1/2 translate-x-3 h-2 w-2 rounded-full bg-orange-500 border-2 border-white dark:border-zinc-900" />
                  )}
                </>
              )

              if (isMoreItem) {
                return (
                  <button
                    key={item.path}
                    onClick={onOpenMenu}
                    ref={el => (itemRefs.current[index] = el as unknown as HTMLDivElement)}
                    className={classNameStr}
                  >
                    {content}
                  </button>
                )
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  ref={el => (itemRefs.current[index] = el as unknown as HTMLDivElement)}
                  className={() => classNameStr}
                >
                  {content}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}
