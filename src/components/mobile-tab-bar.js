"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { EllipsisIcon, KanbanSquareIcon, LayoutDashboardIcon, ContactIcon, DatabaseIcon } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/* The four tabs a phone user reaches most. Everything else is one tap away
   under More, which opens the full sidebar as a sheet. */
const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquareIcon },
  { href: "/contacts", label: "Contacts", icon: ContactIcon },
  { href: "/data", label: "Data", icon: DatabaseIcon },
]

/** Phone-only bottom navigation. Hidden from md up, where the sidebar is docked. */
export function MobileTabBar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-muted text-foreground")}>
                  <Icon className="size-5" />
                </span>
                <span className={cn(active && "font-medium text-foreground")}>{label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <EllipsisIcon className="size-5" />
            </span>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
