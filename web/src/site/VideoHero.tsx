import { useCallback, useEffect, useRef, useState } from 'react'
import { FilmModal } from './FilmModal'

/**
 * Home hero: a silent loop of real field footage (pond, pool, underwater) behind what AquaLabs does.
 * It deliberately doesn't name AquaScan; the next section introduces it.
 * Visitors can pause it; anyone who prefers reduced motion gets the still poster until they press play.
 */
export function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [filmOpen, setFilmOpen] = useState(false)
  const closeFilm = useCallback(() => setFilmOpen(false), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce) video.play()?.catch(() => undefined)
  }, [])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()?.catch(() => undefined)
    else video.pause()
  }

  return (
    <section className="video-hero" aria-labelledby="hero-title">
      <video
        ref={videoRef}
        className="video-hero-media"
        src="/media/aquascan-field.mp4"
        poster="/media/aquascan-field-poster.jpg"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="video-hero-scrim" aria-hidden="true" />
      <div className="video-hero-copy">
        <h1 id="hero-title" className="video-hero-title">Technology for understanding the water.</h1>
        <p className="video-hero-byline">
          AquaLabs designs and builds tools for studying ponds, lakes, and waterways: vessels that go where the samples are,
          sensors that read the water at every depth, and software that turns those readings into answers.
        </p>
        <div className="tile-actions">
          <a className="button button-primary" href="#introducing">See what we build</a>
          <button className="button button-secondary button-on-dark" type="button" onClick={() => setFilmOpen(true)}>
            Watch the film
            <svg viewBox="0 0 10 12" width="9" height="11" aria-hidden="true"><path d="M1 1v10l8-5z" fill="currentColor" /></svg>
          </button>
        </div>
      </div>
      <button className="video-hero-toggle" type="button" onClick={toggle} aria-label={playing ? 'Pause background video' : 'Play background video'}>
        {playing ? (
          <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true"><path d="M1.5 1h3v12h-3zM7.5 1h3v12h-3z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true"><path d="M2 1v12l9-6z" fill="currentColor" /></svg>
        )}
      </button>
      {filmOpen && <FilmModal onClose={closeFilm} />}
    </section>
  )
}
