import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { ProfileClient } from "@/components/profile-client"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await requireUser()

  const colorRows = await sql`SELECT source_key, color FROM public.pipeline_source_colors WHERE user_email = ${user.email}`
  const sourceColors = Object.fromEntries(colorRows.map((colorRow) => [colorRow.source_key, colorRow.color]))

  return (
    <ProfileClient
      initialName={user.name ?? ""}
      initialEmail={user.email ?? ""}
      sourceColors={sourceColors}
    />
  )
}
