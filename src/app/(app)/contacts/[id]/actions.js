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

export async function addActivity(contactId, { type, title, body, due_at }) {
  const user = await requireUserOrThrow()
  await sql`
    INSERT INTO public.contact_activities (contact_id, author_email, type, title, body, due_at)
    VALUES (${contactId}, ${user.email}, ${type}, ${title}, ${body ?? null}, ${due_at ?? null})
  `
  await recordAudit(user, "contact.activity_add", {
    table: "contact_activities", id: contactId, after: { type, title },
  })
  revalidatePath(`/contacts/${contactId}`)
}

export async function completeActivity(activityId, contactId) {
  const user = await requireUserOrThrow()
  await sql`
    UPDATE public.contact_activities SET completed_at = NOW() WHERE id = ${activityId}
  `
  await recordAudit(user, "contact.activity_complete", {
    table: "contact_activities", id: activityId, after: { contact_id: contactId },
  })
  revalidatePath(`/contacts/${contactId}`)
}

export async function deleteActivity(activityId, contactId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_activities", activityId)
  await sql`DELETE FROM public.contact_activities WHERE id = ${activityId}`
  await recordAudit(user, "contact.activity_delete", {
    table: "contact_activities", id: activityId, before,
  })
  revalidatePath(`/contacts/${contactId}`)
}

export async function detectAndLinkCompany(contactId) {
  const user = await requireUserOrThrow()
  const [contact] = await sql`
    SELECT email, company FROM public.contact_us WHERE id = ${contactId}
  `
  if (!contact) return null

  const result = await autoLinkCompany(contactId, contact.email, contact.company, { overwrite: true })
  if (result) {
    await recordAudit(user, "contact.company_detect", {
      table: "contact_us", id: contactId, after: result,
    })
    revalidatePath(`/contacts/${contactId}`)
    revalidatePath("/companies")
  }
  return result
}
