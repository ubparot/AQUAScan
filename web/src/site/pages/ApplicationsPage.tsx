import { media, type Media } from '../media'
import { ButtonLink, Img, Reveal } from '../primitives'

const uses: Array<{ title: string; copy: string; image: Media }> = [
  {
    title: 'Ponds and lakes',
    copy: 'Compare conditions across a whole recreational, educational, or managed water body instead of trusting one sample from the shore.',
    image: media.boatFountain,
  },
  {
    title: 'Research and education',
    copy: 'Give students and research teams one platform that connects field sampling, robotics, mapping, and data analysis.',
    image: media.probeFront,
  },
  {
    title: 'Restoration monitoring',
    copy: 'Return to the same GPS points over time to see whether a restoration project is changing the water.',
    image: media.turbidityMap,
  },
  {
    title: 'Targeted investigation',
    copy: 'Collect denser readings around suspected runoff, an outfall, or an area that looks different from the rest.',
    image: media.probeSand,
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
          <div className="depth-explainer">
            <Reveal className="depth-copy">
              <h2 className="section-title section-title-sm">The surface doesn’t tell the whole story.</h2>
              <p className="section-lede">
                In warm months, many lakes and ponds separate into layers. Bottom water can lose its oxygen while the surface
                still looks fine. A surface-only reading misses that. A profile from top to bottom shows it.
              </p>
            </Reveal>
            <Reveal className="depth-diagram" delay={120}>
              <DepthDiagram />
            </Reveal>
          </div>
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

      <section className="section cta">
        <Reveal className="container cta-inner">
          <h2 className="section-title section-title-sm">Have a site in mind?</h2>
          <p className="section-lede">Tell us about the water you study or manage.</p>
          <div className="tile-actions">
            <ButtonLink to="contact">Get in touch</ButtonLink>
            <ButtonLink to="products" variant="secondary">Explore AquaScan</ButtonLink>
          </div>
        </Reveal>
      </section>
    </main>
  )
}

/** Simple stratified water column: warm, oxygen-rich surface over cold, low-oxygen bottom water. */
function DepthDiagram() {
  const layers = [
    { label: 'Surface', note: 'Warm, mixed by wind', y: 40, h: 86, fill: 'var(--layer-1)' },
    { label: 'Transition', note: 'Temperature drops quickly', y: 126, h: 70, fill: 'var(--layer-2)' },
    { label: 'Bottom', note: 'Cold, oxygen can run low', y: 196, h: 144, fill: 'var(--layer-3)' },
  ]
  return (
    <svg viewBox="0 0 440 340" role="img" aria-label="Diagram of a stratified water column with a probe sampling at three depths">
      {layers.map((layer) => (
        <g key={layer.label}>
          <rect x="0" y={layer.y} width="440" height={layer.h} fill={layer.fill} />
          <text x="22" y={layer.y + 30} className="diagram-label">{layer.label}</text>
          <text x="22" y={layer.y + 50} className="diagram-note">{layer.note}</text>
        </g>
      ))}
      <path d="M0 40 Q 55 32 110 40 T 220 40 T 330 40 T 440 40" fill="none" stroke="var(--diagram-line)" strokeWidth="1.5" />
      <line x1="330" y1="10" x2="330" y2="276" stroke="var(--diagram-line)" strokeWidth="1.5" strokeDasharray="3 5" />
      <rect x="306" y="2" width="48" height="16" rx="8" fill="var(--diagram-line)" />
      {[84, 160, 262].map((cy) => <circle key={cy} cx="330" cy={cy} r="5" fill="var(--diagram-dot)" />)}
      <rect x="322" y="268" width="16" height="34" rx="8" fill="var(--diagram-line)" />
    </svg>
  )
}
