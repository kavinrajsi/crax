"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit, snapshot } from "@/lib/audit"

/* ─── contact status ─────────────────────────────────────────────────── */

// authorEmail is derived from the session, never accepted from the caller —
// a server action is a public POST endpoint, so a caller-supplied author made
// the audit trail whatever the caller said it was.
export async function updateContactStatus(contactId, newStatus) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_us", contactId)

  /* `IS DISTINCT FROM` makes this a no-op when nothing actually changed
     (also handling a NULL status, which `<>` would not). */
  await sql`
    UPDATE public.contact_us
    SET status = ${newStatus}
    WHERE id = ${contactId} AND status IS DISTINCT FROM ${newStatus}
  `

  await recordAudit(user, "contact.status_change", {
    table: "contact_us", id: contactId,
    before: before && { status: before.status },
    after: { status: newStatus },
  })
  revalidatePath("/pipeline")
  revalidatePath("/data")
  revalidatePath(`/contacts/${contactId}`)
}
