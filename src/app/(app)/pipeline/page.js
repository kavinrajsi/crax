import { sql } from "@/lib/db"
import { PipelineBoard } from "@/components/pipeline-board"

import { requireUser } from "@/lib/dal"
import { normalizePipelineSource } from "@/lib/contact-sources"

export const dynamic = "force-dynamic"

export default async function PipelinePage({ searchParams }) {
  const viewer = await requireUser()

  const { source, pipeline } = await searchParams
  const initialSource = normalizePipelineSource(source)

  const [pipelines, stages, contacts, colorRows] = await Promise.all([
    sql`SELECT id, name FROM public.pipelines ORDER BY position ASC, id ASC`,
    sql`
      SELECT key, pipeline_id, label, color, position, resolved
      FROM public.pipeline_stages
      ORDER BY pipeline_id ASC, position ASC, key ASC
    `,
    sql`
      SELECT id, name, email, phone, company, source_url, status, pipeline_id, needs, created_at
      FROM public.contact_us
      ORDER BY created_at DESC
    `,
    sql`SELECT source_key, color FROM public.pipeline_source_colors WHERE user_email = ${viewer.email}`,
  ])

  // ?pipeline= picks the board; anything unknown falls back to the first pipeline.
  const requested = Number.parseInt(pipeline, 10)
  const activePipelineId = pipelines.some((candidate) => candidate.id === requested)
    ? requested
    : pipelines[0]?.id ?? null

  const sourceColors = Object.fromEntries(colorRows.map((colorRow) => [colorRow.source_key, colorRow.color]))

  return (
    <PipelineBoard
      contacts={contacts}
      pipelines={pipelines}
      stages={stages}
      activePipelineId={activePipelineId}
      initialSource={initialSource}
      sourceColors={sourceColors}
    />
  )
}
