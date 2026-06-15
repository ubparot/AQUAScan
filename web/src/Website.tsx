import {
  Activity,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  ChevronRight,
  Database,
  Gauge,
  Layers3,
  Map,
  MapPin,
  Menu,
  Radio,
  Route,
  Satellite,
  ShipWheel,
  Waves,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import App from './App'
import './Website.css'

type SitePage = 'home' | 'technology' | 'impact' | 'about' | 'control'

const pagePaths: Record<SitePage, string> = {
  home: '/',
  technology: '/technology',
  impact: '/impact',
  about: '/about',
  control: '/control',
}

const pageTitles: Record<SitePage, string> = {
  home: 'AQUAScan | Mobile Water-Quality Monitoring',
  technology: 'Technology | AQUAScan',
  impact: 'Impact | AQUAScan',
  about: 'About | AQUAScan',
  control: 'Live Control | AQUAScan',
}

function pageFromPath(pathname: string): SitePage {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/control') return 'control'
  if (path === '/technology') return 'technology'
  if (path === '/impact') return 'impact'
  if (path === '/about') return 'about'
  return 'home'
}

function Website() {
  const [page, setPage] = useState<SitePage>(() => pageFromPath(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.title = pageTitles[page]
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page])

  const navigate = (nextPage: SitePage) => {
    const nextPath = pagePaths[nextPage]
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPage(nextPage)
  }

  if (page === 'control') {
    return (
      <div className="control-route">
        <button className="control-back" type="button" onClick={() => navigate('home')}>
          <Waves size={18} />
          AQUAScan site
        </button>
        <App />
      </div>
    )
  }

  return <MarketingSite page={page} navigate={navigate} />
}

function MarketingSite({ page, navigate }: { page: Exclude<SitePage, 'control'>; navigate: (page: SitePage) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const go = (nextPage: SitePage) => {
    setMenuOpen(false)
    navigate(nextPage)
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="site-brand" type="button" onClick={() => go('home')} aria-label="AQUAScan home">
          <span className="brand-mark"><Waves size={23} /></span>
          <span>
            <strong>AQUAScan</strong>
            <small>Water intelligence, in motion</small>
          </span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          <SiteNavButton label="Home" active={page === 'home'} onClick={() => go('home')} />
          <SiteNavButton label="Technology" active={page === 'technology'} onClick={() => go('technology')} />
          <SiteNavButton label="Impact" active={page === 'impact'} onClick={() => go('impact')} />
          <SiteNavButton label="About" active={page === 'about'} onClick={() => go('about')} />
        </nav>

        <button className="site-control-button" type="button" onClick={() => go('control')}>
          <Radio size={17} />
          Open live control
        </button>

        <button className="mobile-menu-button" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>

        {menuOpen && (
          <nav className="mobile-site-nav" aria-label="Mobile navigation">
            <SiteNavButton label="Home" active={page === 'home'} onClick={() => go('home')} />
            <SiteNavButton label="Technology" active={page === 'technology'} onClick={() => go('technology')} />
            <SiteNavButton label="Impact" active={page === 'impact'} onClick={() => go('impact')} />
            <SiteNavButton label="About" active={page === 'about'} onClick={() => go('about')} />
            <button className="site-control-button" type="button" onClick={() => go('control')}>
              <Radio size={17} />
              Open live control
            </button>
          </nav>
        )}
      </header>

      {page === 'home' && <HomePage navigate={go} />}
      {page === 'technology' && <TechnologyPage navigate={go} />}
      {page === 'impact' && <ImpactPage navigate={go} />}
      {page === 'about' && <AboutPage navigate={go} />}

      <footer className="site-footer">
        <div className="site-brand footer-brand">
          <span className="brand-mark"><Waves size={23} /></span>
          <span><strong>AQUAScan</strong><small>Mobile environmental monitoring</small></span>
        </div>
        <p>A semi-autonomous platform connecting navigation, depth-aware sampling, and scientific visualization.</p>
        <button type="button" onClick={() => go('control')}>Operator interface <ArrowRight size={16} /></button>
      </footer>
    </div>
  )
}

function HomePage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="site-kicker"><span /> Mobile environmental monitoring</p>
          <h1>See more of the water.<br /><em>Understand what changes.</em></h1>
          <p className="hero-lede">
            AQUAScan is a semi-autonomous surface vessel built to collect water-quality data across location and depth,
            turning field measurements into clear, connected environmental insight.
          </p>
          <div className="hero-actions">
            <button className="site-primary-button" type="button" onClick={() => navigate('technology')}>
              Explore the system <ArrowRight size={18} />
            </button>
            <button className="site-secondary-button" type="button" onClick={() => navigate('control')}>
              <ShipWheel size={18} /> Open live control
            </button>
          </div>
          <div className="hero-proof">
            <span><strong>GPS</strong> guided missions</span>
            <span><strong>Multi-depth</strong> sampling</span>
            <span><strong>Live</strong> data visualization</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="AQUAScan system overview illustration">
          <div className="sonar-ring sonar-ring-one" />
          <div className="sonar-ring sonar-ring-two" />
          <div className="hero-map-line route-one" />
          <div className="hero-map-line route-two" />
          <div className="hero-map-point point-one"><span>01</span></div>
          <div className="hero-map-point point-two"><span>02</span></div>
          <div className="hero-map-point point-three"><span>03</span></div>
          <div className="vessel-card">
            <div className="vessel-top"><span /><span /></div>
            <div className="vessel-deck"><Satellite size={25} /></div>
            <div className="vessel-hull hull-left" />
            <div className="vessel-hull hull-right" />
            <div className="probe-line"><span /></div>
          </div>
          <div className="visual-readout readout-position"><MapPin size={15} /><span>Target waypoint</span><strong>42.318° N</strong></div>
          <div className="visual-readout readout-sensor"><Activity size={15} /><span>Water profile</span><strong>7 metrics live</strong></div>
          <div className="visual-status"><span /> System connected</div>
        </div>
      </section>

      <section className="site-section intro-section">
        <div className="section-heading-block">
          <p className="site-kicker"><span /> One connected workflow</p>
          <h2>From mission plan to usable science</h2>
          <p>AQUAScan brings vessel operation, sensor collection, and data interpretation into one platform.</p>
        </div>
        <div className="workflow-grid">
          <FeatureCard number="01" icon={<Route />} title="Navigate" copy="Drive manually or guide the vessel toward selected GPS sampling locations." />
          <FeatureCard number="02" icon={<Layers3 />} title="Sample" copy="Collect environmental readings tied to position, time, and depth through the water column." />
          <FeatureCard number="03" icon={<BarChart3 />} title="Understand" copy="Review mapped measurements, charts, heat maps, mission replays, and exportable records." />
        </div>
      </section>

      <section className="site-section system-band">
        <div className="system-band-copy">
          <p className="site-kicker light"><span /> Built for field awareness</p>
          <h2>A live view of the vessel, mission, and environment.</h2>
          <p>
            Operators can follow position, heading, motor output, connection health, mission progress, and sensor
            readings while the vessel is operating.
          </p>
          <button type="button" onClick={() => navigate('control')}>Enter operator interface <ArrowRight size={17} /></button>
        </div>
        <div className="metric-stack">
          <MetricCard icon={<Gauge />} label="Mission status" value="Live" detail="Position and system health" />
          <MetricCard icon={<Activity />} label="Sensor profile" value="Multi-depth" detail="Measurements linked to place" />
          <MetricCard icon={<Database />} label="Data output" value="Structured" detail="Ready for analysis and export" />
        </div>
      </section>

      <section className="site-section use-section">
        <div className="section-heading-block">
          <p className="site-kicker"><span /> Why AQUAScan</p>
          <h2>Better coverage. Better context.</h2>
        </div>
        <div className="use-grid">
          <UseCard title="Spatial awareness" copy="Compare conditions across an area instead of relying on a single fixed reading." />
          <UseCard title="Vertical insight" copy="Study how water-quality conditions change below the surface at selected locations." />
          <UseCard title="Repeatable monitoring" copy="Return to known GPS points and compare measurements across missions." />
          <UseCard title="Clear communication" copy="Turn complex field readings into maps, charts, layers, and reports." />
        </div>
      </section>

      <CallToAction navigate={navigate} />
    </main>
  )
}

function TechnologyPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero kicker="The platform" title="One vessel. Four connected systems." copy="AQUAScan combines propulsion, navigation, deployable sensing, and a digital operator interface into a single environmental monitoring workflow." />
      <section className="site-section tech-grid">
        <FeatureCard number="01" icon={<ShipWheel />} title="Vessel control" copy="Dual-motor differential steering supports direct manual operation and precise field adjustments." />
        <FeatureCard number="02" icon={<Satellite />} title="GPS navigation" copy="Selected sampling locations and mission routes connect measurements to repeatable positions." />
        <FeatureCard number="03" icon={<Layers3 />} title="Depth-aware probe" copy="A deployable multi-sensor probe records conditions through the water column." />
        <FeatureCard number="04" icon={<Radio />} title="Live communication" copy="Wireless telemetry connects vessel status, control commands, and field readings." />
        <FeatureCard number="05" icon={<Map />} title="Mission visualization" copy="Interactive mapping presents paths, sample points, measurements, and environmental layers." />
        <FeatureCard number="06" icon={<Database />} title="Flexible output" copy="Structured mission data supports spreadsheets, GIS tools, scientific analysis, and reports." />
      </section>
      <section className="site-section process-section">
        <div className="section-heading-block">
          <p className="site-kicker"><span /> Mission workflow</p>
          <h2>A direct path from field operation to analysis</h2>
        </div>
        <div className="process-list">
          <ProcessStep number="01" title="Plan the mission" copy="Choose the operating area, sampling locations, target variables, and mission route." />
          <ProcessStep number="02" title="Operate and monitor" copy="Control the vessel while tracking live position, system health, sensor data, and sampling progress." />
          <ProcessStep number="03" title="Review the environment" copy="Use mapped values, data layers, charts, and mission replay to inspect patterns." />
          <ProcessStep number="04" title="Export and compare" copy="Move structured records into analysis, mapping, database, and reporting workflows." />
        </div>
      </section>
      <CallToAction navigate={navigate} />
    </main>
  )
}

function ImpactPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero kicker="Environmental value" title="Monitoring that captures more than the surface." copy="Water conditions can change across short distances and throughout the water column. AQUAScan is designed to make those changes visible." />
      <section className="site-section impact-layout">
        <div className="impact-panel">
          <MapPin size={27} />
          <p className="site-kicker"><span /> Location</p>
          <h2>Know where every reading came from.</h2>
          <p>GPS-linked measurements support repeatable fieldwork, clearer comparisons, and map-based interpretation.</p>
        </div>
        <div className="impact-panel impact-panel-dark">
          <Layers3 size={27} />
          <p className="site-kicker light"><span /> Depth</p>
          <h2>Reveal conditions below the surface.</h2>
          <p>Depth-aware sampling helps identify vertical changes that surface-only measurements may miss.</p>
        </div>
        <div className="impact-panel impact-panel-accent">
          <BarChart3 size={27} />
          <p className="site-kicker light"><span /> Time</p>
          <h2>Build a record that becomes more valuable.</h2>
          <p>Repeated missions create comparable datasets for studying trends and environmental change.</p>
        </div>
      </section>
      <section className="site-section use-section">
        <div className="section-heading-block">
          <p className="site-kicker"><span /> Potential applications</p>
          <h2>Designed for calm-water monitoring missions</h2>
        </div>
        <div className="use-grid">
          <UseCard title="Ponds and lakes" copy="Map water-quality differences across recreational, educational, or managed water bodies." />
          <UseCard title="Research and education" copy="Give teams a connected platform for learning field sampling, robotics, and data analysis." />
          <UseCard title="Restoration monitoring" copy="Compare conditions across locations and over time as environmental work progresses." />
          <UseCard title="Targeted investigation" copy="Collect more detailed readings around suspected changes, runoff, or unusual conditions." />
        </div>
      </section>
      <CallToAction navigate={navigate} />
    </main>
  )
}

function AboutPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero kicker="About AQUAScan" title="Engineering a clearer view of aquatic environments." copy="AQUAScan was developed as an integrated solution to a practical monitoring problem: environmental data becomes more useful when it is connected to location, depth, and a repeatable collection process." />
      <section className="site-section about-grid">
        <div className="about-story">
          <p className="site-kicker"><span /> The idea</p>
          <h2>Move the monitoring platform, not the sampling team.</h2>
          <p>
            Traditional sampling can be time-consuming, difficult to repeat precisely, and limited in spatial or
            depth coverage. AQUAScan brings the instruments to selected locations and organizes the resulting data
            as part of the mission.
          </p>
          <p>
            The result is more than a remotely controlled boat. It is a connected environmental data-collection
            platform designed around navigation, sampling, visualization, and reuse.
          </p>
        </div>
        <div className="principles-list">
          <MetricCard icon={<MapPin />} label="Principle 01" value="Context" detail="Every reading should connect to place and depth." />
          <MetricCard icon={<Route />} label="Principle 02" value="Repeatability" detail="Monitoring should support meaningful comparison." />
          <MetricCard icon={<Activity />} label="Principle 03" value="Visibility" detail="Operators should understand the system in real time." />
          <MetricCard icon={<Database />} label="Principle 04" value="Usability" detail="Collected data should be ready for further work." />
        </div>
      </section>
      <section className="site-section future-band">
        <BatteryCharging size={32} />
        <div>
          <p className="site-kicker light"><span /> Continued development</p>
          <h2>Built as a platform for refinement.</h2>
          <p>Future work can expand autonomy, endurance, obstacle awareness, sensor capability, and long-term field validation.</p>
        </div>
      </section>
      <CallToAction navigate={navigate} />
    </main>
  )
}

function SiteNavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" data-active={active} onClick={onClick}>{label}</button>
}

function PageHero({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <section className="page-hero">
      <p className="site-kicker light"><span /> {kicker}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </section>
  )
}

function FeatureCard({ number, icon, title, copy }: { number: string; icon: ReactNode; title: string; copy: string }) {
  return (
    <article className="feature-card">
      <div className="feature-card-top"><span>{icon}</span><small>{number}</small></div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <ChevronRight size={18} />
    </article>
  )
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
    </article>
  )
}

function UseCard({ title, copy }: { title: string; copy: string }) {
  return <article className="use-card"><span /><h3>{title}</h3><p>{copy}</p></article>
}

function ProcessStep({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="process-step"><strong>{number}</strong><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={19} /></article>
}

function CallToAction({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <section className="site-cta">
      <div>
        <p className="site-kicker light"><span /> Explore the platform</p>
        <h2>See the AQUAScan operator experience.</h2>
        <p>Open the mission-control interface to explore vessel control, mission planning, sensor visualization, and data review.</p>
      </div>
      <button type="button" onClick={() => navigate('control')}><Radio size={19} /> Open live control <ArrowRight size={18} /></button>
    </section>
  )
}

export default Website
