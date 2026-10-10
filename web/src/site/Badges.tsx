import type { ReactNode } from 'react'
import { AWARD, SURVEY_URL } from './brand'

/** One branch of a laurel: leaves in pairs along a curved stem. Drawn for the left side, mirrored for the right. */
const STEM = { p0: [21, 47], p1: [-1, 30], p2: [14, 3] } as const

function stemPoint(t: number) {
  const { p0, p1, p2 } = STEM
  const u = 1 - t
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
}

function stemAngle(t: number) {
  const { p0, p1, p2 } = STEM
  const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
  const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

const LEAVES = [0.1, 0.24, 0.38, 0.52, 0.66, 0.8].flatMap((t) => {
  const [x, y] = stemPoint(t)
  const angle = stemAngle(t)
  const size = 1 - t * 0.35
  return [
    { x, y, rotate: angle - 42, length: 11 * size },  // outer leaf
    { x, y, rotate: angle + 40, length: 8.5 * size }, // inner leaf
  ]
})

function Laurel({ side }: { side: 'left' | 'right' }) {
  const [tx, ty] = stemPoint(1)
  return (
    <svg className="laurel" viewBox="-4 0 30 50" width="26" height="44" aria-hidden="true" style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}>
      <path d={`M${STEM.p0.join(' ')} Q${STEM.p1.join(' ')} ${STEM.p2.join(' ')}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {LEAVES.map((leaf, index) => (
        <ellipse
          key={index}
          cx={leaf.x + leaf.length / 2}
          cy={leaf.y}
          rx={leaf.length / 2}
          ry={leaf.length / 4.4}
          transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y})`}
          fill="currentColor"
        />
      ))}
      <ellipse cx={tx} cy={ty - 3} rx={1.9} ry={4} transform={`rotate(${stemAngle(1) + 90} ${tx} ${ty})`} fill="currentColor" />
    </svg>
  )
}

/** "5th in the Nation" with laurels, like an award line on a book cover. */
export function AwardBadge({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <p className={['award', `award-${tone}`, className].filter(Boolean).join(' ')}>
      <Laurel side="left" />
      <span className="award-text">
        <strong>{AWARD.headline}</strong>
        <small>{AWARD.competition} {AWARD.year} · {AWARD.event}</small>
      </span>
      <Laurel side="right" />
    </p>
  )
}

/** Screenshots sit in a simple browser window so they never read as photos. */
export function WindowFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={['window-frame', className].filter(Boolean).join(' ')}>
      <div className="window-bar" aria-hidden="true"><i /><i /><i /></div>
      {children}
    </div>
  )
}

export function ExternalArrow() {
  return (
    <svg className="external-arrow" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SurveyLink({ className = 'button button-primary', children = 'Take the survey' }: { className?: string; children?: ReactNode }) {
  return (
    <a className={className} href={SURVEY_URL} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalArrow />
      <span className="visually-hidden"> (opens Google Forms in a new tab)</span>
    </a>
  )
}

/** The research survey, presented as a way to help shape AquaScan. */
export function SurveyBand() {
  return (
    <section className="survey-band" aria-labelledby="survey-title">
      <div className="container survey-inner">
        <div>
          <h2 id="survey-title">Help shape AquaScan.</h2>
          <p>
            Do you test water, teach environmental science, or work with field data? Our five-minute survey tells us how
            monitoring is done today and what would make it better.
          </p>
        </div>
        <SurveyLink className="button button-white" />
      </div>
    </section>
  )
}
