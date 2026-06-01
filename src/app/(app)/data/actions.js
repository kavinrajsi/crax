"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"

export async function bulkUpdateStatus(ids, newStatus) {
  if (!ids?.length) return
  await sql`
    UPDATE public.contact_us
    SET status = ${newStatus}
    WHERE id = ANY(${ids})
  `
  // Log status change as timeline entry for each contact
  await sql`
    INSERT INTO public.contact_activities
      (contact_id, author_email, type, title, body, completed_at)
    SELECT id, 'system', 'status_change', 'Status changed',
           ${"Bulk status update to " + newStatus}, NOW()
    FROM public.contact_us
    WHERE id = ANY(${ids})
  `
  revalidatePath("/data")
  revalidatePath("/planner")
}
