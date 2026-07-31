import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { CompaniesTable } from "@/components/companies-table"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

export default async function CompaniesPage() {
  await requireUser()

  const companies = await sql`
    SELECT c.*,
           COUNT(cu.id)::int AS contact_count
    FROM public.companies c
    LEFT JOIN public.contact_us cu
           ON cu.company_id = c.id
          AND cu.email != ALL(${EXCLUDED_EMAILS})
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {companies.length} compan{companies.length !== 1 ? "ies" : "y"}
        </p>
      </div>
      <CompaniesTable companies={companies} />
    </div>
  )
}
