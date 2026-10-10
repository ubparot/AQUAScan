import { AquaScanLogo } from '../AquaScanLogo'
import { SurveyBand, WindowFrame } from '../Badges'
import { media } from '../media'
import { ButtonLink, Img, MoreLink, Reveal } from '../primitives'
import { ProbeSection } from '../ProbeSection'
import { useScrollSheen } from '../useScrollSheen'
import { VideoHero } from '../VideoHero'

const introPoints = [
  { title: 'Drives itself.', copy: 'Follows a planned GPS route out to every sampling point.' },
  { title: 'Reads every depth.', copy: 'Lowers a seven-sensor probe from the surface to the bottom.' },
  { title: 'Maps what it finds.', copy: 'Tags each reading with place and depth, ready to explore in Maris.' },
]

export function HomePage() {
  const sheenRef = useScrollSheen<HTMLParagraphElement>()
  return (
    <main id="top">
      <VideoHero />

      <section className="intro" id="introducing" aria-labelledby="intro-title">
        <div className="intro-stage">
          <Img {...media.vesselPond} className="intro-photo" focus="50% 30%" />
          <div className="intro-copy">
            <div className="intro-title-row">
              <p ref={sheenRef} className="intro-lead">Introducing</p>
              <h2 id="intro-title" className="hero-logo"><AquaScanLogo tone="light" /></h2>
            </div>
            <p className="intro-subtitle">Our autonomous water-quality research boat.</p>
            <div className="tile-actions">
              <ButtonLink to="products">Learn more</ButtonLink>
              <ButtonLink to="products" hash="specs" variant="secondary">Tech specs</ButtonLink>
            </div>
          </div>
          <ul className="intro-points">
            {introPoints.map((point) => (
              <li key={point.title} className="intro-point">
                <h3>{point.title}</h3>
                <p>{point.copy}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ProbeSection />

      <section className="section statement">
        <Reveal as="p" className="statement-copy">
          Most water-quality readings are taken at the surface.{' '}
          <strong>But oxygen, clarity, and temperature change with depth.</strong>{' '}
          AquaScan drives to a sampling point, lowers a sensor probe through the water column, and records what it
          measured, where, and how deep.
        </Reveal>
      </section>

      <section className="section section-alt">
        <div className="container">
          <Reveal as="h2" className="section-title">The numbers.</Reveal>
          <dl className="stats">
            <Reveal className="stat"><dt>Sensors on the probe</dt><dd>7</dd></Reveal>
            <Reveal className="stat" delay={80}><dt>Probe length</dt><dd>16<small>in.</small></dd></Reveal>
            <Reveal className="stat" delay={160}><dt>Lithium battery</dt><dd>100<small>Ah</small></dd></Reveal>
            <Reveal className="stat" delay={240}><dt>Brushless motors, one per hull</dt><dd>2</dd></Reveal>
          </dl>
          <Reveal><MoreLink to="products" hash="specs">See all tech specs</MoreLink></Reveal>
        </div>
      </section>

      <section className="explore" aria-labelledby="explore-title">
        <div className="container">
          <Reveal as="h2" className="section-title"><span id="explore-title">Explore AquaScan.</span></Reveal>
        </div>
        <div className="explore-grid">
          <Reveal className="explore-card explore-photo">
            <Img {...media.pondUnderway} />
            <div className="explore-copy">
              <h3>The vessel</h3>
              <p>Two hulls, a winch, and GPS navigation on one steady platform.</p>
              <ButtonLink to="products" hash="vessel">Learn more</ButtonLink>
            </div>
          </Reveal>
          <Reveal className="explore-card explore-photo" delay={80}>
            <Img {...media.poolDeploy} />
            <div className="explore-copy">
              <h3>Where it fits</h3>
              <p>Ponds, lakes, classrooms, and restoration sites.</p>
              <ButtonLink to="applications">See applications</ButtonLink>
            </div>
          </Reveal>
          <Reveal className="explore-card explore-screen">
            <div className="explore-copy">
              <h3>Maris</h3>
              <p>AquaScan’s analysis software. Explore readings by place and depth, right in your browser.</p>
              <ButtonLink to="maris">Open Maris</ButtonLink>
            </div>
            <WindowFrame><Img {...media.marisApp} /></WindowFrame>
          </Reveal>
          <Reveal className="explore-card explore-screen" delay={80}>
            <div className="explore-copy">
              <h3>Live control</h3>
              <p>Plan the route, drive, and watch the data arrive, all from the shore.</p>
              <ButtonLink to="products" hash="software">Learn more</ButtonLink>
            </div>
            <WindowFrame><Img {...media.controlDrive} /></WindowFrame>
          </Reveal>
        </div>
      </section>

      <SurveyBand />
    </main>
  )
}
