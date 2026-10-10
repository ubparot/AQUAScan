import { useEffect, useRef } from 'react'

/**
 * Drives a `--sheen` custom property (0 → 1) from the element's trip through the viewport,
 * so a metallic gradient on it catches the light as the page scrolls.
 * Reduced motion keeps the CSS default.
 */
export function useScrollSheen<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = node.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)))
      node.style.setProperty('--sheen', progress.toFixed(4))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return ref
}
