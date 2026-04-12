import { useEffect, useState } from 'react'

function getDevicePerformanceState() {
  const isMobile = window.innerWidth < 768
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency || 4

  return {
    isMobile,
    isLowEnd: memory <= 4 || cores <= 4,
  }
}

export function useDevicePerformance() {
  const [devicePerformance, setDevicePerformance] = useState(() =>
    typeof window === 'undefined'
      ? { isMobile: false, isLowEnd: false }
      : getDevicePerformanceState(),
  )

  useEffect(() => {
    const updateDevicePerformance = () => {
      setDevicePerformance(getDevicePerformanceState())
    }

    updateDevicePerformance()
    window.addEventListener('resize', updateDevicePerformance)

    return () => {
      window.removeEventListener('resize', updateDevicePerformance)
    }
  }, [])

  return devicePerformance
}
