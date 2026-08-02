"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"

export async function disconnectFacebookPage(pageId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.facebook_page_connections WHERE page_id = ${pageId}`
  revalidatePath("/profile")
}
