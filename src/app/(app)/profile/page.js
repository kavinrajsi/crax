import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { ProfileClient } from "@/components/profile-client"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await requireUser()

  const [connections, linkedinConnections] = await Promise.all([
    sql`
      SELECT page_id, page_name, connected_by_email, created_at
      FROM public.facebook_page_connections
      ORDER BY created_at DESC
    `,
    sql`
      SELECT account_urn, account_name, connected_by_email, created_at
      FROM public.linkedin_connections
      ORDER BY created_at DESC
    `,
  ])

  return (
    <ProfileClient
      initialName={user.name ?? ""}
      initialEmail={user.email ?? ""}
      connections={connections}
      linkedinConnections={linkedinConnections}
    />
  )
}
