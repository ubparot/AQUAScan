import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ButtonLink } from './primitives'
import { clamp, explodeAt } from './probeTimeline'

const ProbeStage = lazy(() => import('./ProbeStage'))

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * "The probe": the real probe CAD on a light stage. It separates into its parts as the section moves up the
 * screen and closes again on the way back. The page scrolls normally; nothing is pinned.
 */
export function ProbeSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const progress = useRef(0)
  const [use3d] = useState(() => typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined' && webglAvailable())
  const [modelReady, setModelReady] = useState(false)
  const onReady = useCallback(() => setModelReady(true), [])

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current
      if (!section) return
      // 0 while the section is still entering; 1 once its top has risen to 20% from the top of the screen.
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight
      const p = clamp((vh * 0.55 - rect.top) / Math.max(1, vh * 0.5))
      progress.current = p
      section.style.setProperty('--explode', explodeAt(p).toFixed(4))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <section ref={sectionRef} className="probe-hero" data-3d={use3d} aria-labelledby="probe-title">
      <div className="probe-hero-inner">
        <div className="probe-hero-copy">
          <h2 id="probe-title" className="tile-title">The probe</h2>
          <p className="tile-subtitle">Lowered on a tether. Measuring at every depth.</p>
          <div className="tile-actions">
            <ButtonLink to="products" hash="probe">Learn more</ButtonLink>
            <ButtonLink to="products" hash="specs" variant="secondary">Tech specs</ButtonLink>
          </div>
        </div>

        <div className="probe-stage" data-ready={modelReady}>
          <img className="probe-poster" src="/media/site/probe-hero.webp" alt={use3d ? '' : 'The AquaScan sensor probe'} width={1600} height={1000} loading="lazy" />
          {use3d && (
            <Suspense fallback={null}>
              <ProbeStage progress={progress} onReady={onReady} />
            </Suspense>
          )}
        </div>
      </div>
    </section>
  )
}
