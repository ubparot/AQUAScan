import { AwardBadge, SurveyBand } from '../Badges'
import { AquaLabsLogo } from '../AquaLabsLogo'
import { AquaScanLogo } from '../AquaScanLogo'
import { media } from '../media'
import { Img, MoreLink, Reveal } from '../primitives'

const principles = [
  { title: 'Context', copy: 'A reading is only useful if you know where and how deep it was taken.' },
  { title: 'Repeatability', copy: 'Monitoring should make it easy to go back and compare.' },
  { title: 'Visibility', copy: 'Operators should understand what the system is doing in real time.' },
  { title: 'Usability', copy: 'Collected data should be ready for the next step, not stuck in a device.' },
]

const team = [
  { name: 'Aven Mitchell', role: 'Lead Electronics & Software' },
  { name: 'Aiden Russi', role: 'Co-Lead CAD and Probe Design' },
  { name: 'Skylar Cauntay', role: 'Co-Lead CAD and Vessel Design' },
  { name: 'Oliver Hathaway', role: 'Lead R&D' },
  { name: 'Hayden Wells', role: 'Lead Organizational Outreach' },
]

export function CompanyPage() {
  return (
    <main id="top">
      <section className="page-hero">
        <Reveal className="container">
          <h1 className="page-hero-title">Better tools for<br />understanding water.</h1>
          <p className="page-hero-lede">
            AquaLabs is a team of five engineers in the Governor’s STEM Academy at Grassfield High School in Chesapeake,
            Virginia. We build practical tools for studying the water around us.
          </p>
        </Reveal>
      </section>

      <Reveal className="wide-media wide-media-tall"><Img {...media.pondUnderway} /></Reveal>

      <section className="section" aria-labelledby="names-title">
        <div className="container">
          <Reveal as="h2" className="section-title"><span id="names-title">Who’s who.</span></Reveal>
          <div className="names">
            <Reveal className="name-card">
              <div className="name-logo"><AquaLabsLogo height={26} /></div>
              <h3>The team</h3>
              <p>AquaLabs designs, builds, and tests everything on this site.</p>
            </Reveal>
            <Reveal className="name-card" delay={80}>
              <div className="name-logo"><AquaScanLogo className="name-logo-svg" /></div>
              <h3>The product</h3>
              <p>AquaScan is our water-quality research vessel: the boat, the sensor probe, and the software that runs them.</p>
              <MoreLink to="products">Explore AquaScan</MoreLink>
            </Reveal>
            <Reveal className="name-card" delay={160}>
              <div className="name-logo name-logo-text">Maris</div>
              <h3>The software</h3>
              <p>Maris is AquaScan’s analysis software. It turns a mission’s readings into maps, profiles, and findings.</p>
              <MoreLink to="maris">Open Maris</MoreLink>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt recognition">
        <Reveal className="container narrow center">
          <AwardBadge />
          <p className="recognition-copy">
            AquaScan finished in the top five nationally in Engineering Design at the 2026 Technology Student Association
            National Conference.
          </p>
          <MoreLink to="news">Read the story</MoreLink>
        </Reveal>
      </section>

      <section className="section">
        <div className="container narrow prose-large">
          <Reveal as="p">
            Fieldwork on the water is slow, hard to repeat, and usually disconnected from the software used to make sense of it.
            We started AquaLabs to close that gap with systems designed around how field teams actually work.
          </Reveal>
          <Reveal as="p">
            AquaScan is our first product. It is also the start of a broader idea: practical, connected aquatic technology that
            gives researchers, educators, and water managers more context for every measurement.
          </Reveal>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <Reveal as="h2" className="section-title">What we believe.</Reveal>
          <div className="principles">
            {principles.map((principle, index) => (
              <Reveal key={principle.title} className="principle" delay={(index % 2) * 80}>
                <h3>{principle.title}</h3>
                <p>{principle.copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="team">
        <div className="container">
          <Reveal className="section-head">
            <h2 className="section-title">The founding team.</h2>
            <p className="section-lede">Electronics, software, CAD, vessel and probe design, research, and outreach.</p>
          </Reveal>
          <ul className="team">
            {team.map((member, index) => (
              <Reveal as="li" key={member.name} className="team-member" delay={(index % 3) * 60}>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </Reveal>
            ))}
          </ul>
          <Reveal className="team-contact"><MoreLink to="contact">Get in touch with the team</MoreLink></Reveal>
        </div>
      </section>

      <SurveyBand />
    </main>
  )
}
