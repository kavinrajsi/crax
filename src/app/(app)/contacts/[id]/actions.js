"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit, snapshot } from "@/lib/audit"
import { autoLinkCompany } from "@/lib/company-enrichment"

export async function addNote(contactId, body) {
  const user = await requireUserOrThrow()
  const trimmed = body?.trim()
  if (!trimmed) return

  await sql`
    INSERT INTO public.contact_notes (contact_id, author_email, body)
    VALUES (${contactId}, ${user.email}, ${trimmed})
  `
  await recordAudit(user, "contact.note", { table: "contact_notes", id: contactId })
  revalidatePath(`/contacts/${contactId}`)
}

export async function updateContact(contactId, fields) {
  const user = await requireUserOrThrow()
  const { name, email, phone, company } = fields
  const before = await snapshot("contact_us", contactId)
  await sql`
    UPDATE public.contact_us
    SET
      name    = ${name    ?? null},
      email   = ${email   ?? null},
      phone   = ${phone   ?? null},
      company = ${company ?? null}
    WHERE id = ${contactId}
  `
  await recordAudit(user, "contact.update", {
    table: "contact_us", id: contactId, before, after: await snapshot("contact_us", contactId),
  })
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/data")
}

export async function addTag(contactId, tag) {
  const user = await requireUserOrThrow()
  const trimmed = tag?.trim().toLowerCase()
  if (!trimmed) return
  await sql`
    INSERT INTO public.contact_tags (contact_id, tag)
    VALUES (${contactId}, ${trimmed})
    ON CONFLICT (contact_id, tag) DO NOTHING
  `
  await recordAudit(user, "contact.tag_add", {
    table: "contact_tags", id: contactId, after: { tag: trimmed },
  })
  revalidatePath(`/contacts/${contactId}`)
}

export async function removeTag(tagId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_tags", tagId)
  await sql`DELETE FROM public.contact_tags WHERE id = ${tagId}`
  await recordAudit(user, "contact.tag_remove", { table: "contact_tags", id: tagId, before })
}

export async function detectAndLinkCompany(contactId) {
  const user = await requireUserOrThrow()
  const [contact] = await sql`
    SELECT email, company FROM public.contact_us WHERE id = ${contactId}
  `
  if (!contact) return null

  /* allowNameFallback is set here and nowhere else. A person clicked Detect on
     one contact they are looking at, so the typed company name is worth acting
     on; at intake the same fallback would auto-create a company from every
     distinct string a form ever received. The audit entry records matchedBy,
     so a link made from typed text is distinguishable afterwards from one made
     from the email domain. */
  const result = await autoLinkCompany(contactId, contact.email, contact.company, {
    overwrite: true,
    allowNameFallback: true,
  })
  if (result) {
    await recordAudit(user, "contact.company_detect", {
      table: "contact_us", id: contactId, after: result,
    })
    revalidatePath(`/contacts/${contactId}`)
    revalidatePath("/companies")
  }
  return result
}
