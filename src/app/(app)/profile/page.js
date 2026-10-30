import { requireUser } from "@/lib/dal"
import { ProfileClient } from "@/components/profile-client"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <ProfileClient
      initialName={user.name ?? ""}
      initialEmail={user.email ?? ""}
    />
  )
}
