"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { evaluateRules } from "@/lib/automation"

export async function addNote(contactId, body) {
  const trimmed = body?.trim()
  if (!trimmed) return

  const { data: session } = await auth.getSession()
  const authorEmail = session?.user?.email ?? "anonymous"

  await sql`
    INSERT INTO public.contact_notes (contact_id, author_email, body)
    VALUES (${contactId}, ${authorEmail}, ${trimmed})
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function updateContact(contactId, fields) {
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
  await sql`DELETE FROM public.contact_tags WHERE id = ${tagId}`
}

export async function addActivity(contactId, { type, title, body, due_at }) {
  const { data: session } = await auth.getSession()
  const authorEmail = session?.user?.email ?? "anonymous"
  await sql`
    INSERT INTO public.contact_activities (contact_id, author_email, type, title, body, due_at)
    VALUES (${contactId}, ${authorEmail}, ${type}, ${title}, ${body ?? null}, ${due_at ?? null})
  `
  revalidatePath(`/contacts/${contactId}`)
}

export async function completeActivity(activityId, contactId) {
  await sql`
    UPDATE public.contact_activities SET completed_at = NOW() WHERE id = ${activityId}
  `
  await evaluateRules("activity_completed", { contactId, activityId })
  revalidatePath(`/contacts/${contactId}`)
}

export async function deleteActivity(activityId, contactId) {
  await sql`DELETE FROM public.contact_activities WHERE id = ${activityId}`
  revalidatePath(`/contacts/${contactId}`)
}
