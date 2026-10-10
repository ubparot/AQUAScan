import { SurveyLink } from '../Badges'
import { MoreLink, Reveal } from '../primitives'

export function ContactPage() {
  return (
    <main id="top">
      <section className="page-hero">
        <Reveal className="container">
          <h1 className="page-hero-title">Contact AquaLabs</h1>
          <p className="page-hero-lede">
            We welcome conversations about AquaScan, field pilots, research and education, and technical partnerships.
          </p>
        </Reveal>
      </section>

      <section className="section section-tight">
        <div className="container">
          <Reveal className="contact-survey">
            <div>
              <h2>Take our survey</h2>
              <p>
                The quickest way to reach us right now. Tell us how you collect or use water-quality data, what gets in the way,
                and whether you would like to stay in touch as a mentor or tester. It takes about five minutes.
              </p>
            </div>
            <SurveyLink />
          </Reveal>

          <div className="contact-grid">
            <Reveal className="contact-block">
              <h2>Pilots and partnerships</h2>
              <p>
                Interested in trying AquaScan on your water, or building something together? Leave your email in the survey
                and we will follow up.
              </p>
            </Reveal>
            <Reveal className="contact-block" delay={80}>
              <h2>Research and education</h2>
              <p>AquaScan connects field sampling, robotics, mapping, and analysis in one platform for classrooms and labs.</p>
              <MoreLink to="applications">See applications</MoreLink>
            </Reveal>
            <Reveal className="contact-block" delay={160}>
              <h2>Try it today</h2>
              <p>Explore the product, analyze water-quality data in Maris, or sign in to the operator dashboard.</p>
              <MoreLink to="maris">Open Maris</MoreLink>
            </Reveal>
          </div>

          <Reveal className="contact-address">
            <h2>Location</h2>
            <address>
              AquaLabs LLC<br />
              Chesapeake, Virginia<br />
              United States
            </address>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
