import Link from "next/link"
import {
  LayoutDashboardIcon,
  UserIcon,
  DatabaseIcon,
  ScrollTextIcon,
  BoltIcon,
  KanbanSquareIcon,
  CircleDollarSignIcon,
} from "lucide-react"
import { auth } from "@/lib/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarUser } from "@/components/sidebar-user"

export const dynamic = "force-dynamic"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/data",      label: "Data",      icon: DatabaseIcon },
  { href: "/deals",     label: "Deals",     icon: CircleDollarSignIcon },
  { href: "/logs",      label: "Logs",      icon: ScrollTextIcon },
  { href: "/planner",   label: "Planner",   icon: KanbanSquareIcon },
  { href: "/profile",   label: "Profile",   icon: UserIcon },
]

export default async function AppLayout({ children }) {
  const { data: session } = await auth.getSession()
  const user = session?.user ?? null

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">

        {/* Logo */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/dashboard" />}
                tooltip="Crax"
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BoltIcon className="size-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-semibold text-sm">Crax</span>
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <Separator />

        {/* Nav */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ href, label, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User */}
        <SidebarFooter>
          <SidebarUser
            displayName={user?.name ?? user?.email ?? "Guest"}
            email={user?.email ?? ""}
          />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-auto" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
