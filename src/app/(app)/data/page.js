import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { DataPageClient } from "@/components/data-page-client"
import { CsvImportDialog } from "@/components/csv-import-dialog"

export const dynamic = "force-dynamic"

export default async function DataPage() {
  const contacts = await sql`SELECT * FROM public.contact_us WHERE email != ALL(${EXCLUDED_EMAILS}) ORDER BY created_at DESC`

  return (
    <div className="flex flex-col gap-4">
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
        <DataPageClient contacts={contacts} />
      </div>
    </div>
  )
}
