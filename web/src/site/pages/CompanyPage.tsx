import { media } from '../media'
import { ButtonLink, Img, Reveal } from '../primitives'

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
        </Reveal>
      </section>

      <Reveal className="wide-media wide-media-tall"><Img {...media.boatFountain} /></Reveal>

      <section className="section">
        <div className="container narrow prose-large">
          <Reveal as="p">
            Fieldwork on the water is slow, hard to repeat, and usually disconnected from the software used to make sense of it.
            AquaLabs exists to close that gap with systems designed around how field teams actually work.
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
        </div>
      </section>

      <section className="section section-dark">
        <Reveal className="container narrow center">
          <h2 className="section-title section-title-sm">Local roots. Broad challenges.</h2>
          <p className="section-lede">
            We are based in Chesapeake, Virginia, a region shaped by rivers, bays, wetlands, and the people who depend on them.
          </p>
          <div className="tile-actions">
            <ButtonLink to="contact">Contact us</ButtonLink>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
