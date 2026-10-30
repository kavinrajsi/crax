"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  DatabaseIcon,
  ScrollTextIcon,
  KanbanSquareIcon,
  BuildingIcon,
  ShieldCheckIcon,
  GaugeIcon,
  ContactIcon,
  TargetIcon,
  SettingsIcon,
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

/* Sidebar tree. A group has no href of its own; its children are links shown
   beneath it. */
const navTree = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboardIcon },
  { href: "/data",      label: "Data",       icon: DatabaseIcon },
  {
    label: "Leads",
    icon: TargetIcon,
    children: [
      { href: "/sme",      label: "SME",      icon: GaugeIcon },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquareIcon },
    ],
  },
  { href: "/contacts",  label: "Contacts",   icon: ContactIcon },
  { href: "/companies", label: "Companies",  icon: BuildingIcon },
  { href: "/settings",  label: "Settings",   icon: SettingsIcon },
  { href: "/logs",      label: "Logs",       icon: ScrollTextIcon },
]

/* Every linked page, flat. The header title looks pages up here. */
export const navItems = navTree.flatMap((item) => item.children ?? [item])

/** Super admins only. Appended, so it sits below the shared items. */
const adminNavItems = [
  { href: "/admin/users", label: "All Users", icon: ShieldCheckIcon },
]

/* Prefix match so /companies stays lit on /companies/123, with the trailing
   slash keeping /data from matching /dashboard. */
function isPathActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * @param {boolean} [isAdmin]  from isCurrentUserAdmin() in the layout.
 *
 * Presentation only. Hiding the entry spares a non-admin a dead link; it grants
 * nothing and blocks nothing. /admin/* is gated by requireAdmin() on each page,
 * which is where the decision actually holds.
 */
export function AppNav({ isAdmin = false }) {
  const pathname = usePathname()
  const items = isAdmin ? [...navTree, ...adminNavItems] : navTree

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon

        if (item.children) {
          const groupActive = item.children.some(({ href }) => isPathActive(pathname, href))
          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton tooltip={item.label} isActive={groupActive}>
                <Icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
              <SidebarMenuSub>
                {item.children.map((child) => (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton
                      render={<Link href={child.href} />}
                      isActive={isPathActive(pathname, child.href)}
                    >
                      <span>{child.label}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          )
        }

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              tooltip={item.label}
              isActive={isPathActive(pathname, item.href)}
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
