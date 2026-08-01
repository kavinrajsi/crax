"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  UserIcon,
  DatabaseIcon,
  ScrollTextIcon,
  KanbanSquareIcon,
  BuildingIcon,
  BarChart2Icon,
  HandshakeIcon,
  ShieldCheckIcon,
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/planner",   label: "Planner",   icon: KanbanSquareIcon },
  { href: "/data",      label: "Data",      icon: DatabaseIcon },
  { href: "/deals",     label: "Deals",     icon: HandshakeIcon },
  { href: "/companies", label: "Companies", icon: BuildingIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart2Icon },
  { href: "/logs",      label: "Logs",      icon: ScrollTextIcon },
  { href: "/profile",   label: "Profile",   icon: UserIcon },
]

/** Super admins only. Appended, so it sits below the shared items. */
const adminNavItems = [
  { href: "/admin/users", label: "All Users", icon: ShieldCheckIcon },
]

/**
 * @param {boolean} [isAdmin]  from isCurrentUserAdmin() in the layout.
 *
 * Presentation only. Hiding the entry spares a non-admin a dead link; it grants
 * nothing and blocks nothing. /admin/* is gated by requireAdmin() on each page,
 * which is where the decision actually holds.
 */
export function AppNav({ isAdmin = false }) {
  const pathname = usePathname()
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems

  return (
    <SidebarMenu>
      {items.map(({ href, label, icon: Icon }) => {
        // Prefix match so /companies stays lit on /companies/123, with the
        // trailing slash keeping /data from matching /dashboard.
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              render={<Link href={href} />}
              tooltip={label}
              isActive={isActive}
            >
              <Icon />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
