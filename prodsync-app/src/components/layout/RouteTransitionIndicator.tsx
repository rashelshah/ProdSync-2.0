import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const TRANSITION_VISIBILITY_MS = 520

export function RouteTransitionIndicator() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)

    const timeoutId = window.setTimeout(() => {
      setVisible(false)
    }, TRANSITION_VISIBILITY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [location.hash, location.pathname, location.search])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="route-transition-indicator" />
    </div>
  )
}
