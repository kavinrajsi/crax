import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { SettingsClient } from "@/components/settings-client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await requireUser()

  const [pipelines, stages, counts, colorRows] = await Promise.all([
    sql`SELECT id, name FROM public.pipelines ORDER BY position ASC, id ASC`,
    sql`
      SELECT key, pipeline_id, label, color, position, resolved
      FROM public.pipeline_stages
      ORDER BY pipeline_id ASC, position ASC, key ASC
    `,
    sql`SELECT pipeline_id, COUNT(*)::int AS n FROM public.contact_us GROUP BY pipeline_id`,
    sql`SELECT source_key, color FROM public.pipeline_source_colors WHERE user_email = ${user.email}`,
  ])

  const contactCounts = Object.fromEntries(counts.map((countRow) => [countRow.pipeline_id, countRow.n]))
  const sourceColors = Object.fromEntries(colorRows.map((colorRow) => [colorRow.source_key, colorRow.color]))

  return (
    <SettingsClient
      pipelines={pipelines}
      stages={stages}
      contactCounts={contactCounts}
      sourceColors={sourceColors}
    />
  )
}
