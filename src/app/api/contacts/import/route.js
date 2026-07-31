import { sql } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"
import { autoLinkCompany } from "@/lib/company-enrichment"

export async function POST(request) {
  if (!(await getUserOrNull())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { rows } = await request.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ inserted: 0, skipped: 0 })
  }

  /* Three buckets, not two. `skipped` used to absorb invalid rows, duplicate
     emails AND hard database errors alike, so a total outage returned HTTP 200
     with { inserted: 0, skipped: N } and left no trace. */
  let inserted = 0
  let skipped = 0
  let failed = 0
  const errors = []

  for (const row of rows) {
    const name      = row.name?.trim() || null
    const email     = row.email?.trim() || null
    const phone     = row.phone?.trim() || null
    const company   = row.company?.trim() || null
    const source_url = row.source_url?.trim() || null
    const needs     = row.needs ? row.needs.split(",").map(n => n.trim()).filter(Boolean) : []

    if (!name && !email) { skipped++; continue }

    let contactId = null
    try {
      const result = await sql`
        INSERT INTO public.contact_us (name, email, phone, company, source_url, needs, status)
        VALUES (${name}, ${email}, ${phone}, ${company}, ${source_url}, ${needs}, 'New')
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `
      if (result.length === 0) {
        skipped++
        continue
      }
      contactId = result[0].id
      inserted++
    } catch (error) {
      failed++
      if (errors.length < 5) errors.push(`${email ?? name}: ${error.message}`)
      console.error("[import] insert failed", { email, error })
      continue
    }

    /* Enrichment is deliberately outside the insert's try. It used to sit
       inside it, after `inserted++`, so a throw here counted the same row in
       both buckets and inserted + skipped could exceed rows.length. The row
       genuinely is inserted; only the company link failed. */
    try {
      await autoLinkCompany(contactId, email, company)
    } catch (error) {
      console.error("[import] company enrichment failed", { contactId, email, error })
    }
  }

  return Response.json({ inserted, skipped, failed, errors })
}
