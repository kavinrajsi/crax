"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function createTemplate(fields) {
  const { data: session } = await auth.getSession()
  const ownerEmail = session?.user?.email ?? "anonymous"
  const { name, subject, body } = fields
  const [template] = await sql`
    INSERT INTO public.email_templates (name, subject, body, owner_email)
    VALUES (${name}, ${subject}, ${body}, ${ownerEmail})
    RETURNING *
  `
  revalidatePath("/settings/email-templates")
  return template
}

export async function updateTemplate(id, fields) {
  const { name, subject, body } = fields
  await sql`
    UPDATE public.email_templates
    SET name = ${name}, subject = ${subject}, body = ${body}
    WHERE id = ${id}
  `
  revalidatePath("/settings/email-templates")
}

export async function deleteTemplate(id) {
  await sql`DELETE FROM public.email_templates WHERE id = ${id}`
  revalidatePath("/settings/email-templates")
}
