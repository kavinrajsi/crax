import { sql } from "@/lib/db"
import { PipelineBoard } from "@/components/pipeline-board"

import { requireUser } from "@/lib/dal"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"
import { normalizePipelineSource } from "@/lib/contact-sources"

export const dynamic = "force-dynamic"

/* Column order is the vocabulary's own order, from src/lib/contact-statuses.js.
   This list used to be maintained here by hand alongside four other copies —
   a status added to the CHECK but forgotten here would simply have no column,
   so its contacts would vanish from the board with nothing reporting it. */
const STATUS_COLUMNS = CONTACT_STATUSES

export default async function PipelinePage({ searchParams }) {
  await requireUser()

  const { source } = await searchParams
  const initialSource = normalizePipelineSource(source)

  const contacts = await sql`
    SELECT id, name, email, phone, company, source_url, status, needs, created_at
    FROM public.contact_us
    ORDER BY created_at DESC
  `

  return (
    <PipelineBoard
      contacts={contacts}
      statusColumns={STATUS_COLUMNS}
      initialSource={initialSource}
    />
  )
}
