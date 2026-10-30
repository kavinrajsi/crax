import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Privacy Policy · Crax" }

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <Section title="1. Who we are">
        <p>{LEGAL.appName} is a customer relationship tool operated by {LEGAL.companyName}. This policy explains what personal data we process and why.</p>
      </Section>
      <Section title="2. Data we collect">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Account data: your name, email address and password (stored hashed by our authentication provider).</li>
          <li>Contact data you add or import: names, emails, phone numbers, companies, messages, needs and notes about your leads and customers.</li>
          <li>Form submissions from public intake forms that send leads to Crax.</li>
          <li>Activity data: audit logs of changes made in the app, including the user, time and IP address.</li>
          <li>Technical data: browser type and basic usage needed to keep the service secure and working.</li>
        </ul>
      </Section>
      <Section title="3. How we use data">
        <p>We use personal data to provide the service, sign you in, keep an audit trail, secure the application, respond to support requests and meet legal obligations. We do not sell personal data.</p>
      </Section>
      <Section title="4. Service providers">
        <p>We use hosting, database and authentication providers to run Crax. They process data on our instructions under contracts that require appropriate security. Their names and regions are available on request at {LEGAL.contactEmail}.</p>
      </Section>
      <Section title="5. Legal basis (where applicable)">
        <p>Where data protection law requires one, we rely on performance of a contract, our legitimate interest in running and securing the service, consent where you give it, and compliance with legal obligations.</p>
      </Section>
      <Section title="6. Retention">
        <p>We keep data for as long as needed for the purposes above. See the Data Retention Policy for details.</p>
      </Section>
      <Section title="7. Your rights">
        <p>Depending on where you live, you may ask to access, correct, export or delete your personal data, or object to or restrict some processing. Contact {LEGAL.contactEmail} and we will respond within the time required by law.</p>
      </Section>
      <Section title="8. Security">
        <p>We use encryption in transit, access controls and audit logging. No system is completely secure, so we cannot guarantee absolute security.</p>
      </Section>
      <Section title="9. Changes">
        <p>We may update this policy. The date at the top shows the latest version.</p>
      </Section>
    </LegalDocument>
  )
}
