import { useEffect, useRef } from 'react'
import { media } from './media'

export function FilmModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.documentElement.classList.add('menu-open')
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('menu-open')
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="film-modal" role="dialog" aria-modal="true" aria-label="AquaScan film" onClick={onClose}>
      <button ref={closeRef} className="film-close" type="button" aria-label="Close film" onClick={onClose}>
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <video
        className="film-video"
        src="/media/aquascan-hero.mp4"
        poster={media.heroPoster.src}
        aria-label="AquaScan vessel field video"
        autoPlay
        muted
        loop
        playsInline
        controls
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
