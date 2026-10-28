import Link from "next/link"
import { BoltIcon } from "lucide-react"
import { isCurrentUserAdmin, requireUser } from "@/lib/dal"
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
import { AppHeaderTitle } from "@/components/app-header-title"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { ThemeToggle } from "@/components/theme-toggle"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }) {
  // Gates every route in the (app) group. Previously this read the session and
  // fell through to a "Guest" render, which served the full contact table to
  // anonymous visitors.
  const user = await requireUser()

  /* Decides whether the Admin entry is drawn, nothing more. getSession() is
     memoized for the render, so this costs no extra round trip. */
  const isAdmin = await isCurrentUserAdmin()

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
              <AppNav isAdmin={isAdmin} />
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

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:h-16 md:bg-background md:backdrop-blur-none">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-auto" />
          <AppHeaderTitle />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        {/* Bottom padding clears the phone tab bar (56px + home indicator). */}
        <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.25rem)] md:px-6 md:py-8 md:pb-8">
          {children}
        </main>
      </SidebarInset>
      <MobileTabBar />
    </SidebarProvider>
  )
}
