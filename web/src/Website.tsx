import {
  Activity,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Building2,
  ChevronRight,
  CircleHelp,
  Database,
  Handshake,
  Layers3,
  LockKeyhole,
  LogIn,
  Mail,
  Map,
  MapPin,
  Menu,
  Radio,
  Route,
  Satellite,
  ShipWheel,
  ShieldCheck,
  Waves,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import App from './App'
import MarisLab from './MarisLab'
import {
  createEmailAccount,
  getControlAuthSetupIssues,
  sendEmailPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutOfGoogle,
  subscribeToControlAuth,
  type ControlAuthUser,
} from './domain/firebaseAuth'
import './Website.css'

type SitePage = 'home' | 'products' | 'applications' | 'company' | 'news' | 'contact' | 'privacy' | 'terms' | 'control' | 'maris'

const pagePaths: Record<SitePage, string> = {
  home: '/',
  products: '/products',
  applications: '/applications',
  company: '/company',
  news: '/news',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  control: '/control',
  maris: '/maris',
}

const pageTitles: Record<SitePage, string> = {
  home: 'AquaLabs LLC | Aquatic Technology from Chesapeake, Virginia',
  products: 'Products | AquaLabs LLC',
  applications: 'Applications | AquaLabs LLC',
  company: 'Company | AquaLabs LLC',
  news: 'News | AquaLabs LLC',
  contact: 'Contact | AquaLabs LLC',
  privacy: 'Privacy Policy | AquaLabs LLC',
  terms: 'Terms of Use | AquaLabs LLC',
  control: 'AquaScan Live Control | AquaLabs LLC',
  maris: 'Maris by AquaScan | AquaLabs LLC',
}

function pageFromPath(pathname: string): SitePage {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/control') return 'control'
  if (path === '/maris') return 'maris'
  if (path === '/products' || path === '/technology') return 'products'
  if (path === '/applications' || path === '/impact') return 'applications'
  if (path === '/company' || path === '/about') return 'company'
  if (path === '/news') return 'news'
  if (path === '/contact') return 'contact'
  if (path === '/privacy') return 'privacy'
  if (path === '/terms') return 'terms'
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
        <ControlAuthGate onBack={() => navigate('home')}>
          {(logout, user) => (
            <>
              <div className="control-actions" aria-label="Control dashboard actions">
                <span className="control-user">
                  {user.photoURL && <img src={user.photoURL} alt="" />}
                  <span>{user.email}</span>
                </span>
                <button className="control-back" type="button" onClick={() => navigate('home')}>
                  <Waves size={18} />
                  AquaLabs site
                </button>
                <button className="control-logout" type="button" onClick={logout}>
                  <LockKeyhole size={17} />
                  Log out
                </button>
              </div>
              <App />
            </>
          )}
        </ControlAuthGate>
      </div>
    )
  }

  if (page === 'maris') {
    return (
      <div className="maris-route">
        <MarisLab />
      </div>
    )
  }

  return <MarketingSite page={page} navigate={navigate} />
}

