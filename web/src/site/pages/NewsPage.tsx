import { media, type Media } from '../media'
import { Img, Reveal, SiteLink } from '../primitives'
import type { SitePage } from '../routes'

type Story = { title: string; summary: string; image: Media; to: SitePage; hash?: string }

const featured: Story = {
  title: 'AquaScan remains in active development.',
  summary:
    'Work continues on the vessel, depth-aware sensing, mission control, and the data experience that make up the AquaScan platform. The demonstrations on this site show where the product is headed while development and validation continue.',
  image: media.probeShore,
  to: 'products',
}

const stories: Story[] = [
  {
    title: 'From the pool to the pond.',
    summary: 'After seal and subsystem tests, AquaScan sampled multiple points at varying depths in real pond conditions.',
    image: media.boatFountain,
    to: 'products',
    hash: 'testing',
  },
  {
    title: 'Maris brings the analysis to your browser.',
    summary: 'Explore sample pond data, or your own AquaScan files, by place and by depth. No account needed.',
    image: media.depthProfiles,
    to: 'maris',
  },
  {
    title: 'Inside the probe.',
    summary: 'A look at the sealed, sinking sensor body that turns AquaScan into a measurement tool.',
    image: media.probeExploded,
    to: 'products',
    hash: 'probe',
  },
]

export function NewsPage() {
  return (
    <main id="top" className="newsroom">
      <section className="newsroom-head">
        <div className="container">
          <h1 className="newsroom-title">Newsroom</h1>
        </div>
      </section>
      <section className="section section-tight">
        <div className="container">
          <Reveal>
            <SiteLink to={featured.to} className="story story-featured">
              <div className="story-media"><Img {...featured.image} eager /></div>
              <div className="story-copy">
                <h2>{featured.title}</h2>
                <p>{featured.summary}</p>
              </div>
            </SiteLink>
          </Reveal>
          <div className="story-grid">
            {stories.map((story, index) => (
              <Reveal key={story.title} delay={index * 80}>
                <SiteLink to={story.to} hash={story.hash} className="story">
                  <div className="story-media"><Img {...story.image} /></div>
                  <div className="story-copy">
                    <h3>{story.title}</h3>
                    <p>{story.summary}</p>
                  </div>
                </SiteLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
