import type { ReactNode } from 'react'

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="This policy explains how AquaLabs LLC handles information when you visit this website or use the restricted AquaScan operator experience.">
      <LegalSection title="Information we receive">
        <p>Public pages do not currently include a contact form. If you sign in to a restricted operator area, the authentication provider may supply account information such as your name, email address, profile image, provider, and account identifier.</p>
        <p>The site and its service providers may also process basic technical information needed to deliver and secure the service, such as browser, device, network, and diagnostic information.</p>
      </LegalSection>
      <LegalSection title="How information is used">
        <p>Information is used to authenticate approved operators, provide requested functionality, maintain security, troubleshoot problems, and improve the AquaScan development experience.</p>
      </LegalSection>
      <LegalSection title="Storage and service providers">
        <p>Authentication is provided through Firebase and may use Google sign-in or email/password authentication. Some application preferences and development data may be stored on your device. Those providers may process information under their own terms and privacy policies.</p>
      </LegalSection>
      <LegalSection title="Sharing">
        <p>AquaLabs does not sell personal information. Information may be shared with service providers that operate the site, when required by law, or when necessary to protect the company, users, or the service.</p>
      </LegalSection>
      <LegalSection title="Data choices">
        <p>You may choose not to use restricted sign-in features. Requests concerning account information, correction, or deletion can be directed to AquaLabs once the public privacy contact address is published.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>This policy may change as AquaScan develops and additional site features are introduced. Updates will be posted on this page with a revised effective date.</p>
      </LegalSection>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use" intro="These terms govern access to the AquaLabs LLC website, public demonstrations, and restricted AquaScan development tools.">
      <LegalSection title="Development status">
        <p>AquaScan is in development. Demonstrations, specifications, interfaces, features, performance, availability, and other materials may change and should not be treated as a commercial offer or guarantee.</p>
      </LegalSection>
      <LegalSection title="Permitted use">
        <p>You may use public pages for informational purposes. Restricted operator features may be used only by authorized users and only for lawful, approved testing or operation.</p>
      </LegalSection>
      <LegalSection title="Accounts and security">
        <p>You are responsible for safeguarding your sign-in credentials and for activity performed through your account. Do not attempt to bypass access controls, interfere with the service, or send unauthorized commands to connected equipment.</p>
      </LegalSection>
      <LegalSection title="Safety">
        <p>Do not rely on this website, a demonstration, or development software as the sole basis for navigation, environmental, operational, regulatory, or safety decisions. Physical equipment must be operated by qualified people using appropriate procedures and supervision.</p>
      </LegalSection>
      <LegalSection title="Intellectual property">
        <p>The site, AquaLabs and AquaScan names, software, designs, graphics, text, and other materials are owned by AquaLabs LLC or their respective licensors unless otherwise stated. No rights are granted except the limited permission to use the site under these terms.</p>
      </LegalSection>
      <LegalSection title="No warranties and limitation">
        <p>The site and development materials are provided on an “as available” basis without warranties to the fullest extent permitted by law. AquaLabs LLC is not responsible for losses arising from reliance on development demonstrations or unauthorized use.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>AquaLabs may update the site, suspend access, or revise these terms as the product and company evolve. Continued use after an update means the revised terms apply.</p>
      </LegalSection>
    </LegalPage>
  )
}

function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main id="top" className="legal">
      <article className="container narrow">
        <header className="legal-head">
          <h1>{title}</h1>
          <p className="legal-effective">Effective September 1, 2026</p>
          <p className="legal-intro">{intro}</p>
        </header>
        {children}
      </article>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="legal-section"><h2>{title}</h2>{children}</section>
}
