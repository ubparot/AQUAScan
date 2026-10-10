import { media } from '../media'
import { ButtonLink, Img, MoreLink, Reveal } from '../primitives'
import { ProbeHero } from '../ProbeHero'

export function HomePage() {
  return (
    <main id="top">
      <ProbeHero />

      <section className="tile tile-dark home-vessel">
        <Reveal className="tile-copy">
          <h2 className="tile-title">The vessel</h2>
          <p className="tile-subtitle">Two hulls. One steady platform.</p>
          <div className="tile-actions">
            <ButtonLink to="products" hash="vessel">Learn more</ButtonLink>
            <ButtonLink to="products" hash="specs" variant="secondary">Tech specs</ButtonLink>
          </div>
        </Reveal>
        <div className="home-vessel-media">
          <Img {...media.vesselPond} />
        </div>
      </section>

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

      <section className="tile-grid">
        <Reveal className="tile tile-dark tile-half">
          <div className="tile-copy">
            <h2 className="tile-title tile-title-sm">Maris</h2>
            <p className="tile-subtitle tile-subtitle-sm">Explore water-quality analysis in your browser.</p>
            <div className="tile-actions">
              <ButtonLink to="maris">Open Maris</ButtonLink>
            </div>
          </div>
          <div className="tile-half-media"><Img {...media.depthProfiles} /></div>
        </Reveal>
        <Reveal className="tile tile-light tile-half" delay={100}>
          <div className="tile-copy">
            <h2 className="tile-title tile-title-sm">Live control</h2>
            <p className="tile-subtitle tile-subtitle-sm">Drive, sample, and record from the shore.</p>
            <div className="tile-actions">
              <ButtonLink to="control">Sign in</ButtonLink>
              <ButtonLink to="products" hash="software" variant="secondary">Learn more</ButtonLink>
            </div>
          </div>
          <div className="tile-half-media tile-half-media-framed"><Img {...media.controlDrive} /></div>
        </Reveal>
        <Reveal className="tile tile-light tile-half">
          <div className="tile-copy">
            <h2 className="tile-title tile-title-sm">Applications</h2>
            <p className="tile-subtitle tile-subtitle-sm">Ponds, lakes, classrooms, and restoration sites.</p>
            <div className="tile-actions">
              <ButtonLink to="applications" variant="secondary">Learn more</ButtonLink>
            </div>
          </div>
          <div className="tile-half-media tile-half-media-bleed"><Img {...media.boatFountain} /></div>
        </Reveal>
        <Reveal className="tile tile-white tile-half" delay={100}>
          <div className="tile-copy">
            <h2 className="tile-title tile-title-sm">AquaLabs</h2>
            <p className="tile-subtitle tile-subtitle-sm">Built in Chesapeake, Virginia.</p>
            <div className="tile-actions">
              <ButtonLink to="company" variant="secondary">About us</ButtonLink>
            </div>
          </div>
          <div className="tile-half-media tile-half-media-bleed"><Img {...media.probeSand} /></div>
        </Reveal>
      </section>

    </main>
  )
}
