"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

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
