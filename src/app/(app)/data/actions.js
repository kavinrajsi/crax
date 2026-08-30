"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit } from "@/lib/audit"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { DEFAULT_CONTACT_STATUS, isContactStatus } from "@/lib/contact-statuses"

/**
 * Manual lead entry from the Data page. Mirrors the import route's rules:
 * a row needs a name or an email, and an email that already exists is a
 * duplicate, not a second lead. Returns { error } instead of throwing for
 * those two cases so the dialog can show the message inline.
 */
export async function createContact({ name, email, phone, company, sourceUrl, message, needs, status }) {
  const user = await requireUserOrThrow()

  const cleanName = String(name ?? "").trim()
  const cleanEmail = String(email ?? "").trim().toLowerCase()
  if (!cleanName && !cleanEmail) {
    return { error: "A lead needs at least a name or an email." }
  }

  if (cleanEmail) {
    const [existing] = await sql`
      SELECT id FROM public.contact_us WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `
    if (existing) return { error: `A lead with this email already exists (#${existing.id}).` }
  }

  const cleanStatus = isContactStatus(status) ? status : DEFAULT_CONTACT_STATUS
  const cleanNeeds = Array.isArray(needs)
    ? needs.map((n) => String(n).trim()).filter(Boolean)
    : []

  const [contact] = await sql`
    INSERT INTO public.contact_us (name, email, phone, company, source_url, message, needs, status)
    VALUES (${cleanName}, ${cleanEmail}, ${String(phone ?? "").trim()},
            ${String(company ?? "").trim()}, ${String(sourceUrl ?? "").trim()},
            ${String(message ?? "").trim()}, ${cleanNeeds}, ${cleanStatus})
    RETURNING *
  `

  await autoLinkCompany(contact.id, contact.email, contact.company)
  await recordAudit(user, "contact.create", {
    table: "contact_us", id: contact.id, after: contact,
  })

  revalidatePath("/data")
  revalidatePath("/pipeline")
  return { contact }
}
