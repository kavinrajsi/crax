"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { CLOSED_STAGES } from "@/lib/deal-stages"

/**
 * Deal actions. Every one gates first — a server action is a public POST
 * endpoint, so reaching one does not imply the caller ever rendered /deals.
 */

export async function createDeal(fields) {
  const user = await requireUserOrThrow()
  const { title, value, stage, contactId, companyId, expectedCloseDate } = fields
  if (!title?.trim()) throw new Error("A deal needs a title")

  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.deals WHERE stage = ${stage}
  `
  const [deal] = await sql`
    INSERT INTO public.deals
      (title, value, stage, contact_id, company_id, owner_email, expected_close_date, position,
       won_at, lost_at)
    VALUES
      (${title.trim()}, ${Number(value) || 0}, ${stage}, ${contactId ?? null}, ${companyId ?? null},
       ${user.email}, ${expectedCloseDate || null}, ${max + 1},
       ${stage === "won" ? new Date().toISOString() : null},
       ${stage === "lost" ? new Date().toISOString() : null})
    RETURNING *
  `
  revalidatePath("/deals")
  return deal
}

export async function updateDeal(dealId, fields) {
  await requireUserOrThrow()
  const { title, value, contactId, companyId, expectedCloseDate } = fields
  if (!title?.trim()) throw new Error("A deal needs a title")

  await sql`
    UPDATE public.deals
    SET title               = ${title.trim()},
        value               = ${Number(value) || 0},
        contact_id          = ${contactId ?? null},
        company_id          = ${companyId ?? null},
        expected_close_date = ${expectedCloseDate || null}
    WHERE id = ${dealId}
  `
  revalidatePath("/deals")
}

export async function deleteDeal(dealId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.deals WHERE id = ${dealId}`
  revalidatePath("/deals")
}

/**
 * Move a deal to a stage and rewrite that column's ordering.
 *
 * One transaction: the stage change and the reorder must land together, or a
 * failure partway leaves the deal in its new column at the wrong index — the
 * same defect moveCard had before planner/actions.js was fixed.
 *
 * won_at / lost_at are set in SQL from the target stage rather than passed in,
 * so the timestamps cannot disagree with the stage. Re-opening a closed deal
 * clears them.
 */
export async function moveDeal(dealId, newStage, orderedDealIds) {
  await requireUserOrThrow()
  const closing = CLOSED_STAGES.includes(newStage)

  await sql.transaction([
    sql`
      UPDATE public.deals
      SET stage   = ${newStage},
          won_at  = ${closing && newStage === "won"  ? new Date().toISOString() : null},
          lost_at = ${closing && newStage === "lost" ? new Date().toISOString() : null}
      WHERE id = ${dealId}
    `,
    ...orderedDealIds.map(
      (id, i) => sql`UPDATE public.deals SET position = ${i} WHERE id = ${id}`
    ),
  ])
  revalidatePath("/deals")
}
