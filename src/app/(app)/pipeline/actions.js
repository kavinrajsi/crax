"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit, snapshot } from "@/lib/audit"

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function cleanText(value, max, label) {
  const text = String(value ?? "").trim()
  if (!text) throw new Error(`${label} is required`)
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`)
  return text
}

function cleanColor(value) {
  if (!HEX_COLOR.test(String(value ?? ""))) throw new Error("Colour must be a hex value like #3b82f6")
  return value.toLowerCase()
}

/* ─── contact status ─────────────────────────────────────────────────── */

// authorEmail is derived from the session, never accepted from the caller —
// a server action is a public POST endpoint, so a caller-supplied author made
// the audit trail whatever the caller said it was.
export async function updateContactStatus(contactId, newStatus) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_us", contactId)
  if (!before) throw new Error("Contact not found")

  // A status must be a stage of the contact's own pipeline. The foreign key only
  // proves some pipeline defines it.
  const [stage] = await sql`
    SELECT pipeline_id FROM public.pipeline_stages WHERE key = ${newStatus}
  `
  if (!stage) throw new Error("Unknown stage")
  if (stage.pipeline_id !== before.pipeline_id) {
    throw new Error("That stage belongs to a different pipeline")
  }

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

/* Moves a contact into another pipeline. It lands in that pipeline's first
   stage, because its old stage means nothing there. */
export async function moveContactToPipeline(contactId, pipelineId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_us", contactId)
  if (!before) throw new Error("Contact not found")

  const [first] = await sql`
    SELECT key FROM public.pipeline_stages
    WHERE pipeline_id = ${pipelineId}
    ORDER BY position ASC, key ASC
    LIMIT 1
  `
  if (!first) throw new Error("That pipeline has no stages")

  await sql`
    UPDATE public.contact_us
    SET pipeline_id = ${pipelineId}, status = ${first.key}
    WHERE id = ${contactId}
  `
  await recordAudit(user, "contact.pipeline_move", {
    table: "contact_us", id: contactId,
    before: { pipeline_id: before.pipeline_id, status: before.status },
    after: { pipeline_id: pipelineId, status: first.key },
  })
  revalidatePath("/pipeline")
  revalidatePath("/data")
  return { status: first.key }
}

/* ─── pipelines and stages ───────────────────────────────────────────── */

/* A pipeline is never created empty: it starts with one stage, so the board
   always has a column to drop a contact into. */
export async function createPipeline(name, firstStageLabel) {
  const user = await requireUserOrThrow()
  const cleanName = cleanText(name, 60, "Pipeline name")
  const cleanStage = cleanText(firstStageLabel, 60, "First stage name")
  const [row] = await sql`
    INSERT INTO public.pipelines (name, position, created_by)
    VALUES (${cleanName}, (SELECT COALESCE(MAX(position), 0) + 1 FROM public.pipelines), ${user.email})
    RETURNING id, name
  `
  const key = `p${row.id}-${cleanStage.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "stage"}-${Math.random().toString(36).slice(2, 6)}`
  await sql`
    INSERT INTO public.pipeline_stages (key, pipeline_id, label, color, position)
    VALUES (${key}, ${row.id}, ${cleanStage}, '#64748b', 0)
  `
  await recordAudit(user, "pipeline.create", {
    table: "pipelines", id: row.id, after: { name: cleanName, first_stage: cleanStage },
  })
  revalidatePath("/pipeline")
  return row
}

export async function deletePipeline(pipelineId) {
  const user = await requireUserOrThrow()
  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM public.contact_us WHERE pipeline_id = ${pipelineId}
  `
  if (n > 0) throw new Error("Move or delete its contacts before deleting the pipeline")
  const before = await snapshot("pipelines", pipelineId)
  await sql`DELETE FROM public.pipelines WHERE id = ${pipelineId}`
  await recordAudit(user, "pipeline.delete", { table: "pipelines", id: pipelineId, before })
  revalidatePath("/pipeline")
}

export async function addStage(pipelineId, label, color) {
  const user = await requireUserOrThrow()
  const cleanLabel = cleanText(label, 60, "Stage name")
  const cleanHex = cleanColor(color)
  const slug = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "stage"
  // Keys are global (contact_us.status points at them), so the pipeline id and a
  // random suffix keep two pipelines from ever producing the same key.
  const key = `p${pipelineId}-${slug}-${Math.random().toString(36).slice(2, 6)}`
  const [row] = await sql`
    INSERT INTO public.pipeline_stages (key, pipeline_id, label, color, position)
    VALUES (
      ${key}, ${pipelineId}, ${cleanLabel}, ${cleanHex},
      (SELECT COALESCE(MAX(position), -1) + 1 FROM public.pipeline_stages WHERE pipeline_id = ${pipelineId})
    )
    RETURNING key, label, color, position
  `
  await recordAudit(user, "pipeline.stage_add", {
    table: "pipeline_stages", id: key, after: { pipeline_id: pipelineId, label: cleanLabel, color: cleanHex },
  })
  revalidatePath("/pipeline")
  return row
}

export async function updateStage(stageKey, label, color) {
  const user = await requireUserOrThrow()
  const cleanLabel = cleanText(label, 60, "Stage name")
  const cleanHex = cleanColor(color)
  const before = await snapshot("pipeline_stages", stageKey)
  await sql`
    UPDATE public.pipeline_stages SET label = ${cleanLabel}, color = ${cleanHex} WHERE key = ${stageKey}
  `
  await recordAudit(user, "pipeline.stage_update", {
    table: "pipeline_stages", id: stageKey,
    before: before && { label: before.label, color: before.color },
    after: { label: cleanLabel, color: cleanHex },
  })
  revalidatePath("/pipeline")
}

export async function deleteStage(stageKey) {
  const user = await requireUserOrThrow()
  const before = await snapshot("pipeline_stages", stageKey)
  if (!before) throw new Error("Stage not found")

  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM public.contact_us WHERE status = ${stageKey}
  `
  if (n > 0) throw new Error(`Move the ${n} contact${n === 1 ? "" : "s"} in this stage first`)

  const [{ stages }] = await sql`
    SELECT COUNT(*)::int AS stages FROM public.pipeline_stages WHERE pipeline_id = ${before.pipeline_id}
  `
  if (stages <= 1) throw new Error("A pipeline needs at least one stage")

  await sql`DELETE FROM public.pipeline_stages WHERE key = ${stageKey}`
  await recordAudit(user, "pipeline.stage_delete", {
    table: "pipeline_stages", id: stageKey,
    before: { label: before.label, color: before.color, pipeline_id: before.pipeline_id },
  })
  revalidatePath("/pipeline")
}

/* ─── source tag colours (per user) ──────────────────────────────────── */

export async function setSourceColor(sourceKey, color) {
  const user = await requireUserOrThrow()
  const cleanHex = cleanColor(color)
  await sql`
    INSERT INTO public.pipeline_source_colors (user_email, source_key, color)
    VALUES (${user.email}, ${sourceKey}, ${cleanHex})
    ON CONFLICT (user_email, source_key) DO UPDATE SET color = EXCLUDED.color
  `
  revalidatePath("/pipeline")
}
