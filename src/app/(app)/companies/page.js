import { sql } from "@/lib/db"
import { CompaniesTable } from "@/components/companies-table"
import { PageShell, PageHeader } from "@/components/page"

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
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `

  return (
    <PageShell>
      <PageHeader
        title="Companies"
        description={`${companies.length} compan${companies.length !== 1 ? "ies" : "y"}`}
      />
      <CompaniesTable companies={companies} />
    </PageShell>
  )
}
