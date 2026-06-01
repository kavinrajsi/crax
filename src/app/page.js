import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Home() {
  const { data: session } = await auth.getSession()
  redirect(session?.user ? "/dashboard" : "/login")
}
