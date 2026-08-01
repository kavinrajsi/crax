import { sql } from "@/lib/db"
import { DataPageClient } from "@/components/data-page-client"
import { CsvImportDialog } from "@/components/csv-import-dialog"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

/* Kept identical to the expression in src/app/api/contacts/export/route.js: the
   export dialog builds its source filter options from the column derived here,
   so an option that does not round-trip to the same value there would match
   nothing. String.raw matters — a plain template literal turns `\.` into `.`. */
const SOURCE_DOMAIN_RE = String.raw`^https?://(www\.)?`

export default async function DataPage() {
  await requireUser()

  const [contacts, companies, contactTags] = await Promise.all([
    /* has_touch drives the "needs attention" filter: has anyone left a note or
       logged an activity at all. last_touch is display only, for the age shown
       in the Last touch column. Written inline rather than interpolated from a
       constant — every query in this codebase is a tagged template with no
       string interpolation, and that is worth keeping. */
    sql`
      SELECT cu.*,
             split_part(regexp_replace(cu.source_url, ${SOURCE_DOMAIN_RE}, ''), '/', 1) AS source_domain,
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
      FROM public.visible_contacts cu
      ORDER BY cu.created_at DESC
    `,
    sql`SELECT id, name FROM public.companies ORDER BY name ASC`,
    /* Tag membership, not just the distinct tag list: the export dialog shows a
       live match count, and it cannot count a tag filter without knowing which
       contacts carry which tag. One row per (contact, tag) — a handful today. */
    sql`SELECT contact_id, tag FROM public.contact_tags ORDER BY tag ASC`,
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
        <DataPageClient contacts={contacts} companies={companies} contactTags={contactTags} />
      </div>
    </div>
  )
}
