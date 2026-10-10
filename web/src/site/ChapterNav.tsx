import type { ReactNode } from 'react'
import { SiteLink } from './primitives'
import type { SitePage } from './routes'

type Chapter = { label: string; icon: ReactNode } & ({ hash: string } | { page: SitePage })

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const icons = {
  vessel: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <path d="M27 15V6" {...stroke} strokeWidth={1.8} />
      <path d="M14.5 26.5 18.5 15.5c5.6-3 11.4-3 17 0l4 11Z" fill="currentColor" />
      <rect x="9" y="26.5" width="36" height="3.5" rx="1.2" fill="currentColor" />
      <path d="M7 31h13v6.5a3.5 3.5 0 0 1-3.5 3.5h-6A3.5 3.5 0 0 1 7 37.5ZM34 31h13v6.5a3.5 3.5 0 0 1-3.5 3.5h-6a3.5 3.5 0 0 1-3.5-3.5Z" fill="currentColor" />
      <path d="M20 31.5 25 27M34 31.5 29 27" {...stroke} strokeWidth={1.6} />
      <path d="M4 46.5c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 4 2" {...stroke} strokeWidth={1.6} />
    </svg>
  ),
  probe: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <path d="M14 20.5 7 7h4.2L20.5 20.5ZM14 33.5 7 47h4.2l9.3-13.5Z" fill="currentColor" />
      <path d="M14.5 20.8 7.5 24v6l7 3.2Z" fill="currentColor" />
      <rect x="13.5" y="20" width="26.5" height="14" rx="2.2" fill="currentColor" />
      <rect x="25" y="15.5" width="5" height="5.5" rx="1" fill="currentColor" />
      <path d="M40.5 20.6h2.6c5.8 0 8.7 3 8.7 6.4s-2.9 6.4-8.7 6.4h-2.6Z" {...stroke} strokeWidth={2} />
    </svg>
  ),
  software: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <rect x="10" y="12" width="34" height="23.5" rx="2.6" {...stroke} />
      <path d="M5 39h44l-2.2 3.2a2 2 0 0 1-1.7.8H8.9a2 2 0 0 1-1.7-.8Z" fill="currentColor" />
      <path d="m15.5 30.5 7-7 6 4 9-9.5" {...stroke} strokeWidth={1.7} />
      <circle cx="15.5" cy="30.5" r="1.9" fill="currentColor" />
      <circle cx="22.5" cy="23.5" r="1.9" fill="currentColor" />
      <circle cx="28.5" cy="27.5" r="1.9" fill="currentColor" />
      <circle cx="37.5" cy="18" r="1.9" fill="currentColor" />
    </svg>
  ),
  specs: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <rect x="13" y="7.5" width="28" height="39" rx="4" {...stroke} />
      <path d="M19 17h16M19 23.5h16M19 30h16M19 36.5h9" {...stroke} strokeWidth={2} />
    </svg>
  ),
  maris: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <rect x="7" y="7" width="40" height="40" rx="10" fill="currentColor" />
      <path d="m15 34 7.5-8.5 6 5 10.5-12" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 39.5h24" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ),
  control: (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <path d="M27 21v16" {...stroke} strokeWidth={2.6} />
      <circle cx="27" cy="15.5" r="6.5" fill="currentColor" />
      <path d="M12 39.5c0-2.2 6.7-4 15-4s15 1.8 15 4v1.5c0 2.2-6.7 4-15 4s-15-1.8-15-4Z" fill="currentColor" />
    </svg>
  ),
}

const chapters: Chapter[] = [
  { label: 'Vessel', icon: icons.vessel, hash: 'vessel' },
  { label: 'Probe', icon: icons.probe, hash: 'probe' },
  { label: 'Software', icon: icons.software, hash: 'software' },
  { label: 'Tech Specs', icon: icons.specs, hash: 'specs' },
  { label: 'Maris', icon: icons.maris, page: 'maris' },
  { label: 'Live Control', icon: icons.control, page: 'control' },
]

/** Apple-style chapter navigation: an icon and a label for each part of the product. */
export function ChapterNav() {
  return (
    <nav className="chapternav" aria-label="AquaScan">
      <ul>
        {chapters.map((chapter) => {
          const body = (
            <>
              {chapter.icon}
              <span className="chapternav-label">{chapter.label}</span>
            </>
          )
          return (
            <li key={chapter.label}>
              {'hash' in chapter
                ? <a href={`#${chapter.hash}`}>{body}</a>
                : <SiteLink to={chapter.page}>{body}</SiteLink>}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
