"use client"

import { usePathname } from "next/navigation"
import { navItems } from "@/components/app-nav"

/** Current page name for the header. Same prefix match as the nav highlight. */
export function AppHeaderTitle() {
  const pathname = usePathname()
  const item = navItems.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  )
  return <span className="truncate text-sm font-medium">{item?.label ?? "Crax"}</span>
}