function ControlAuthGate({ children, onBack }: { children: (logout: () => void, user: ControlAuthUser) => ReactNode; onBack: () => void }) {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState<ControlAuthUser | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailMode, setEmailMode] = useState<'signin' | 'create'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const setupIssues = getControlAuthSetupIssues()
  const configured = setupIssues.length === 0

  useEffect(() => subscribeToControlAuth((nextState) => {
    setAuthReady(nextState.ready)
    setUser(nextState.user)
    if (nextState.error) setError(nextState.error)
  }), [])

  const login = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setUser(await signInWithGoogle())
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Google sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const loginWithEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const nextUser = emailMode === 'create'
        ? await createEmailAccount(email, password, displayName)
        : await signInWithEmail(email, password)
      setUser(nextUser)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Email sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      await sendEmailPasswordReset(email)
      setMessage('Password reset email sent.')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send password reset email.')
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await signOutOfGoogle()
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  if (user) return <>{children(logout, user)}</>

  return (
    <main className="auth-screen">
      <button className="auth-back" type="button" onClick={onBack}>
        <Waves size={18} />
        Back to AquaLabs site
      </button>
      <section className="auth-card" aria-labelledby="control-auth-title">
        <div className="auth-icon"><ShieldCheck size={34} /></div>
        <h1 id="control-auth-title">Sign in to live control.</h1>
        <p>
          Use an approved Google account before opening the dashboard. Public project pages remain available without
          signing in.
        </p>
        {configured ? (
          <div className="auth-methods">
            <button type="button" disabled={!authReady || busy} onClick={login}>
              <LogIn size={18} />
              {busy ? 'Opening Google...' : authReady ? 'Continue with Google' : 'Checking Google session...'}
            </button>
            <div className="auth-divider"><span /> or use email/password <span /></div>
            <form onSubmit={loginWithEmail} className="auth-form">
              <div className="auth-mode-toggle" aria-label="Email authentication mode">
                <button type="button" data-active={emailMode === 'signin'} onClick={() => setEmailMode('signin')}>Sign in</button>
                <button type="button" data-active={emailMode === 'create'} onClick={() => setEmailMode('create')}>Create account</button>
              </div>
              {emailMode === 'create' && (
                <label>
                  Name
                  <input type="text" value={displayName} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} />
                </label>
              )}
              <label>
                Email
                <span className="auth-input-row">
                  <Mail size={18} />
                  <input type="email" value={email} autoComplete="email" required onChange={(event) => setEmail(event.target.value)} />
                </span>
              </label>
              <label>
                Password
                <span className="auth-input-row">
                  <LockKeyhole size={18} />
                  <input type="password" value={password} autoComplete={emailMode === 'create' ? 'new-password' : 'current-password'} required minLength={6} onChange={(event) => setPassword(event.target.value)} />
                </span>
              </label>
              <button type="submit" disabled={!authReady || busy}>
                <LockKeyhole size={18} />
                {emailMode === 'create' ? 'Create account' : 'Sign in with email'}
              </button>
              <button className="auth-link-button" type="button" disabled={busy} onClick={resetPassword}>Send password reset email</button>
            </form>
            {message && <p className="auth-success" role="status">{message}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
          </div>
        ) : (
          <div className="auth-setup-warning" role="status">
            <strong>Firebase auth is not configured yet.</strong>
            <ul>
              {setupIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}
        <p className="auth-note">
          Access is limited by <code>VITE_AQUASCAN_ALLOWED_EMAILS</code>. The boat relay should also verify the same
          Google/Firebase token before accepting motor commands.
        </p>
      </section>
    </main>
  )
}

function MarketingSite({ page, navigate }: { page: Exclude<SitePage, 'control' | 'maris'>; navigate: (page: SitePage) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const go = (nextPage: SitePage) => {
    setMenuOpen(false)
    navigate(nextPage)
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="site-brand company-brand" type="button" onClick={() => go('home')} aria-label="AquaLabs LLC home">
          <span className="company-mark"><Waves size={24} /></span>
          <span><strong>AquaLabs</strong><small>LLC</small></span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          <SiteNavButton label="Home" active={page === 'home'} onClick={() => go('home')} />
          <SiteNavButton label="Products" active={page === 'products'} onClick={() => go('products')} />
          <SiteNavButton label="Applications" active={page === 'applications'} onClick={() => go('applications')} />
          <SiteNavButton label="Company" active={page === 'company'} onClick={() => go('company')} />
          <SiteNavButton label="News" active={page === 'news'} onClick={() => go('news')} />
        </nav>

        <button className="site-control-button" type="button" onClick={() => go('contact')}>
          <Mail size={17} />
          Contact us
        </button>

        <button className="mobile-menu-button" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>

        {menuOpen && (
          <nav className="mobile-site-nav" aria-label="Mobile navigation">
            <SiteNavButton label="Home" active={page === 'home'} onClick={() => go('home')} />
            <SiteNavButton label="Products" active={page === 'products'} onClick={() => go('products')} />
            <SiteNavButton label="Applications" active={page === 'applications'} onClick={() => go('applications')} />
            <SiteNavButton label="Company" active={page === 'company'} onClick={() => go('company')} />
            <SiteNavButton label="News" active={page === 'news'} onClick={() => go('news')} />
            <button className="site-control-button" type="button" onClick={() => go('control')}>
              <Radio size={17} />
              AquaScan control
            </button>
            <button className="site-demo-button" type="button" onClick={() => go('maris')}>
              <BarChart3 size={17} />
              Maris demo
            </button>
            <button className="site-control-button" type="button" onClick={() => go('contact')}>
              <Mail size={17} />
              Contact us
            </button>
          </nav>
        )}
      </header>

      {page === 'home' && <HomePage navigate={go} />}
      {page === 'products' && <ProductsPage navigate={go} />}
      {page === 'applications' && <ApplicationsPage navigate={go} />}
      {page === 'company' && <CompanyPage navigate={go} />}
      {page === 'news' && <NewsPage navigate={go} />}
      {page === 'contact' && <ContactPage navigate={go} />}
      {page === 'privacy' && <PrivacyPage />}
      {page === 'terms' && <TermsPage />}

      <footer className="site-footer">
        <div className="footer-company">
          <div className="company-brand"><span className="company-mark"><Waves size={22} /></span><span><strong>AquaLabs</strong><small>LLC</small></span></div>
          <p>Aquatic technology built in Chesapeake, Virginia.</p>
        </div>
        <div className="footer-links" aria-label="Footer navigation">
          <button type="button" onClick={() => go('products')}>Products</button>
          <button type="button" onClick={() => go('applications')}>Applications</button>
          <button type="button" onClick={() => go('company')}>Company</button>
          <button type="button" onClick={() => go('news')}>News</button>
          <button type="button" onClick={() => go('contact')}>Contact</button>
          <button type="button" onClick={() => go('privacy')}>Privacy</button>
          <button type="button" onClick={() => go('terms')}>Terms</button>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} AquaLabs LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}

function HomePage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <h1>Technology for a clearer view <em>of the water.</em></h1>
          <p className="hero-lede">
            AquaLabs develops practical tools that connect aquatic fieldwork, sensing, and data. Our first product,
            AquaScan, is a mobile platform for understanding water conditions across location and depth.
          </p>
          <div className="hero-actions">
            <button className="site-primary-button" type="button" onClick={() => navigate('products')}>
              Explore AquaScan <ArrowRight size={18} />
            </button>
            <button className="site-secondary-button" type="button" onClick={() => navigate('company')}>
              <Building2 size={18} /> About AquaLabs
            </button>
          </div>
          <div className="hero-proof">
            <span><strong>AquaScan</strong> in development</span>
            <span><strong>Virginia</strong> based</span>
            <span><strong>Field-first</strong> engineering</span>
          </div>
        </div>

        <div className="hero-video-panel">
          <video
            className="hero-video"
            src="/media/aquascan-hero.mp4"
            poster="/media/aquascan-hero-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            aria-label="AquaScan vessel field video"
          />
        </div>
      </section>

      <section className="site-section intro-section">
        <div className="section-heading-block">
          <h2>From difficult fieldwork to useful insight</h2>
          <p>We design connected aquatic systems around the full journey from collection to understanding.</p>
        </div>
        <div className="workflow-grid">
          <FeatureCard number="01" icon={<Waves />} title="Aquatic systems" copy="Purpose-built tools for work on ponds, lakes, reservoirs, and other calm-water environments." />
          <FeatureCard number="02" icon={<Activity />} title="Environmental sensing" copy="Measurements connected to place, time, and depth so field data retains its context." />
          <FeatureCard number="03" icon={<BarChart3 />} title="Usable software" copy="Operator interfaces and visualizations that help turn complex missions into clear decisions." />
        </div>
      </section>

      <section className="site-section system-band">
        <div className="system-band-copy">
          <h2>Meet AquaScan.</h2>
          <p>
            A semi-autonomous surface vessel that connects navigation, depth-aware water-quality sampling, live
            operations, and scientific visualization in one platform.
          </p>
          <button type="button" onClick={() => navigate('products')}>See the product <ArrowRight size={17} /></button>
        </div>
        <div className="metric-stack">
          <MetricCard icon={<Satellite />} label="Navigate" value="GPS guided" detail="Repeatable sampling locations" />
          <MetricCard icon={<Layers3 />} label="Measure" value="Multi-depth" detail="Conditions through the water column" />
          <MetricCard icon={<Database />} label="Understand" value="Connected" detail="Maps, charts, replays, and exports" />
        </div>
      </section>

      <section className="site-section use-section">
        <div className="section-heading-block">
          <h2>Built for teams working around water</h2>
        </div>
        <div className="use-grid">
          <UseCard title="Researchers" copy="Collect structured field measurements with location, depth, and mission context." />
          <UseCard title="Educators" copy="Connect environmental science, robotics, mapping, and data analysis in the field." />
          <UseCard title="Water managers" copy="Build repeatable monitoring workflows for managed aquatic environments." />
          <UseCard title="Partners" copy="Explore pilots, integrations, and new applications for aquatic technology." />
        </div>
      </section>

      <CallToAction navigate={navigate} />
    </main>
  )
}

function ProductsPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero title="AquaScan is where our product story begins." copy="AquaLabs' current product connects a semi-autonomous surface vessel, deployable sensing, live operations, and environmental data analysis." />
      <section className="site-section product-overview">
        <div className="product-lockup"><span className="status-badge">In development</span><img src="/aquascan-logo.png" alt="AquaScan" /><p>Mobile water-quality monitoring across location and depth.</p></div>
        <div className="product-actions"><button className="site-secondary-button" type="button" onClick={() => navigate('maris')}><BarChart3 size={18} /> Open Maris demo</button><button className="site-secondary-button" type="button" onClick={() => navigate('control')}><ShipWheel size={18} /> Operator control</button></div>
      </section>
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

function ApplicationsPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero title="More context for work on and around the water." copy="AquaLabs is developing technology for teams that need to observe aquatic environments more clearly, repeatedly, and efficiently." />
      <section className="site-section impact-layout">
        <div className="impact-panel">
          <MapPin size={27} />
          <h2>Know where every reading came from.</h2>
          <p>GPS-linked measurements support repeatable fieldwork, clearer comparisons, and map-based interpretation.</p>
        </div>
        <div className="impact-panel impact-panel-dark">
          <Layers3 size={27} />
          <h2>Reveal conditions below the surface.</h2>
          <p>Depth-aware sampling helps identify vertical changes that surface-only measurements may miss.</p>
        </div>
        <div className="impact-panel impact-panel-accent">
          <BarChart3 size={27} />
          <h2>Build a record that becomes more valuable.</h2>
          <p>Repeated missions create comparable datasets for studying trends and environmental change.</p>
        </div>
      </section>
      <section className="site-section use-section">
        <div className="section-heading-block">
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

function CompanyPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero title="Building practical technology for aquatic environments." copy="Based in Chesapeake, Virginia, AquaLabs brings together field engineering, sensing, robotics, and software to make water data easier to collect and understand." />
      <section className="site-section about-grid">
        <div className="about-story">
          <h2>Help people understand water with better tools.</h2>
          <p>
            Aquatic fieldwork can be time-consuming, difficult to repeat, and disconnected from the software used to
            interpret results. AquaLabs exists to close those gaps with systems designed around real field workflows.
          </p>
          <p>
            AquaScan is our first product and the foundation of a broader company vision: practical, connected aquatic
            technology that helps researchers, educators, water managers, and partners work with greater context.
          </p>
        </div>
        <div className="principles-list">
          <MetricCard icon={<MapPin />} label="Principle 01" value="Context" detail="Every reading should connect to place and depth." />
          <MetricCard icon={<Route />} label="Principle 02" value="Repeatability" detail="Monitoring should support meaningful comparison." />
          <MetricCard icon={<Activity />} label="Principle 03" value="Visibility" detail="Operators should understand the system in real time." />
          <MetricCard icon={<Database />} label="Principle 04" value="Usability" detail="Collected data should be ready for further work." />
        </div>
      </section>
      <section className="site-section team-section">
        <div className="section-heading-block">
          <h2>The people building AquaLabs</h2>
          <p>A multidisciplinary founding team spanning electronics, software, CAD, vessel and probe design, research, and organizational outreach.</p>
        </div>
        <div className="team-grid">
          <TeamMember number="01" name="Aven Mitchell" role="Lead Electronics & Software" />
          <TeamMember number="02" name="Aiden Russi" role="Co-Lead CAD and Probe Design" />
          <TeamMember number="03" name="Skylar Cauntay" role="Co-Lead CAD and Vessel Design" />
          <TeamMember number="04" name="Oliver Hathaway" role="Lead R&D" />
          <TeamMember number="05" name="Hayden Wells" role="Lead Organizational Outreach" />
        </div>
      </section>
      <section className="site-section future-band">
        <BatteryCharging size={32} />
        <div>
          <h2>Local roots. Broad aquatic challenges.</h2>
          <p>We are building from a region shaped by rivers, bays, wetlands, and the people who depend on them.</p>
        </div>
      </section>
      <CallToAction navigate={navigate} />
    </main>
  )
}

function NewsPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero title="Updates from AquaLabs." copy="Company news, AquaScan development notes, field progress, and future announcements from Chesapeake, Virginia." />
      <section className="site-section news-layout">
        <article className="news-feature">
          <div className="news-meta"><span>Development update</span><span>Current</span></div>
          <h2>AquaScan remains in active development.</h2>
          <p>
            AquaLabs is continuing work on the vessel, depth-aware sensing, mission control, and environmental data
            experience that make up the AquaScan platform. The current website demonstrations share the direction of
            the product while development and validation continue.
          </p>
          <button type="button" onClick={() => navigate('products')}>Explore the product <ArrowRight size={17} /></button>
        </article>
        <aside className="news-sidebar">
          <h2>More updates as the work progresses.</h2>
          <p>Future posts can cover field tests, product milestones, partnerships, demonstrations, and availability.</p>
          <button type="button" onClick={() => navigate('contact')}>Talk with AquaLabs <ArrowRight size={17} /></button>
        </aside>
      </section>
    </main>
  )
}

function ContactPage({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <main>
      <PageHero title="Start a conversation with AquaLabs." copy="We welcome conversations about AquaScan, pilot opportunities, research and education, technical partnerships, and the future of aquatic monitoring." />
      <section className="site-section contact-grid">
        <article className="contact-card"><MapPin size={28} /><h2>Chesapeake, Virginia</h2><p>AquaLabs LLC is based in the Hampton Roads region of Virginia.</p></article>
        <article className="contact-card contact-card-dark"><Handshake size={28} /><h2>Products, pilots, and partnerships</h2><p>Contact details will be added here once the company's preferred public email and phone information are confirmed.</p></article>
        <article className="contact-card"><CircleHelp size={28} /><h2>Explore AquaScan now</h2><p>Learn about the product, open the public Maris demonstration, or sign in to the operator experience.</p><button type="button" onClick={() => navigate('products')}>View AquaScan <ArrowRight size={17} /></button></article>
      </section>
    </main>
  )
}

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="This policy explains how AquaLabs LLC handles information when you visit this website or use the restricted AquaScan operator experience.">
      <LegalSection title="Information we receive">
        <p>Public pages do not currently include a contact form. If you sign in to a restricted operator area, the authentication provider may supply account information such as your name, email address, profile image, provider, and account identifier.</p>
        <p>The site and its service providers may also process basic technical information needed to deliver and secure the service, such as browser, device, network, and diagnostic information.</p>
      </LegalSection>
      <LegalSection title="How information is used"><p>Information is used to authenticate approved operators, provide requested functionality, maintain security, troubleshoot problems, and improve the AquaScan development experience.</p></LegalSection>
      <LegalSection title="Storage and service providers"><p>Authentication is provided through Firebase and may use Google sign-in or email/password authentication. Some application preferences and development data may be stored on your device. Those providers may process information under their own terms and privacy policies.</p></LegalSection>
      <LegalSection title="Sharing"><p>AquaLabs does not sell personal information. Information may be shared with service providers that operate the site, when required by law, or when necessary to protect the company, users, or the service.</p></LegalSection>
      <LegalSection title="Data choices"><p>You may choose not to use restricted sign-in features. Requests concerning account information, correction, or deletion can be directed to AquaLabs once the public privacy contact address is published.</p></LegalSection>
      <LegalSection title="Changes"><p>This policy may change as AquaScan develops and additional site features are introduced. Updates will be posted on this page with a revised effective date.</p></LegalSection>
    </LegalPage>
  )
}

