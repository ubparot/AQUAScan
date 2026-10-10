import { useRef, useState, type ReactNode } from 'react'
import { AquaScanLogo } from '../AquaScanLogo'
import { ChapterNav } from '../ChapterNav'
import { media, type Media } from '../media'
import { ButtonLink, Img, MoreLink, Reveal, SiteLink } from '../primitives'

const highlights: Array<{ caption: string; image: Media }> = [
  { caption: 'Drives itself to the spot you pick on the map.', image: media.boatDusk },
  { caption: 'A winch lowers the probe to the depth you choose.', image: media.probeFront },
  { caption: 'Every reading is tagged with position and depth.', image: media.depthProfiles },
  { caption: 'Operated live from a browser on the shore.', image: media.controlDrive },
  { caption: 'Tested in a pool first, then a pond.', image: media.boatFountain },
]

const steps = [
  { title: 'Navigate.', copy: 'Drive manually or send the vessel to GPS waypoints chosen in the operator interface.' },
  { title: 'Stop.', copy: 'AquaScan holds at each sampling location so the probe can travel straight down.' },
  { title: 'Deploy.', copy: 'The winch pays out the tether and lowers the probe between the pontoons.' },
  { title: 'Measure.', copy: 'Sensors read oxygen, clarity, temperature, dissolved solids, and light at depth.' },
  { title: 'Visualize.', copy: 'Readings become maps, heat maps, depth profiles, and a CSV you can take anywhere.' },
]

const sensors = [
  { name: 'Dissolved oxygen', copy: 'Finds low-oxygen water that stresses fish and other aquatic life.' },
  { name: 'Turbidity', copy: 'Measures clarity and particle density, a sign of runoff or erosion.' },
  { name: 'Temperature', copy: 'Builds a thermal profile to show where the water column stratifies.' },
  { name: 'Total dissolved solids', copy: 'Tracks minerals such as calcium, magnesium, and chloride.' },
  { name: 'Light and UV', copy: 'Read through a clear nose cone to show how far light penetrates.' },
  { name: 'Ultrasonic', copy: 'Measures distance to the bottom to help keep the probe clear of it.' },
]

const specs: Array<{ title: string; items: ReactNode[] }> = [
  {
    title: 'Vessel',
    items: [
      'Semi-autonomous catamaran',
      'Twin pontoons with internal ribbing',
      'Structural parts 3D printed in PETG',
      'Plastic-welded seams sealed with marine-grade epoxy',
      'Carbon-fiber truss supporting the electronics tray',
      'Loaded waterline about 3.5 in. on a 7 in. pontoon',
    ],
  },
  {
    title: 'Propulsion',
    items: [
      'Two 1100 kV brushless motors, one inside each pontoon',
      'Sealed stuffing-tube shafts to external propellers',
      'Passive water cooling through motor jackets',
      'Differential steering',
    ],
  },
  {
    title: 'Power',
    items: [
      '12 V, 100 Ah lithium battery (about 23 lb)',
      <>Expected runtime of 30 to 40 minutes<sup>1</sup></>,
      'Fused distribution to propulsion and electronics',
      'Probe powered through its tether',
    ],
  },
  {
    title: 'Deployment',
    items: [
      'High-torque winch motor with worm gear',
      'Spool-based tether payout and retrieval',
      'Vertical deployment path between the pontoons',
      'Marine cable carries power and data',
    ],
  },
  {
    title: 'Probe',
    items: [
      'About 16 in. long and 3 in. in diameter',
      'Multi-part PETG body, designed to sink',
      'Clear nose cone for light sensing',
      'Four-fin empennage for passive stabilization',
      'O-ring and silicone sealing',
    ],
  },
  {
    title: 'Sensors',
    items: ['Dissolved oxygen', 'Turbidity', 'Temperature', 'Total dissolved solids', 'Light', 'Ultraviolet', 'Ultrasonic bottom distance'],
  },
  {
    title: 'Electronics',
    items: [
      'Arduino Mega main controller',
      'ESP32 surface link for operator Wi-Fi',
      'ESP32 sensor controller inside the probe',
      'RS-485 data over the tether',
    ],
  },
  {
    title: 'Navigation and control',
    items: [
      'Manual drive with an on-screen joystick',
      'GPS waypoint navigation to sampling points',
      'Pause-and-sample at each waypoint',
      'Manual override at any time',
    ],
  },
  {
    title: 'Operator software',
    items: [
      'Browser-based dashboard with Google or email sign-in',
      'Direct Wi-Fi or cloud relay connection',
      'Mission planner, run monitor, and post-mission review',
      'Built-in simulator for practice without hardware',
    ],
  },
  {
    title: 'Data',
    items: [
      'Readings tagged with GPS position and probe depth',
      'CSV export',
      'Heat maps, depth profiles, and mission replay',
      <>In-browser analysis with <SiteLink to="maris">Maris</SiteLink></>,
    ],
  },
]

