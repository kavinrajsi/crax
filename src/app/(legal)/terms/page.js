import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Terms of Service · Crax" }

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service">
      <Section title="1. Agreement">
        <p>These terms govern your use of {LEGAL.appName}, provided by {LEGAL.companyName}. By creating an account or using the service you agree to them.</p>
      </Section>
      <Section title="2. Accounts">
        <p>You are responsible for keeping your login details confidential and for all activity under your account. Tell us promptly at {LEGAL.contactEmail} if you suspect unauthorised use.</p>
      </Section>
      <Section title="3. Use of the service">
        <p>You may use Crax to manage your own leads, contacts and sales pipeline. You must follow the Acceptable Use Policy and must have a lawful basis for the personal data you store in Crax.</p>
      </Section>
      <Section title="4. Your data">
        <p>You keep ownership of the data you add. You grant us the right to host and process it solely to provide the service. You can export your data at any time.</p>
      </Section>
      <Section title="5. Availability">
        <p>We work to keep the service available but do not guarantee uninterrupted access. We may suspend features for maintenance, security or legal reasons.</p>
      </Section>
      <Section title="6. Disclaimers and liability">
        <p>The service is provided as is, to the extent permitted by law. To the extent permitted by law, our liability is limited to the amount you paid for the service in the twelve months before the claim.</p>
      </Section>
      <Section title="7. Termination">
        <p>You may stop using Crax at any time. We may suspend or end access for breach of these terms.</p>
      </Section>
      <Section title="8. Governing law">
        <p>These terms are governed by the laws of {LEGAL.jurisdiction}.</p>
      </Section>
      <Section title="9. Changes">
        <p>We may update these terms. Continued use after an update means you accept the new terms.</p>
      </Section>
    </LegalDocument>
  )
}
