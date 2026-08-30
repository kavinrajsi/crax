import { sql } from "@/lib/db"
import { ContactsKanban } from "@/components/contacts-kanban"

import { requireUser } from "@/lib/dal"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"

export const dynamic = "force-dynamic"

/* Column order is the vocabulary's own order, from src/lib/contact-statuses.js.
   This list used to be maintained here by hand alongside four other copies —
   a status added to the CHECK but forgotten here would simply have no column,
   so its contacts would vanish from the board with nothing reporting it. */
const STATUS_COLUMNS = CONTACT_STATUSES

export default async function PipelinePage() {
  await requireUser()

  const contacts = await sql`
    SELECT id, name, email, phone, company, source_url, status, needs, created_at
    FROM public.contact_us
    ORDER BY created_at DESC
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track {contacts.length} lead{contacts.length === 1 ? "" : "s"} across the pipeline.
        </p>
      </div>

      <ContactsKanban contacts={contacts} statusColumns={STATUS_COLUMNS} />
    </div>
  )
}
