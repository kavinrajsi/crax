import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/skeletons"

/**
 * Cold-load fallback for the whole app.
 *
 * src/app/(app)/loading.js cannot cover a hard page load: the boundary it
 * creates lives *inside* (app)/layout.js, which is itself async + force-dynamic
 * and awaits requireUser(). Until that resolves there is no layout to render a
 * fallback into, so a refresh painted nothing at all. This boundary sits above
 * it and draws the chrome — sidebar, top bar, page shell — immediately.
 *
 * Mirrors src/app/(app)/layout.js. Update both together.
 */
export default function RootLoading() {
  return (
    // SidebarProvider's wrapper
    <div className="flex min-h-svh w-full">
      {/* w-64 is SIDEBAR_WIDTH ("16rem", src/components/ui/sidebar.jsx). Safe to
          hardcode because SidebarProvider seeds useState(defaultOpen) with
          defaultOpen=true and never reads the sidebar_state cookie on the
          server, so first paint is always 16rem. Wire defaultOpen to that
          cookie and this width has to follow.
          hidden below md because the real <Sidebar> is a Sheet on mobile — a
          rail here would paint and then vanish. */}
      <div className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        {/* SidebarHeader + size="lg" logo button */}
        <div className="flex flex-col gap-2 p-2">
          <div className="flex h-12 items-center gap-2 rounded-md p-2">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        <div className="h-px w-full shrink-0 bg-border" />

        {/* SidebarContent > SidebarGroup > SidebarMenu — 7 AppNav items */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex w-full min-w-0 flex-col p-2">
            <div className="flex w-full min-w-0 flex-col gap-0">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex h-8 w-full items-center gap-2 rounded-md p-2">
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SidebarFooter > SidebarUser */}
        <div className="flex flex-col gap-2 p-2">
          <div className="flex h-8 items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="ml-auto size-4 shrink-0" />
          </div>
        </div>
      </div>

      {/* SidebarInset */}
      <div className="relative flex w-full flex-1 flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4">
          <Skeleton className="-ml-1 size-7 rounded-lg" />
          <div className="h-4 w-px shrink-0 bg-border" />
        </header>
        <main className="flex-1 p-6">
          {/* Which route is loading isn't known here, so stay generic. */}
          <div className="flex flex-col gap-6">
            <PageHeading />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    </div>
  )
}
