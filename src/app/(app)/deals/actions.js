"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function createDeal(fields) {
  const { data: session } = await auth.getSession()
  const ownerEmail = session?.user?.email ?? "anonymous"
  const { title, value, stage, probability, close_date, contact_id } = fields
  const [deal] = await sql`
    INSERT INTO public.deals (title, value, stage, probability, close_date, contact_id, owner_email)
    VALUES (
      ${title},
      ${value ?? null},
      ${stage ?? "Qualification"},
      ${probability ?? 50},
      ${close_date ?? null},
      ${contact_id ?? null},
      ${ownerEmail}
    )
    RETURNING *
  `
  revalidatePath("/deals")
  revalidatePath("/dashboard")
  return deal
}

export async function updateDeal(dealId, fields) {
  const { title, value, stage, probability, close_date, contact_id } = fields
  await sql`
    UPDATE public.deals
    SET title      = ${title},
        value      = ${value ?? null},
        stage      = ${stage},
        probability= ${probability ?? 50},
        close_date = ${close_date ?? null},
        contact_id = ${contact_id ?? null}
    WHERE id = ${dealId}
  `
  revalidatePath("/deals")
  revalidatePath("/dashboard")
}

export async function moveDeal(dealId, newStage) {
  if (newStage === "Closed-Won") {
    await sql`UPDATE public.deals SET stage=${newStage}, won_at=NOW(), lost_at=NULL WHERE id=${dealId}`
  } else if (newStage === "Closed-Lost") {
    await sql`UPDATE public.deals SET stage=${newStage}, lost_at=NOW(), won_at=NULL WHERE id=${dealId}`
  } else {
    await sql`UPDATE public.deals SET stage=${newStage}, won_at=NULL, lost_at=NULL WHERE id=${dealId}`
  }
  revalidatePath("/deals")
  revalidatePath("/dashboard")
}

export async function deleteDeal(dealId) {
  await sql`DELETE FROM public.deals WHERE id = ${dealId}`
  revalidatePath("/deals")
  revalidatePath("/dashboard")
}

export async function addDealNote(dealId, body) {
  const trimmed = body?.trim()
  if (!trimmed) return
  const { data: session } = await auth.getSession()
  const authorEmail = session?.user?.email ?? "anonymous"
  await sql`
    INSERT INTO public.deal_notes (deal_id, author_email, body)
    VALUES (${dealId}, ${authorEmail}, ${trimmed})
  `
  revalidatePath("/deals")
}
