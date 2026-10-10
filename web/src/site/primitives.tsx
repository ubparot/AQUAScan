import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from './navigation'
import { pagePaths, type SitePage } from './routes'

type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: SitePage
  hash?: string
}

/** A real anchor (so it can be opened in a new tab or copied) that routes client-side on a plain click. */
export function SiteLink({ to, hash, onClick, children, ...rest }: SiteLinkProps) {
  const navigate = useNavigate()
  const href = pagePaths[to] + (hash ? `#${hash}` : '')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to, hash)
  }

  return <a href={href} onClick={handleClick} {...rest}>{children}</a>
}

export function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 8 14" width="8" height="14" aria-hidden="true">
      <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** "Learn more >" style inline link. */
export function MoreLink({ to, hash, children }: { to: SitePage; hash?: string; children: ReactNode }) {
  return <SiteLink className="more-link" to={to} hash={hash}>{children}<Chevron /></SiteLink>
}

export function ButtonLink({ to, hash, variant = 'primary', children }: { to: SitePage; hash?: string; variant?: 'primary' | 'secondary'; children: ReactNode }) {
  return <SiteLink className={`button button-${variant}`} to={to} hash={hash}>{children}</SiteLink>
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({ as = 'div', className, delay = 0, children }: { as?: 'div' | 'p' | 'h2' | 'li' | 'figure'; className?: string; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // The tag only changes the element name; typing it as 'div' keeps the ref and props simple.
  const Tag = as as 'div'
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -12% 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <Tag ref={ref} className={['reveal', className].filter(Boolean).join(' ')} data-visible={visible} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  )
}

export function Img({ src, alt, className, eager = false, width, height, focus }: { src: string; alt: string; className?: string; eager?: boolean; width: number; height: number; focus?: string }) {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={focus ? { objectPosition: focus } : undefined}
    />
  )
}
