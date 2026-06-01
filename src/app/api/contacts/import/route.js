import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { evaluateRules } from "@/lib/automation"
import { autoLinkCompany } from "@/lib/company-enrichment"

export async function POST(request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { rows } = await request.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ inserted: 0, skipped: 0 })
  }

  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    const name      = row.name?.trim() || null
    const email     = row.email?.trim() || null
    const phone     = row.phone?.trim() || null
    const company   = row.company?.trim() || null
    const source_url = row.source_url?.trim() || null
    const needs     = row.needs ? row.needs.split(",").map(n => n.trim()).filter(Boolean) : []

    if (!name && !email) { skipped++; continue }

    try {
      const result = await sql`
        INSERT INTO public.contact_us (name, email, phone, company, source_url, needs, status)
        VALUES (${name}, ${email}, ${phone}, ${company}, ${source_url}, ${needs}, 'New')
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `
      if (result.length > 0) {
        inserted++
        const contactId = result[0].id
        await autoLinkCompany(contactId, email, company)
        await evaluateRules("contact_created", { contactId })
      } else skipped++
    } catch {
      skipped++
    }
  }

  return Response.json({ inserted, skipped })
}
