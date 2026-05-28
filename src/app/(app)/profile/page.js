import { auth } from "@/lib/auth"
import { ProfileClient } from "@/components/profile-client"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const { data: session } = await auth.getSession()

  return (
    <ProfileClient
      initialName={session?.user?.name ?? ""}
      initialEmail={session?.user?.email ?? ""}
    />
  )
}