function TermsPage() {
  return (
    <LegalPage title="Terms of Use" intro="These terms govern access to the AquaLabs LLC website, public demonstrations, and restricted AquaScan development tools.">
      <LegalSection title="Development status"><p>AquaScan is in development. Demonstrations, specifications, interfaces, features, performance, availability, and other materials may change and should not be treated as a commercial offer or guarantee.</p></LegalSection>
      <LegalSection title="Permitted use"><p>You may use public pages for informational purposes. Restricted operator features may be used only by authorized users and only for lawful, approved testing or operation.</p></LegalSection>
      <LegalSection title="Accounts and security"><p>You are responsible for safeguarding your sign-in credentials and for activity performed through your account. Do not attempt to bypass access controls, interfere with the service, or send unauthorized commands to connected equipment.</p></LegalSection>
      <LegalSection title="Safety"><p>Do not rely on this website, a demonstration, or development software as the sole basis for navigation, environmental, operational, regulatory, or safety decisions. Physical equipment must be operated by qualified people using appropriate procedures and supervision.</p></LegalSection>
      <LegalSection title="Intellectual property"><p>The site, AquaLabs and AquaScan names, software, designs, graphics, text, and other materials are owned by AquaLabs LLC or their respective licensors unless otherwise stated. No rights are granted except the limited permission to use the site under these terms.</p></LegalSection>
      <LegalSection title="No warranties and limitation"><p>The site and development materials are provided on an “as available” basis without warranties to the fullest extent permitted by law. AquaLabs LLC is not responsible for losses arising from reliance on development demonstrations or unauthorized use.</p></LegalSection>
      <LegalSection title="Changes"><p>AquaLabs may update the site, suspend access, or revise these terms as the product and company evolve. Continued use after an update means the revised terms apply.</p></LegalSection>
    </LegalPage>
  )
}

function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main>
      <PageHero title={title} copy={intro} />
      <article className="site-section legal-page">
        <p className="legal-effective">Effective September 1, 2026</p>
        {children}
      </article>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>
}

function SiteNavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" data-active={active} onClick={onClick}>{label}</button>
}

function PageHero({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="page-hero">
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

function TeamMember({ number, name, role }: { number: string; name: string; role: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('')
  return (
    <article className="team-card">
      <div className="team-card-top"><span aria-hidden="true">{initials}</span><small>{number}</small></div>
      <p>Founder</p>
      <h3>{name}</h3>
      <strong>{role}</strong>
    </article>
  )
}

function ProcessStep({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="process-step"><strong>{number}</strong><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={19} /></article>
}

function CallToAction({ navigate }: { navigate: (page: SitePage) => void }) {
  return (
    <section className="site-cta">
      <div>
        <h2>Let’s talk about what’s happening in the water.</h2>
        <p>Start a conversation about AquaScan, research, education, field pilots, or technical partnerships.</p>
      </div>
      <button type="button" onClick={() => navigate('contact')}><Mail size={19} /> Contact AquaLabs <ArrowRight size={18} /></button>
    </section>
  )
}

export default Website
