import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { WindowFrame } from './Badges'
import { media, type Media } from './media'
import { beatAt } from './missionTimeline'
import { Img } from './primitives'
import { clamp } from './probeTimeline'
import { webglAvailable } from './webgl'

const MissionStage = lazy(() => import('./MissionStage'))

const story: Array<{ title: string; copy: string; image: Media; screen?: boolean }> = [
  {
    title: 'Drives itself.',
    copy: 'Pick a point on the map and AquaScan finds its own way there by GPS, on two brushless motors, one in each hull.',
    image: media.pondUnderway,
  },
  {
    title: 'Lowers the probe where it stops.',
    copy: 'A winch pays out the tether and drops the probe straight down between the pontoons.',
    image: media.poolDeploy,
  },
  {
    title: 'Reads every depth.',
    copy: 'Seven sensors measure oxygen, clarity, temperature, dissolved solids, and light all the way down.',
    image: media.underwaterProbe,
  },
  {
    title: 'Maps what it finds.',
    copy: 'Every reading is tagged with position and depth, so the results land on a map, ready to explore in Maris.',
    image: media.marisApp,
    screen: true,
  },
]

/**
 * "Get the highlights": the picture stays pinned while the four highlights scroll past it. Where WebGL is
 * available the picture is a 3D mission that plays with the scroll: the boat drives to a point, lowers the
 * probe, takes readings on the way down, and the results become a map. Elsewhere it swaps between photos.
 */
export function HighlightStory() {
  const listRef = useRef<HTMLOListElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const [active, setActive] = useState(0)
  const [use3d] = useState(webglAvailable)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const list = listRef.current
      if (!list) return
      // Progress is read along a line across the screen: its middle beside the pinned picture, or low in the
      // space under the picture where it pins across the top (narrow screens), so the active text stays in view.
      // 0 when the list's top reaches the line, 1 when its bottom does.
      const vh = window.innerHeight
      const media = mediaRef.current?.getBoundingClientRect()
      const stacked = media && media.width >= window.innerWidth * 0.9
      const line = stacked && media ? media.bottom + (vh - media.bottom) * 0.75 : vh / 2
      const rect = list.getBoundingClientRect()
      const p = clamp((line - rect.top) / Math.max(1, rect.height))
      progress.current = p
      setActive(beatAt(p))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <div className="hstory" data-3d={use3d}>
      <div className="hstory-media" ref={mediaRef} data-ready={ready}>
        <div className="hstory-photos" aria-hidden="true">
          {story.map((item, index) => (
            <div key={item.title} className={item.screen ? 'hstory-frame hstory-frame-screen' : 'hstory-frame'} data-active={index === active}>
              {item.screen ? <WindowFrame><Img {...item.image} /></WindowFrame> : <Img {...item.image} />}
            </div>
          ))}
        </div>
        {use3d && (
          <Suspense fallback={null}>
            <MissionStage progress={progress} onReady={onReady} />
          </Suspense>
        )}
      </div>
      <ol className="hstory-steps" ref={listRef}>
        {story.map((item, index) => (
          <li key={item.title} className="hstory-step" data-active={index === active}>
            <div className={item.screen ? 'hstory-inline hstory-inline-screen' : 'hstory-inline'}>
              {item.screen ? <WindowFrame><Img {...item.image} /></WindowFrame> : <Img {...item.image} />}
            </div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