export function AquaScanPage() {
  return (
    <main id="top">
      <ChapterNav />

      <section className="product-hero" id="overview">
        <Reveal className="product-hero-copy">
          <h1 className="hero-logo hero-logo-large"><AquaScanLogo /></h1>
          <p className="product-hero-subtitle">Water quality, mapped by location and depth.</p>
          <div className="tile-actions">
            <ButtonLink to="contact">Get in touch</ButtonLink>
            <ButtonLink to="products" hash="specs" variant="secondary">Tech specs</ButtonLink>
          </div>
        </Reveal>
        <Reveal className="product-hero-media" delay={150}>
          <Img {...media.vesselPond} eager />
        </Reveal>
      </section>

      <section className="section highlights" aria-labelledby="highlights-title">
        <div className="container">
          <Reveal as="h2" className="section-title" ><span id="highlights-title">Get the highlights.</span></Reveal>
        </div>
        <Gallery />
      </section>

      <section className="section section-render" id="vessel">
        <div className="container">
          <Reveal className="section-head">
            <h2 className="section-title">Two hulls.<br />One steady platform.</h2>
          </Reveal>
        </div>
        <Reveal className="render-media"><Img {...media.boatRender} /></Reveal>
        <div className="container">
          <div className="feature-columns">
            <Reveal as="p">
              <strong>Built to carry weight, not to win races.</strong> A heavy battery, the winch, and the electronics
              all ride on two printed PETG pontoons, stiffened by internal ribs and a carbon-fiber truss.
            </Reveal>
            <Reveal as="p" delay={80}>
              <strong>Motors kept dry.</strong> A brushless motor sits inside each hull and drives its propeller through a
              sealed stuffing tube. Water pushed through a cooling jacket keeps it from overheating under load.
            </Reveal>
            <Reveal as="p" delay={160}>
              <strong>A winch in the middle.</strong> The probe is lowered between the pontoons on a straight vertical
              path, so the boat stays balanced while it samples.
            </Reveal>
          </div>
          <Reveal className="render-pair">
            <figure>
              <Img {...media.boatRenderWinch} />
              <figcaption>Winch and spool, mounted between the pontoons.</figcaption>
            </figure>
            <figure>
              <Img {...media.electronics} />
              <figcaption>Electronics tray: controller, fuses, and battery wiring.</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="section" id="probe">
        <div className="container">
          <Reveal className="section-head section-head-center">
            <h2 className="section-title">It goes down.<br />The data comes up.</h2>
            <p className="section-lede">
              A sealed, 16-inch sensor probe designed to sink. It needs no battery: power goes down the tether and
              readings come back up it.
            </p>
          </Reveal>
        </div>
        <Reveal className="wide-media"><Img {...media.probeShore} /></Reveal>
        <div className="container">
          <div className="sensor-grid">
            {sensors.map((sensor, index) => (
              <Reveal key={sensor.name} className="sensor" delay={(index % 3) * 80}>
                <h3>{sensor.name}</h3>
                <p>{sensor.copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-render section-render-flush">
        <div className="container">
          <div className="split">
            <Reveal className="split-copy">
              <h2 className="section-title section-title-sm">Five parts. Each with a job.</h2>
              <p className="section-lede">
                A clear nose cone lets light reach the sensors. The main body protects the electronics. A component tray
                keeps them organized, the fins keep the probe pointed into the flow, and a reinforced tether mount takes
                the load from the winch.
              </p>
            </Reveal>
            <Reveal className="split-media" delay={100}><Img {...media.probeExploded} /></Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt how" aria-labelledby="how-title">
        <div className="container">
          <Reveal as="h2" className="section-title"><span id="how-title">How a mission works.</span></Reveal>
          <ol className="steps">
            {steps.map((step, index) => (
              <Reveal as="li" key={step.title} className="step" delay={index * 60}>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="software">
        <div className="container">
          <Reveal className="section-head section-head-center">
            <h2 className="section-title">Mission control in the browser.</h2>
            <p className="section-lede">
              Plan the route, drive with an on-screen joystick, and watch battery, depth, and signal update live, either
              directly over Wi-Fi or through a cloud relay. Nothing to install.
            </p>
          </Reveal>
          <Reveal className="screen"><Img {...media.controlDrive} /></Reveal>
          <div className="screen-trio">
            <Reveal as="figure">
              <div className="screen screen-small"><Img {...media.controlPlan} /></div>
              <figcaption><strong>Plan.</strong> Build a waypoint route and check it before launch.</figcaption>
            </Reveal>
            <Reveal as="figure" delay={80}>
              <div className="screen screen-small"><Img {...media.controlRun} /></div>
              <figcaption><strong>Run.</strong> Follow progress waypoint by waypoint, with ETA and takeover state.</figcaption>
            </Reveal>
            <Reveal as="figure" delay={160}>
              <div className="screen screen-small"><Img {...media.controlReview} /></div>
              <figcaption><strong>Review.</strong> Summarize the mission and export the data.</figcaption>
            </Reveal>
          </div>
          <div className="figure-pair">
            <Reveal as="figure">
              <div className="figure-frame figure-frame-cream"><Img {...media.sensorMaps} /></div>
              <figcaption><strong>Location-based heat maps.</strong> One map per sensor, interpolated from GPS-tagged samples.</figcaption>
            </Reveal>
            <Reveal as="figure" delay={100}>
              <div className="figure-frame figure-frame-dark"><Img {...media.depthProfiles} /></div>
              <figcaption><strong>Depth profiles.</strong> Each reading plotted against probe depth to show how the water changes.</figcaption>
            </Reveal>
          </div>
          <Reveal className="center-link"><MoreLink to="maris">Explore the data in Maris</MoreLink></Reveal>
        </div>
      </section>

      <section className="section section-alt" id="testing">
        <div className="container">
          <Reveal className="section-head">
            <h2 className="section-title">Sealed. Floated.<br />Driven. Dipped.</h2>
            <p className="section-lede">
              Every subsystem was tested on its own before the whole vessel went in the water, starting with the riskiest part:
              keeping the electronics dry.
            </p>
          </Reveal>
          <div className="test-grid">
            <Reveal as="figure" className="test-card">
              <Img {...media.sealTest} />
              <figcaption><h3>Seal testing</h3><p>The chosen O-ring design held water for about 12 hours without leaking.</p></figcaption>
            </Reveal>
            <Reveal as="figure" className="test-card" delay={80}>
              <Img {...media.boatPool} />
              <figcaption><h3>Pool testing</h3><p>Flotation, propulsion, probe deployment, and live data in controlled water.</p></figcaption>
            </Reveal>
            <Reveal as="figure" className="test-card" delay={160}>
              <Img {...media.boatDusk} />
              <figcaption><h3>Pond testing</h3><p>Multi-point sampling at varying depths in murky, real-world water.</p></figcaption>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section specs" id="specs" aria-labelledby="specs-title">
        <div className="container">
          <Reveal as="h2" className="section-title"><span id="specs-title">Tech specs</span></Reveal>
          <div className="specs-table">
            {specs.map((group) => (
              <div className="specs-row" key={group.title}>
                <h3>{group.title}</h3>
                <ul>{group.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt cta">
        <Reveal className="container cta-inner">
          <h2 className="section-title section-title-sm">Interested in a pilot?</h2>
          <p className="section-lede">We are looking for research, education, and water-management partners.</p>
          <div className="tile-actions">
            <ButtonLink to="contact">Get in touch</ButtonLink>
            <ButtonLink to="applications" variant="secondary">See applications</ButtonLink>
          </div>
        </Reveal>
      </section>
    </main>
  )
}

export function AquaScanFootnotes() {
  return (
    <ol>
      <li>Runtime is an estimate for the current prototype and depends on speed, payload, and winch use.</li>
      <li>AquaScan is a working prototype in active development. Specifications describe the current build and may change.</li>
    </ol>
  )
}

function Gallery() {
  const trackRef = useRef<HTMLUListElement>(null)
  const [position, setPosition] = useState<'start' | 'middle' | 'end'>('start')

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('li')
    const step = card ? card.getBoundingClientRect().width + 20 : track.clientWidth * 0.8
    track.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const update = () => {
    const track = trackRef.current
    if (!track) return
    const max = track.scrollWidth - track.clientWidth - 4
    setPosition(track.scrollLeft <= 4 ? 'start' : track.scrollLeft >= max ? 'end' : 'middle')
  }

  return (
    <div className="gallery">
      <ul className="gallery-track" ref={trackRef} onScroll={update}>
        {highlights.map((item) => (
          <li key={item.caption} className="gallery-card">
            <Img {...item.image} />
            <p>{item.caption}</p>
          </li>
        ))}
      </ul>
      <div className="gallery-controls">
        <button type="button" aria-label="Previous highlight" disabled={position === 'start'} onClick={() => scroll(-1)}>
          <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" aria-label="Next highlight" disabled={position === 'end'} onClick={() => scroll(1)}>
          <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  )
}
