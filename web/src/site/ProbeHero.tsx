import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AquaScanLogo } from './AquaScanLogo'
import { FilmModal } from './FilmModal'
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
 * Home hero: the real probe CAD on a light stage, shown from a fixed angle.
 * It expands into an exploded view as the hero scrolls away. The page scrolls normally; nothing is pinned.
 */
export function ProbeHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const progress = useRef(0)
  const [use3d] = useState(() => typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined' && webglAvailable())
  const [modelReady, setModelReady] = useState(false)
  const [filmOpen, setFilmOpen] = useState(false)
  const closeFilm = useCallback(() => setFilmOpen(false), [])
  const onReady = useCallback(() => setModelReady(true), [])

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current
      if (!section) return
      // 0 at the top of the page, 1 once the hero is 40% scrolled away.
      const rect = section.getBoundingClientRect()
      const p = clamp(-rect.top / Math.max(1, rect.height * 0.4))
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
    <section ref={sectionRef} className="probe-hero" data-3d={use3d} aria-labelledby="probe-hero-title">
      <div className="probe-hero-inner">
        <div className="probe-hero-copy">
          <h1 id="probe-hero-title" className="hero-logo"><AquaScanLogo /></h1>
          <p className="tile-subtitle">See below the surface.</p>
          <div className="tile-actions">
            <ButtonLink to="products">Learn more</ButtonLink>
            <button className="button button-secondary" type="button" onClick={() => setFilmOpen(true)}>
              Watch the film
              <svg viewBox="0 0 10 12" width="9" height="11" aria-hidden="true"><path d="M1 1v10l8-5z" fill="currentColor" /></svg>
            </button>
          </div>
        </div>

        <div className="probe-stage" data-ready={modelReady}>
          <img className="probe-poster" src="/media/site/probe-hero.webp" alt={use3d ? '' : 'The AquaScan sensor probe'} width={1600} height={1000} />
          {use3d && (
            <Suspense fallback={null}>
              <ProbeStage progress={progress} onReady={onReady} />
            </Suspense>
          )}
        </div>

      </div>
      {filmOpen && <FilmModal onClose={closeFilm} />}
    </section>
  )
}
