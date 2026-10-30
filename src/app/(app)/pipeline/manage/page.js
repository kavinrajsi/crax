import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { PipelineSettings } from "@/components/pipeline-settings"

export const dynamic = "force-dynamic"

export default async function ManagePipelinesPage() {
  await requireUser()

  const [pipelines, stages, counts] = await Promise.all([
    sql`SELECT id, name FROM public.pipelines ORDER BY position ASC, id ASC`,
    sql`
      SELECT key, pipeline_id, label, color, position, resolved
      FROM public.pipeline_stages
      ORDER BY pipeline_id ASC, position ASC, key ASC
    `,
    sql`SELECT pipeline_id, COUNT(*)::int AS n FROM public.contact_us GROUP BY pipeline_id`,
  ])

  const contactCounts = Object.fromEntries(counts.map((countRow) => [countRow.pipeline_id, countRow.n]))

  return <PipelineSettings pipelines={pipelines} stages={stages} contactCounts={contactCounts} />
}
