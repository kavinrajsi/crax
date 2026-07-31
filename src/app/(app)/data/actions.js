"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"

export async function bulkUpdateStatus(ids, newStatus) {
  const user = await requireUserOrThrow()
  if (!ids?.length) return
  /* One transaction: if the activity insert failed on its own, statuses would
     change with no audit trail and no sign anything went wrong. The INSERT runs
     first so it reads the OLD status set before the UPDATE rewrites it. */
  await sql.transaction([
    sql`
      INSERT INTO public.contact_activities
        (contact_id, author_email, type, title, body, completed_at)
      SELECT id, ${user.email}, 'status_change', 'Status changed',
             ${"Bulk status update to " + newStatus}, NOW()
      FROM public.contact_us
      WHERE id = ANY(${ids})
    `,
    sql`
      UPDATE public.contact_us
      SET status = ${newStatus}
      WHERE id = ANY(${ids})
    `,
  ])
  revalidatePath("/data")
  revalidatePath("/planner")
}
