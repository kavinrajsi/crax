import { sql, getCompanyOptions } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { DealsBoard } from "@/components/deals-board"

export const dynamic = "force-dynamic"

export default async function DealsPage() {
  await requireUser()

  const [deals, contacts, companies] = await Promise.all([
    sql`
      SELECT d.*, c.name AS contact_name, co.name AS company_name
      FROM public.deals d
      LEFT JOIN public.contact_us c  ON c.id  = d.contact_id
      LEFT JOIN public.companies  co ON co.id = d.company_id
      ORDER BY d.position ASC, d.created_at DESC
    `,
    sql`SELECT id, name, email FROM public.contact_us
        ORDER BY created_at DESC`,
    getCompanyOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline across {deals.length} deal{deals.length === 1 ? "" : "s"}
        </p>
      </div>
      <DealsBoard deals={deals} contacts={contacts} companies={companies} />
    </div>
  )
}
