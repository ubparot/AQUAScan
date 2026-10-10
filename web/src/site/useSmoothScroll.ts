import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

/**
 * Smooths mouse-wheel and trackpad scrolling on the marketing pages. Touch scrolling stays native,
 * and nothing changes for visitors who ask for reduced motion.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      anchors: true, // in-page section links (chapter nav) glide too
      stopInertiaOnNavigate: true,
      // Let overlays (mobile menu, film) scroll or block natively.
      prevent: (node) => Boolean(node.closest?.('.globalnav-menu, .film-modal')),
    })

    // Pause while an overlay has locked the page.
    const root = document.documentElement
    const sync = () => (root.classList.contains('menu-open') ? lenis.stop() : lenis.start())
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => {
      observer.disconnect()
      lenis.destroy()
    }
  }, [])
}
