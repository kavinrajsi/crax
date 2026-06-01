import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { DealsKanban } from "@/components/deals-kanban"

export const dynamic = "force-dynamic"

export default async function DealsPage() {
  const [dealsRaw, contacts, notesRaw] = await Promise.all([
    sql`
      SELECT d.*, c.name AS contact_name
      FROM public.deals d
      LEFT JOIN public.contact_us c ON c.id = d.contact_id
      ORDER BY d.created_at ASC
    `,
    sql`
      SELECT id, name, email FROM public.contact_us
      WHERE email != ALL(${EXCLUDED_EMAILS})
      ORDER BY name ASC
    `,
    sql`SELECT * FROM public.deal_notes ORDER BY created_at ASC`,
  ])

  // Group notes by deal_id for the sheet
  const dealNotesMap = {}
  for (const note of notesRaw) {
    if (!dealNotesMap[note.deal_id]) dealNotesMap[note.deal_id] = []
    dealNotesMap[note.deal_id].push(note)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your sales pipeline — {dealsRaw.length} deal{dealsRaw.length !== 1 ? "s" : ""}
        </p>
      </div>

      <DealsKanban
        deals={dealsRaw}
        contacts={contacts}
        dealNotesMap={dealNotesMap}
      />
    </div>
  )
}
