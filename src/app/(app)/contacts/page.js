import { sql } from "@/lib/db"
import { ContactsTable } from "@/components/contacts-table"
import { PageShell, PageHeader } from "@/components/page"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

export default async function ContactsPage() {
  await requireUser()

  const contacts = await sql`
    SELECT cu.id, cu.name, cu.email, cu.phone, cu.company, cu.status, cu.created_at,
           co.name AS company_name
    FROM public.contact_us cu
    LEFT JOIN public.companies co ON co.id = cu.company_id
    ORDER BY cu.created_at DESC
  `

  return (
    <PageShell>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
      />
      <ContactsTable contacts={contacts} />
    </PageShell>
  )
}
