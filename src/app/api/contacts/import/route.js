import { sql } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit } from "@/lib/audit"

/**
 * CSV import.
 *
 * This route had never successfully imported a row. It used
 * `ON CONFLICT (email) DO NOTHING`, but contact_us.email carries only a
 * NON-unique index, so Postgres rejected the statement at parse-analysis with
 * 42P10 — "no unique or exclusion constraint matching the ON CONFLICT
 * specification" — before executing anything. Every row hit the catch,
 * incremented `failed`, and the route still answered HTTP 200.
 *
 * Deduplication is now an explicit SELECT, matching what the submit route
 * already does. That is a check-then-act race: two concurrent imports of the
 * same address can both miss and both insert. Accepted deliberately — a UNIQUE
 * index on email is the real fix, and it cannot be added until the 10 existing
 * duplicate-email groups are resolved, which is a decision about live data.
 */

/** Trim to a string, never null — name/email/phone are NOT NULL with no default. */
function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export async function POST(request) {
  /* Kept rather than discarded: an enrichment failure below is attributed to
     whoever ran the import, since unlike the public webhook this route always
     has a real user. */
  const user = await getUserOrNull()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { rows } = body ?? {}
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ inserted: 0, skipped: 0, failed: 0, errors: [] })
  }

  /* Three buckets, not two. `skipped` used to absorb invalid rows, duplicate
     emails AND hard database errors alike, so a total outage returned HTTP 200
     with { inserted: 0, skipped: N } and left no trace. */
  let inserted = 0
  let skipped = 0
  let failed = 0
  const errors = []

  for (const row of rows) {
    /* "" not null. These three columns are NOT NULL with no default, so the
       previous `|| null` would have thrown on any row missing one — the same
       defect the submit route documents as fixed, never applied here. It was
       masked because the ON CONFLICT failure fired first. */
    const name = str(row.name)
    const email = str(row.email).toLowerCase()
    const phone = str(row.phone)
    const company = str(row.company)
    const sourceUrl = str(row.source_url) || "csv-import"
    const needs = row.needs
      ? String(row.needs).split(",").map((n) => n.trim()).filter(Boolean)
      : []

    if (!name && !email && !phone) {
      skipped++
      continue
    }

    let contactId = null
    try {
      if (email) {
        const [existing] = await sql`
          SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1
        `
        if (existing) {
          skipped++
          continue
        }
      }

      const [contact] = await sql`
        INSERT INTO public.contact_us
          (name, email, phone, company, source_url, needs, status)
        VALUES
          (${name}, ${email}, ${phone}, ${company}, ${sourceUrl}, ${needs}, 'New')
        RETURNING id
      `
      contactId = contact.id
      inserted++
    } catch (error) {
      failed++
      if (errors.length < 5) errors.push(`${email || name}: ${error.message}`)
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
      /* Audited for the same reason as the webhook's: console.error alone left
         two months of enrichment failure invisible. recordAudit swallows its
         own errors, so this cannot break an import that has already inserted
         the row. */
      await recordAudit(user, "contact.enrichment_failed", {
        table: "contact_us",
        id: contactId,
        after: { source: "import", email, company, error: String(error?.message ?? error) },
      })
    }
  }

  /* A run where every row failed is not a success. The three-bucket split was
     added so an outage could not hide, but the status code still said 200 —
     which is exactly how a route that never worked went unnoticed. */
  const status = failed > 0 && inserted === 0 ? 500 : 200
  return Response.json({ inserted, skipped, failed, errors }, { status })
}
