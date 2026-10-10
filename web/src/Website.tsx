import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { NavigateContext } from './site/navigation'
import { pageFromPath, pagePaths, pageTitles, type MarketingPage, type SitePage } from './site/routes'
import { Footer, GlobalNav } from './site/SiteChrome'
import { AquaScanFootnotes, AquaScanPage } from './site/pages/AquaScanPage'
import { ApplicationsPage } from './site/pages/ApplicationsPage'
import { CompanyPage } from './site/pages/CompanyPage'
import { ContactPage } from './site/pages/ContactPage'
import { HomePage } from './site/pages/HomePage'
import { PrivacyPage, TermsPage } from './site/pages/LegalPages'
import { NewsPage } from './site/pages/NewsPage'
import { useSmoothScroll } from './site/useSmoothScroll'
import '@fontsource-variable/inter'
import './site/site.css'

// Live control (Firebase, Three.js) and Maris (charts) are heavier; load them only when visited.
const ControlRoute = lazy(() => import('./site/ControlRoute'))
const MarisLab = lazy(() => import('./MarisLab'))

function Website() {
  const [page, setPage] = useState<SitePage>(() => pageFromPath(window.location.pathname))
  // Bumped on every client-side navigation so the scroll effect runs even when the page stays the same.
  const [navId, setNavId] = useState(0)

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.title = pageTitles[page]
  }, [page])

  useLayoutEffect(() => {
    const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null
    if (target) target.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page, navId])

  const navigate = useCallback((nextPage: SitePage, hash?: string) => {
    const nextUrl = pagePaths[nextPage] + (hash ? `#${hash}` : '')
    if (window.location.pathname + window.location.hash !== nextUrl) window.history.pushState({}, '', nextUrl)
    setPage(nextPage)
    setNavId((id) => id + 1)
  }, [])

  return (
    <NavigateContext.Provider value={navigate}>
      {page === 'control' ? (
        <Suspense fallback={<div className="route-loading route-loading-light" />}>
          <ControlRoute />
        </Suspense>
      ) : (
        <MarketingSite page={page} />
      )}
    </NavigateContext.Provider>
  )
}

function MarketingSite({ page }: { page: MarketingPage }) {
  useSmoothScroll()

  return (
    <div className="site">
      <GlobalNav page={page} />
      {page === 'home' && <HomePage />}
      {page === 'products' && <AquaScanPage />}
      {page === 'applications' && <ApplicationsPage />}
      {page === 'company' && <CompanyPage />}
      {page === 'news' && <NewsPage />}
      {page === 'contact' && <ContactPage />}
      {page === 'privacy' && <PrivacyPage />}
      {page === 'terms' && <TermsPage />}
      {page === 'maris' && (
        <Suspense fallback={<div className="route-loading route-loading-alt" />}>
          <MarisLab />
        </Suspense>
      )}
      <Footer footnotes={page === 'products' ? <AquaScanFootnotes /> : undefined} />
    </div>
  )
}

export default Website
