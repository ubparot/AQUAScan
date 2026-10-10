import { media, type Media } from '../media'
import { Img, Reveal, SiteLink } from '../primitives'
import type { SitePage } from '../routes'

type Story = { title: string; summary: string; image: Media; to: SitePage; hash?: string }

const featured: Story = {
  title: 'AquaScan places fifth in the nation at TSA.',
  summary:
    'AquaLabs took AquaScan to the 2026 Technology Student Association National Conference and placed fifth in the country in Engineering Design, after a development cycle that added autonomous missions, depth-aware sensing, and Maris.',
  image: media.vesselPond,
  to: 'products',
}

const stories: Story[] = [
  {
    title: 'From the pool to the pond.',
    summary: 'After seal and subsystem tests, AquaScan sampled multiple points at varying depths in real pond conditions.',
    image: media.poolDeploy,
    to: 'products',
    hash: 'testing',
  },
  {
    title: 'Maris brings the analysis to your browser.',
    summary: 'Explore sample pond data, or your own AquaScan files, by place and by depth. No account needed.',
    image: media.probeShore,
    to: 'maris',
  },
  {
    title: 'Help shape what we build next.',
    summary: 'We are surveying people who test water, teach, or work with field data. It takes about five minutes.',
    image: media.underwaterProbe,
    to: 'contact',
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
