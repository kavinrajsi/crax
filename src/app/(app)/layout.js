import Link from "next/link"
import { BoltIcon } from "lucide-react"
import { requireUser } from "@/lib/dal"
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
import { AppNav } from "@/components/app-nav"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }) {
  // Gates every route in the (app) group. Previously this read the session and
  // fell through to a "Guest" render, which served the full contact table to
  // anonymous visitors.
  const user = await requireUser()

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
              <AppNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User */}
        <SidebarFooter>
          <SidebarUser
            displayName={user.name ?? user.email}
            email={user.email ?? ""}
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
