import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Data Retention Policy · Crax" }

export default function DataRetentionPage() {
  return (
    <LegalDocument title="Data Retention Policy">
      <Section title="1. Purpose">
        <p>This policy sets how long {LEGAL.appName} keeps each category of data. Periods marked as placeholders must be confirmed before launch.</p>
      </Section>
      <Section title="2. Retention periods">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><strong>Contact and lead records:</strong> kept while your account is active, until you delete them. [Confirm period]</li>
          <li><strong>Account data:</strong> kept while the account is active, then deleted within [confirm period] of closure.</li>
          <li><strong>Audit logs:</strong> kept for [confirm period] to support security and accountability.</li>
          <li><strong>Backups:</strong> deleted on a rolling basis within [confirm period] after the source data is deleted.</li>
          <li><strong>Support correspondence:</strong> kept for [confirm period].</li>
        </ul>
      </Section>
      <Section title="3. Deletion">
        <p>You can delete individual records in the app. When you close your account, we delete or anonymise your data within the periods above, unless the law requires us to keep it.</p>
      </Section>
      <Section title="4. Requests">
        <p>To request earlier deletion or an export, contact {LEGAL.contactEmail}.</p>
      </Section>
    </LegalDocument>
  )
}
