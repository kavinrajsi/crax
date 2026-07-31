import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { DataPageClient } from "@/components/data-page-client"
import { CsvImportDialog } from "@/components/csv-import-dialog"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

export default async function DataPage() {
  await requireUser()

  const [contacts, companies] = await Promise.all([
    /* has_touch drives the "needs attention" filter: has anyone left a note or
       logged an activity at all. last_touch is display only, for the age shown
       in the Last touch column. Written inline rather than interpolated from a
       constant — every query in this codebase is a tagged template with no
       string interpolation, and that is worth keeping. */
    sql`
      SELECT cu.*,
             GREATEST(
               cu.created_at,
               COALESCE((SELECT MAX(created_at) FROM public.contact_notes      n WHERE n.contact_id = cu.id), cu.created_at),
               COALESCE((SELECT MAX(created_at) FROM public.contact_activities a WHERE a.contact_id = cu.id), cu.created_at)
             ) AS last_touch,
             (
               EXISTS(SELECT 1 FROM public.contact_notes      n WHERE n.contact_id = cu.id)
               OR
               EXISTS(SELECT 1 FROM public.contact_activities a WHERE a.contact_id = cu.id)
             ) AS has_touch
      FROM public.contact_us cu
      WHERE cu.email != ALL(${EXCLUDED_EMAILS})
      ORDER BY cu.created_at DESC
    `,
    sql`SELECT id, name FROM public.companies ORDER BY name ASC`,
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live contact submissions from Neon DB — {contacts.length} records
          </p>
        </div>
        <CsvImportDialog />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <DataPageClient contacts={contacts} companies={companies} />
      </div>
    </div>
  )
}
