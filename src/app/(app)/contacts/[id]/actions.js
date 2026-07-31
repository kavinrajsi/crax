"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { autoLinkCompany } from "@/lib/company-enrichment"

export async function addNote(contactId, body) {
  const user = await requireUserOrThrow()
  const trimmed = body?.trim()
  if (!trimmed) return

  await sql`
    INSERT INTO public.contact_notes (contact_id, author_email, body)
    VALUES (${contactId}, ${user.email}, ${trimmed})
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function updateContact(contactId, fields) {
  await requireUserOrThrow()
  const { name, email, phone, company } = fields
  await sql`
    UPDATE public.contact_us
    SET
      name    = ${name    ?? null},
      email   = ${email   ?? null},
      phone   = ${phone   ?? null},
      company = ${company ?? null}
    WHERE id = ${contactId}
  `
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/data")
}

export async function addTag(contactId, tag) {
  await requireUserOrThrow()
  const trimmed = tag?.trim().toLowerCase()
  if (!trimmed) return
  await sql`
    INSERT INTO public.contact_tags (contact_id, tag)
    VALUES (${contactId}, ${trimmed})
    ON CONFLICT (contact_id, tag) DO NOTHING
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function removeTag(tagId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.contact_tags WHERE id = ${tagId}`
}

export async function addActivity(contactId, { type, title, body, due_at }) {
  const user = await requireUserOrThrow()
  await sql`
    INSERT INTO public.contact_activities (contact_id, author_email, type, title, body, due_at)
    VALUES (${contactId}, ${user.email}, ${type}, ${title}, ${body ?? null}, ${due_at ?? null})
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function completeActivity(activityId, contactId) {
  await requireUserOrThrow()
  await sql`
    UPDATE public.contact_activities SET completed_at = NOW() WHERE id = ${activityId}
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function deleteActivity(activityId, contactId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.contact_activities WHERE id = ${activityId}`
  revalidatePath(`/contacts/${contactId}`)
}

export async function detectAndLinkCompany(contactId) {
  await requireUserOrThrow()
  const [contact] = await sql`
    SELECT email, company FROM public.contact_us WHERE id = ${contactId}
  `
  if (!contact) return null

  const result = await autoLinkCompany(contactId, contact.email, contact.company, { overwrite: true })
  if (result) {
    revalidatePath(`/contacts/${contactId}`)
    revalidatePath("/companies")
  }
  return result
}
