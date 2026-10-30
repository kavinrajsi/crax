import { LegalDocument, Section } from "@/components/legal-document"
import { LEGAL } from "@/lib/legal"

export const metadata = { title: "Cookie Policy · Crax" }

export default function CookiesPage() {
  return (
    <LegalDocument title="Cookie Policy">
      <Section title="1. What cookies are">
        <p>Cookies and similar storage are small files or entries saved by your browser. {LEGAL.appName} uses them only where needed to run the service.</p>
      </Section>
      <Section title="2. Cookies we use">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><strong>Session cookie:</strong> keeps you signed in. Strictly necessary.</li>
          <li><strong>Preference storage:</strong> remembers display choices such as theme and collapsed sections. Strictly necessary for those features.</li>
        </ul>
      </Section>
      <Section title="3. Advertising and tracking">
        <p>{LEGAL.appName} does not set advertising or third-party tracking cookies.</p>
      </Section>
      <Section title="4. Managing cookies">
        <p>You can block or delete cookies in your browser settings. Blocking the session cookie will sign you out and stop the app from working.</p>
      </Section>
      <Section title="5. Contact">
        <p>Questions about cookies: {LEGAL.contactEmail}.</p>
      </Section>
    </LegalDocument>
  )
}
