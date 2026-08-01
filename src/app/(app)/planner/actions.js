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

  await recordAudit(user, "contact.status_change", {
    table: "contact_us", id: contactId,
    before: before && { status: before.status },
    after: { status: newStatus },
  })
  revalidatePath("/planner")
  revalidatePath("/data")
  revalidatePath(`/contacts/${contactId}`)
}

/* ─── boards ─────────────────────────────────────────────────────────── */

export async function createBoard(name) {
  const user = await requireUserOrThrow()
  const [board] = await sql`
    INSERT INTO public.kanban_boards (name) VALUES (${name}) RETURNING *
  `
  await recordAudit(user, "board.create", { table: "kanban_boards", id: board.id, after: board })
  revalidatePath("/planner")
  return board
}

export async function deleteBoard(boardId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_boards", boardId)
  await sql`DELETE FROM public.kanban_boards WHERE id = ${boardId}`
  await recordAudit(user, "board.delete", { table: "kanban_boards", id: boardId, before })
  revalidatePath("/planner")
}

/* ─── columns ────────────────────────────────────────────────────────── */

export async function createColumn(boardId, name, color) {
  const user = await requireUserOrThrow()
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.kanban_columns WHERE board_id = ${boardId}
  `
  const [col] = await sql`
    INSERT INTO public.kanban_columns (board_id, name, color, position)
    VALUES (${boardId}, ${name}, ${color}, ${max + 1})
    RETURNING *
  `
  await recordAudit(user, "column.create", { table: "kanban_columns", id: col.id, after: col })
  revalidatePath("/planner")
  return col
}

export async function updateColumn(colId, name, color) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_columns", colId)
  await sql`UPDATE public.kanban_columns SET name=${name}, color=${color} WHERE id=${colId}`
  await recordAudit(user, "column.update", {
    table: "kanban_columns", id: colId, before, after: { name, color },
  })
  revalidatePath("/planner")
}

export async function deleteColumn(colId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_columns", colId)
  await sql`DELETE FROM public.kanban_columns WHERE id = ${colId}`
  await recordAudit(user, "column.delete", { table: "kanban_columns", id: colId, before })
  revalidatePath("/planner")
}

export async function reorderColumns(orderedIds) {
  const user = await requireUserOrThrow()
  // One transaction, not N round trips — a failure partway through used to
  // leave the board half-reordered with no way to tell.
  await sql.transaction(
    orderedIds.map(
      (id, i) => sql`UPDATE public.kanban_columns SET position=${i} WHERE id=${id}`
    )
  )
  await recordAudit(user, "column.reorder", {
    table: "kanban_columns", after: { order: orderedIds },
  })
  revalidatePath("/planner")
}

/* ─── cards ──────────────────────────────────────────────────────────── */

export async function createCard(columnId, title, description) {
  const user = await requireUserOrThrow()
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.kanban_cards WHERE column_id = ${columnId}
  `
  const [card] = await sql`
    INSERT INTO public.kanban_cards (column_id, title, description, position)
    VALUES (${columnId}, ${title}, ${description ?? null}, ${max + 1})
    RETURNING *
  `
  await recordAudit(user, "card.create", { table: "kanban_cards", id: card.id, after: card })
  revalidatePath("/planner")
  return card
}

export async function updateCard(cardId, title, description) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_cards", cardId)
  await sql`UPDATE public.kanban_cards SET title=${title}, description=${description ?? null} WHERE id=${cardId}`
  await recordAudit(user, "card.update", {
    table: "kanban_cards", id: cardId, before, after: { title, description },
  })
  revalidatePath("/planner")
}

export async function deleteCard(cardId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_cards", cardId)
  await sql`DELETE FROM public.kanban_cards WHERE id = ${cardId}`
  await recordAudit(user, "card.delete", { table: "kanban_cards", id: cardId, before })
  revalidatePath("/planner")
}

export async function moveCard(cardId, newColumnId, orderedCardIds) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_cards", cardId)
  // The column reassignment and the position rewrite must land together, or a
  // mid-loop failure leaves the card in its new column at the wrong index.
  await sql.transaction([
    sql`UPDATE public.kanban_cards SET column_id=${newColumnId} WHERE id=${cardId}`,
    ...orderedCardIds.map(
      (id, i) => sql`UPDATE public.kanban_cards SET position=${i} WHERE id=${id}`
    ),
  ])
  await recordAudit(user, "card.move", {
    table: "kanban_cards", id: cardId,
    before: before && { column_id: before.column_id },
    after: { column_id: newColumnId },
  })
  revalidatePath("/planner")
}
