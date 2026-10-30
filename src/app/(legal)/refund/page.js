import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Refund Policy · Crax" }

export default function RefundPage() {
  return (
    <LegalDocument title="Refund Policy">
      <Section title="1. Scope">
        <p>This policy applies to any paid subscription to {LEGAL.appName}. Where a signed order form or plan says something different, that document takes precedence.</p>
      </Section>
      <Section title="2. Cancellation">
        <p>You can cancel at any time from your account. Cancellation stops future renewals. Access continues until the end of the period you have paid for.</p>
      </Section>
      <Section title="3. Refunds">
        <p>[Confirm refund window, for example 14 days from first payment.] Refunds are not given for partial periods or unused time after that window, except where the law requires it.</p>
      </Section>
      <Section title="4. How to request">
        <p>Email {LEGAL.contactEmail} with your account email and the payment you are asking about. We will confirm the outcome within [confirm timeframe].</p>
      </Section>
    </LegalDocument>
  )
}
