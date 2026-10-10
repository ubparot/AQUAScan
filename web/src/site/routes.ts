export type SitePage =
  | 'home'
  | 'products'
  | 'applications'
  | 'company'
  | 'news'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'control'
  | 'maris'

/** Pages rendered inside the site shell (nav and footer). Only live control has its own full-screen layout. */
export type MarketingPage = Exclude<SitePage, 'control'>

export const pagePaths: Record<SitePage, string> = {
  home: '/',
  products: '/aquascan',
  applications: '/applications',
  company: '/company',
  news: '/newsroom',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  control: '/control',
  maris: '/maris',
}

export const pageTitles: Record<SitePage, string> = {
  home: 'AquaLabs — Aquatic technology from Chesapeake, Virginia',
  products: 'AquaScan — AquaLabs',
  applications: 'Applications — AquaLabs',
  company: 'Company — AquaLabs',
  news: 'Newsroom — AquaLabs',
  contact: 'Contact — AquaLabs',
  privacy: 'Privacy Policy — AquaLabs',
  terms: 'Terms of Use — AquaLabs',
  control: 'AquaScan Live Control — AquaLabs',
  maris: 'Maris — AquaLabs',
}

const aliases: Record<string, SitePage> = {
  '/': 'home',
  '/aquascan': 'products',
  '/products': 'products',
  '/technology': 'products',
  '/applications': 'applications',
  '/impact': 'applications',
  '/company': 'company',
  '/about': 'company',
  '/newsroom': 'news',
  '/news': 'news',
  '/contact': 'contact',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/control': 'control',
  '/maris': 'maris',
}

export function pageFromPath(pathname: string): SitePage {
  const path = pathname.replace(/\/+$/, '') || '/'
  return aliases[path] ?? 'home'
}
