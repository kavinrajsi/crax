"use client"

import { usePathname } from "next/navigation"
import { navItems } from "@/components/app-nav"

/** Current page name for the header. Same prefix match as the nav highlight. */
export function AppHeaderTitle() {
  const pathname = usePathname()
  const item = navItems.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  )
  const label = item?.label ?? (pathname.startsWith("/settings") ? "Settings" : pathname.startsWith("/profile") ? "Profile" : "Crax")
  return <span className="truncate text-sm font-medium">{label}</span>
}
