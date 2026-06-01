"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { updateContactStatus } from "@/app/(app)/planner/actions"
import { evaluateRules } from "@/lib/automation"

const STAGE_PROBABILITY = {
  Qualification: 20,
  Proposal:      40,
  Negotiation:   70,
  "Closed-Won":  100,
  "Closed-Lost": 0,
}

export async function createDeal(fields) {
  const { data: session } = await auth.getSession()
  const ownerEmail = session?.user?.email ?? "anonymous"
  const { title, value, stage, probability, close_date, contact_id } = fields
  const resolvedStage = stage ?? "Qualification"
  const resolvedProb  = probability ?? STAGE_PROBABILITY[resolvedStage] ?? 20
  const [deal] = await sql`
    INSERT INTO public.deals (title, value, stage, probability, close_date, contact_id, owner_email)
    VALUES (
      ${title},
      ${value ?? null},
      ${resolvedStage},
      ${resolvedProb},
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
  const prob = STAGE_PROBABILITY[newStage] ?? 50

  // Read old stage for rule context
  const [dealBefore] = await sql`SELECT stage, contact_id FROM public.deals WHERE id = ${dealId}`
  const oldStage = dealBefore?.stage ?? "unknown"
  const contactId = dealBefore?.contact_id ?? null

  // Update stage, probability, and timestamps
  if (newStage === "Closed-Won") {
    await sql`UPDATE public.deals SET stage=${newStage}, probability=${prob}, won_at=NOW(), lost_at=NULL WHERE id=${dealId}`
  } else if (newStage === "Closed-Lost") {
    await sql`UPDATE public.deals SET stage=${newStage}, probability=${prob}, lost_at=NOW(), won_at=NULL WHERE id=${dealId}`
  } else {
    await sql`UPDATE public.deals SET stage=${newStage}, probability=${prob}, won_at=NULL, lost_at=NULL WHERE id=${dealId}`
  }

  // Auto-sync linked contact status on terminal stages
  if (contactId) {
    if (newStage === "Closed-Won") {
      await updateContactStatus(contactId, "win", "system")
    } else if (newStage === "Closed-Lost") {
      await updateContactStatus(contactId, "rejected", "system")
    }
  }

  await evaluateRules("deal_stage_changed", { dealId, contactId, fromStage: oldStage, toStage: newStage })

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
