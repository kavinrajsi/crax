import { sql } from "@/lib/db"
import { ContactsTable } from "@/components/contacts-table"

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
        </p>
      </div>
      <ContactsTable contacts={contacts} />
    </div>
  )
}
