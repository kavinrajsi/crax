"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"

/* ─── contact status ─────────────────────────────────────────────────── */

// authorEmail is derived from the session, never accepted from the caller —
// a server action is a public POST endpoint, so a caller-supplied author made
// the audit trail whatever the caller said it was.
export async function updateContactStatus(contactId, newStatus) {
  const user = await requireUserOrThrow()

  /* The old status is read inside SQL rather than in a preceding round trip.
     Reading it in JS first was non-atomic: a concurrent update between the
     SELECT and the UPDATE made the timeline record a "from" value that was
     already stale. The INSERT runs before the UPDATE so it still sees the old
     row, and `IS DISTINCT FROM` makes it a no-op when nothing actually changed
     (also handling a NULL status, which `<>` would not). */
  await sql.transaction([
    sql`
      INSERT INTO public.contact_activities
        (contact_id, author_email, type, title, body, completed_at)
      SELECT id, ${user.email}, 'status_change', 'Status changed',
             'Status changed from ' || COALESCE(status, 'unknown') || ' to ' || ${newStatus},
             NOW()
      FROM public.contact_us
      WHERE id = ${contactId} AND status IS DISTINCT FROM ${newStatus}
    `,
    sql`
      UPDATE public.contact_us
      SET status = ${newStatus}
      WHERE id = ${contactId} AND status IS DISTINCT FROM ${newStatus}
    `,
  ])

  revalidatePath("/planner")
  revalidatePath("/data")
  revalidatePath(`/contacts/${contactId}`)
}

/* ─── boards ─────────────────────────────────────────────────────────── */

export async function createBoard(name) {
  await requireUserOrThrow()
  const [board] = await sql`
    INSERT INTO public.kanban_boards (name) VALUES (${name}) RETURNING *
  `
  revalidatePath("/planner")
  return board
}

export async function deleteBoard(boardId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.kanban_boards WHERE id = ${boardId}`
  revalidatePath("/planner")
}

/* ─── columns ────────────────────────────────────────────────────────── */

export async function createColumn(boardId, name, color) {
  await requireUserOrThrow()
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.kanban_columns WHERE board_id = ${boardId}
  `
  const [col] = await sql`
    INSERT INTO public.kanban_columns (board_id, name, color, position)
    VALUES (${boardId}, ${name}, ${color}, ${max + 1})
    RETURNING *
  `
  revalidatePath("/planner")
  return col
}

export async function updateColumn(colId, name, color) {
  await requireUserOrThrow()
  await sql`UPDATE public.kanban_columns SET name=${name}, color=${color} WHERE id=${colId}`
  revalidatePath("/planner")
}

export async function deleteColumn(colId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.kanban_columns WHERE id = ${colId}`
  revalidatePath("/planner")
}

export async function reorderColumns(orderedIds) {
  await requireUserOrThrow()
  // One transaction, not N round trips — a failure partway through used to
  // leave the board half-reordered with no way to tell.
  await sql.transaction(
    orderedIds.map(
      (id, i) => sql`UPDATE public.kanban_columns SET position=${i} WHERE id=${id}`
    )
  )
  revalidatePath("/planner")
}

/* ─── cards ──────────────────────────────────────────────────────────── */

export async function createCard(columnId, title, description) {
  await requireUserOrThrow()
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.kanban_cards WHERE column_id = ${columnId}
  `
  const [card] = await sql`
    INSERT INTO public.kanban_cards (column_id, title, description, position)
    VALUES (${columnId}, ${title}, ${description ?? null}, ${max + 1})
    RETURNING *
  `
  revalidatePath("/planner")
  return card
}

export async function updateCard(cardId, title, description) {
  await requireUserOrThrow()
  await sql`UPDATE public.kanban_cards SET title=${title}, description=${description ?? null} WHERE id=${cardId}`
  revalidatePath("/planner")
}

export async function deleteCard(cardId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.kanban_cards WHERE id = ${cardId}`
  revalidatePath("/planner")
}

export async function moveCard(cardId, newColumnId, orderedCardIds) {
  await requireUserOrThrow()
  // The column reassignment and the position rewrite must land together, or a
  // mid-loop failure leaves the card in its new column at the wrong index.
  await sql.transaction([
    sql`UPDATE public.kanban_cards SET column_id=${newColumnId} WHERE id=${cardId}`,
    ...orderedCardIds.map(
      (id, i) => sql`UPDATE public.kanban_cards SET position=${i} WHERE id=${id}`
    ),
  ])
  revalidatePath("/planner")
}
