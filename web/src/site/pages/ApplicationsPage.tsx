import { SurveyBand } from '../Badges'
import { DepthGraphic } from '../DepthGraphic'
import { media, type Media } from '../media'
import { Img, Reveal } from '../primitives'

const uses: Array<{ title: string; copy: string; image: Media }> = [
  {
    title: 'Ponds and lakes',
    copy: 'Compare conditions across a whole recreational, educational, or managed water body instead of trusting one sample from the shore.',
    image: media.boatFountain,
  },
  {
    title: 'Research and education',
    copy: 'Give students and research teams one platform that connects field sampling, robotics, mapping, and data analysis.',
    image: media.poolDeploy,
  },
  {
    title: 'Restoration monitoring',
    copy: 'Return to the same GPS points over time to see whether a restoration project is changing the water.',
    image: media.pondTest,
  },
  {
    title: 'Targeted investigation',
    copy: 'Profile the water column around suspected runoff, an outfall, or an area that looks different from the rest.',
    image: media.underwaterProbe,
  },
]

export function ApplicationsPage() {
  return (
    <main id="top">
      <section className="page-hero">
        <Reveal className="container">
          <h1 className="page-hero-title">Made for the water<br />you actually work on.</h1>
          <p className="page-hero-lede">
            AquaScan is designed for calm, shallow, and sheltered water: the ponds, coves, and nearshore areas that are hard
            to reach with large survey boats and poorly covered by fixed stations.
          </p>
        </Reveal>
      </section>

      <section className="section section-dark">
        <div className="container">
          <Reveal className="depth-intro">
            <h2 className="section-title section-title-sm">The surface doesn’t tell the whole story.</h2>
            <p className="section-lede">
              In warm months, ponds and lakes settle into layers. Bottom water can run out of oxygen while the surface still
              looks fine. A reading at the surface misses it. A profile from top to bottom shows it.
            </p>
          </Reveal>
          <DepthGraphic />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal as="h2" className="section-title">Where it fits.</Reveal>
          <div className="use-list">
            {uses.map((use, index) => (
              <Reveal key={use.title} className={index % 2 === 1 ? 'use-row use-row-flip' : 'use-row'}>
                <div className="use-media"><Img {...use.image} /></div>
                <div className="use-copy">
                  <h3>{use.title}</h3>
                  <p>{use.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="value-grid">
            <Reveal className="value">
              <h3>Know where every reading came from.</h3>
              <p>GPS-linked samples make fieldwork repeatable and results easy to put on a map.</p>
            </Reveal>
            <Reveal className="value" delay={80}>
              <h3>See below the surface.</h3>
              <p>Depth-aware sampling reveals vertical changes that surface measurements miss.</p>
            </Reveal>
            <Reveal className="value" delay={160}>
              <h3>Build a record over time.</h3>
              <p>Repeat missions produce comparable datasets for tracking trends and change.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <SurveyBand />
    </main>
  )
}
