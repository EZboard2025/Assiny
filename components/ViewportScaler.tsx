'use client'

import { useEffect } from 'react'

const REFERENCE_WIDTH = 1830
const MIN_ZOOM = 0.6

export function ViewportScaler() {
  useEffect(() => {
    function apply() {
      const root = document.documentElement

      // Clear zoom before reading width to get the true physical viewport
      root.style.zoom = ''
      const w = window.innerWidth

      if (w >= REFERENCE_WIDTH || w <= 768) {
        root.style.removeProperty('--viewport-zoom')
        return
      }

      const zoom = Math.max(MIN_ZOOM, w / REFERENCE_WIDTH)
      root.style.zoom = zoom.toString()
      root.style.setProperty('--viewport-zoom', zoom.toString())
    }

    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      document.documentElement.style.zoom = ''
      document.documentElement.style.removeProperty('--viewport-zoom')
    }
  }, [])

  return null
}
