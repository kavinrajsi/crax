"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit } from "@/lib/audit"

/* These two discard a stored provider token, so they are destructive and worth
   auditing — every other destructive action in the app records one, and the
   flat authorization model means any signed-in user can disconnect any
   integration, so the trail is the only record of who did it. */

export async function disconnectFacebookPage(pageId) {
  const user = await requireUserOrThrow()
  await sql`DELETE FROM public.facebook_page_connections WHERE page_id = ${pageId}`
  await recordAudit(user, "facebook.disconnect", {
    table: "facebook_page_connections", id: pageId,
  })
  revalidatePath("/profile")
}

export async function disconnectLinkedInAccount(accountUrn) {
  const user = await requireUserOrThrow()
  await sql`DELETE FROM public.linkedin_connections WHERE account_urn = ${accountUrn}`
  await recordAudit(user, "linkedin.disconnect", {
    table: "linkedin_connections", id: accountUrn,
  })
  revalidatePath("/profile")
}
