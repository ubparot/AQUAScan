import { useEffect, useState, type ReactNode } from 'react'
import { AquaLabsLogo } from './AquaLabsLogo'
import { SurveyLink } from './Badges'
import { SiteLink } from './primitives'
import type { MarketingPage, SitePage } from './routes'

const globalItems: Array<{ page: SitePage; label: string }> = [
  { page: 'products', label: 'AquaScan' },
  { page: 'applications', label: 'Applications' },
  { page: 'company', label: 'About' },
  { page: 'news', label: 'Newsroom' },
]

export function GlobalNav({ page }: { page: MarketingPage }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.documentElement.classList.add('menu-open')
    window.addEventListener('keydown', close)
    return () => {
      document.documentElement.classList.remove('menu-open')
      window.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <header className="globalnav" data-open={open}>
      <nav className="globalnav-inner" aria-label="Main navigation">
        <SiteLink to="home" className="globalnav-brand" aria-label="AquaLabs home" onClick={() => setOpen(false)}>
          <AquaLabsLogo height={22} />
        </SiteLink>
        <ul className="globalnav-list">
          {globalItems.map((item) => (
            <li key={item.page}>
              <SiteLink to={item.page} aria-current={page === item.page ? 'page' : undefined}>{item.label}</SiteLink>
            </li>
          ))}
        </ul>
        <SurveyLink className="globalnav-cta">Take the survey</SurveyLink>
        <button
          className="globalnav-toggle"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="globalnav-menu"
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
        </button>
      </nav>
      <div id="globalnav-menu" className="globalnav-menu" hidden={!open}>
        <ul>
          {globalItems.map((item, index) => (
            <li key={item.page} style={{ animationDelay: `${40 + index * 30}ms` }}>
              <SiteLink to={item.page} aria-current={page === item.page ? 'page' : undefined} onClick={() => setOpen(false)}>{item.label}</SiteLink>
            </li>
          ))}
        </ul>
        <div className="globalnav-menu-actions">
          <SurveyLink className="button button-primary">Take the survey</SurveyLink>
          <SiteLink to="control" className="globalnav-menu-signin" onClick={() => setOpen(false)}>Sign in to live control</SiteLink>
        </div>
      </div>
    </header>
  )
}

export function Footer({ footnotes }: { footnotes?: ReactNode }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {footnotes && <div className="footer-notes">{footnotes}</div>}
        <div className="footer-brand">
          <AquaLabsLogo height={20} />
          <p>AquaLabs is the student engineering team behind AquaScan, based in Chesapeake, Virginia.</p>
        </div>
        <nav className="footer-directory" aria-label="Site directory">
          <section>
            <h3>AquaScan</h3>
            <ul>
              <li><SiteLink to="products">Overview</SiteLink></li>
              <li><SiteLink to="products" hash="specs">Tech specs</SiteLink></li>
              <li><SiteLink to="applications">Applications</SiteLink></li>
            </ul>
          </section>
          <section>
            <h3>Software</h3>
            <ul>
              <li><SiteLink to="maris">Maris</SiteLink></li>
              <li><SiteLink to="control">Sign in to live control</SiteLink></li>
            </ul>
          </section>
          <section>
            <h3>AquaLabs</h3>
            <ul>
              <li><SiteLink to="company">About</SiteLink></li>
              <li><SiteLink to="company" hash="team">Team</SiteLink></li>
              <li><SiteLink to="news">Newsroom</SiteLink></li>
              <li><SiteLink to="contact">Contact</SiteLink></li>
            </ul>
          </section>
          <section>
            <h3>Get involved</h3>
            <ul>
              <li><SurveyLink className="">Take the survey</SurveyLink></li>
            </ul>
          </section>
        </nav>
        <div className="footer-legal">
          <p>Copyright © {new Date().getFullYear()} AquaLabs LLC. All rights reserved.</p>
          <ul>
            <li><SiteLink to="privacy">Privacy Policy</SiteLink></li>
            <li><SiteLink to="terms">Terms of Use</SiteLink></li>
          </ul>
          <p className="footer-locale">Chesapeake, Virginia</p>
        </div>
      </div>
    </footer>
  )
}
