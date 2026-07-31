"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ChevronsUpDownIcon, UserIcon, LogOutIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function initials(name) {
  return (name || "G").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

export function SidebarUser({ displayName, email }) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="md:h-8 md:p-0 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg shrink-0">
              <AvatarFallback className="rounded-lg text-xs">{initials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start leading-none text-left flex-1 min-w-0">
              <span className="text-sm font-medium truncate w-full">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate w-full">{email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">{initials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <UserIcon className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
