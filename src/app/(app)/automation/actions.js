"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function createRule(fields) {
  const { data: session } = await auth.getSession()
  const ownerEmail = session?.user?.email ?? "anonymous"
  const { name, trigger_event, trigger_filter, action_type, action_config } = fields
  const [rule] = await sql`
    INSERT INTO public.automation_rules
      (name, trigger_event, trigger_filter, action_type, action_config, owner_email)
    VALUES
      (${name}, ${trigger_event}, ${trigger_filter ?? {}}, ${action_type}, ${action_config ?? {}}, ${ownerEmail})
    RETURNING *
  `
  revalidatePath("/automation")
  return rule
}

export async function toggleRule(ruleId, isActive) {
  await sql`UPDATE public.automation_rules SET is_active = ${isActive} WHERE id = ${ruleId}`
  revalidatePath("/automation")
}

export async function deleteRule(ruleId) {
  await sql`DELETE FROM public.automation_rules WHERE id = ${ruleId}`
  revalidatePath("/automation")
}
