import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Acceptable Use Policy · Crax" }

export default function AcceptableUsePage() {
  return (
    <LegalDocument title="Acceptable Use Policy">
      <Section title="1. Purpose">
        <p>This policy sets out what you may not do when using {LEGAL.appName}. It applies to every user and every account.</p>
      </Section>
      <Section title="2. You must not">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Use the service for anything unlawful, or to store data you have no lawful basis to hold.</li>
          <li>Send spam, or use contact data to send unsolicited messages in breach of anti-spam law.</li>
          <li>Upload malware, or attempt to gain unauthorised access to the service, other accounts or other users&apos; data.</li>
          <li>Probe, scan or test the vulnerability of the service without written permission.</li>
          <li>Interfere with or disrupt the service, including by overloading it.</li>
          <li>Scrape or copy data from the service in bulk, or resell access to it.</li>
          <li>Share login credentials or let others use your account.</li>
        </ul>
      </Section>
      <Section title="3. Personal data">
        <p>You are responsible for collecting and using contact data in line with privacy law, including giving people the notices and honouring the rights they are owed.</p>
      </Section>
      <Section title="4. Enforcement">
        <p>We may remove content, suspend accounts or end access where we reasonably believe this policy has been breached. Report abuse to {LEGAL.contactEmail}.</p>
      </Section>
    </LegalDocument>
  )
}
