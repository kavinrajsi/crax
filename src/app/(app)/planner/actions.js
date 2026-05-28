"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"

/* ─── contact status ─────────────────────────────────────────────────── */

export async function updateContactStatus(contactId, newStatus) {
  await sql`UPDATE public.contact_us SET status = ${newStatus} WHERE id = ${contactId}`
  revalidatePath("/planner")
}

/* ─── boards ─────────────────────────────────────────────────────────── */

export async function createBoard(name) {
  const [board] = await sql`
    INSERT INTO public.kanban_boards (name) VALUES (${name}) RETURNING *
  `
  revalidatePath("/planner")
  return board
}

export async function deleteBoard(boardId) {
  await sql`DELETE FROM public.kanban_boards WHERE id = ${boardId}`
  revalidatePath("/planner")
}

/* ─── columns ────────────────────────────────────────────────────────── */

export async function createColumn(boardId, name, color) {
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
  await sql`UPDATE public.kanban_columns SET name=${name}, color=${color} WHERE id=${colId}`
  revalidatePath("/planner")
}

export async function deleteColumn(colId) {
  await sql`DELETE FROM public.kanban_columns WHERE id = ${colId}`
  revalidatePath("/planner")
}

export async function reorderColumns(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await sql`UPDATE public.kanban_columns SET position=${i} WHERE id=${orderedIds[i]}`
  }
  revalidatePath("/planner")
}

/* ─── cards ──────────────────────────────────────────────────────────── */

export async function createCard(columnId, title, description) {
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
  await sql`UPDATE public.kanban_cards SET title=${title}, description=${description ?? null} WHERE id=${cardId}`
  revalidatePath("/planner")
}

export async function deleteCard(cardId) {
  await sql`DELETE FROM public.kanban_cards WHERE id = ${cardId}`
  revalidatePath("/planner")
}

export async function moveCard(cardId, newColumnId, orderedCardIds) {
  await sql`UPDATE public.kanban_cards SET column_id=${newColumnId} WHERE id=${cardId}`
  for (let i = 0; i < orderedCardIds.length; i++) {
    await sql`UPDATE public.kanban_cards SET position=${i} WHERE id=${orderedCardIds[i]}`
  }
  revalidatePath("/planner")
}
