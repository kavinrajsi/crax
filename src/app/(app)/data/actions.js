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
  revalidatePath("/data")
  revalidatePath("/planner")
}
