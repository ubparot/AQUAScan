import { Reveal } from './primitives'
import { PROFILE } from './sampleProfile'

const [, , surfaceOxygen] = PROFILE[0]
const [bottomDepth, , bottomOxygen] = PROFILE[PROFILE.length - 1]
const drop = Math.round((1 - bottomOxygen / surfaceOxygen) * 100)

/** "The surface doesn't tell the whole story", said as one headline: how much oxygen is missing at the bottom. */
export function SurfaceVsDepth() {
  return (
    <figure className="svd">
      <Reveal>
        <p className="svd-sentence">
          <span className="svd-grad">{drop}% less oxygen</span> at the bottom than at the surface.
        </p>
        <p className="svd-sub">Same spot, {bottomDepth} m apart. A surface sample would never know.</p>
      </Reveal>
      <figcaption>Dissolved oxygen at one pond station, sample data.</figcaption>
    </figure>
  )
}
