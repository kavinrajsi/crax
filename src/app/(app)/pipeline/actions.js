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

/* ─── boards ─────────────────────────────────────────────────────────── */

export async function createBoard(name) {
  const user = await requireUserOrThrow()
  const [board] = await sql`
    INSERT INTO public.kanban_boards (name) VALUES (${name}) RETURNING *
  `
  await recordAudit(user, "board.create", { table: "kanban_boards", id: board.id, after: board })
  revalidatePath("/pipeline")
  return board
}

export async function deleteBoard(boardId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_boards", boardId)
  await sql`DELETE FROM public.kanban_boards WHERE id = ${boardId}`
  await recordAudit(user, "board.delete", { table: "kanban_boards", id: boardId, before })
  revalidatePath("/pipeline")
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
  revalidatePath("/pipeline")
  return col
}

export async function updateColumn(colId, name, color) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_columns", colId)
  await sql`UPDATE public.kanban_columns SET name=${name}, color=${color} WHERE id=${colId}`
  await recordAudit(user, "column.update", {
    table: "kanban_columns", id: colId, before, after: { name, color },
  })
  revalidatePath("/pipeline")
}

export async function deleteColumn(colId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_columns", colId)
  await sql`DELETE FROM public.kanban_columns WHERE id = ${colId}`
  await recordAudit(user, "column.delete", { table: "kanban_columns", id: colId, before })
  revalidatePath("/pipeline")
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
  revalidatePath("/pipeline")
}

/* ─── cards ──────────────────────────────────────────────────────────── */

export async function createCard(columnId, title, description, contactId = null) {
  const user = await requireUserOrThrow()
  const [{ max }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max FROM public.kanban_cards WHERE column_id = ${columnId}
  `
  const [card] = await sql`
    INSERT INTO public.kanban_cards (column_id, title, description, position, contact_id)
    VALUES (${columnId}, ${title}, ${description ?? null}, ${max + 1}, ${contactId ?? null})
    RETURNING *
  `
  await recordAudit(user, "card.create", { table: "kanban_cards", id: card.id, after: card })
  revalidatePath("/pipeline")
  return card
}

export async function updateCard(cardId, title, description, contactId = null) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_cards", cardId)
  await sql`UPDATE public.kanban_cards SET title=${title}, description=${description ?? null}, contact_id=${contactId ?? null} WHERE id=${cardId}`
  await recordAudit(user, "card.update", {
    table: "kanban_cards", id: cardId, before, after: { title, description, contact_id: contactId },
  })
  revalidatePath("/pipeline")
}

export async function deleteCard(cardId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("kanban_cards", cardId)
  await sql`DELETE FROM public.kanban_cards WHERE id = ${cardId}`
  await recordAudit(user, "card.delete", { table: "kanban_cards", id: cardId, before })
  revalidatePath("/pipeline")
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
  revalidatePath("/pipeline")
}
