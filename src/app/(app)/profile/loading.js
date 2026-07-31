import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { TabsListSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/components/profile-client.js — profile/page.js renders only that
 * component, so the outer wrapper lives here.
 *
 * This one is brief by nature: the page runs no query and requireUser() is
 * already resolved by the layout, so it shows for well under a frame on soft
 * navigation. It exists for the cold-load path and for consistency.
 */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-52" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <TabsListSkeleton widths={["w-20", "w-20", "w-28"]} />

        <div className="mt-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-end">
              <Skeleton className="h-8 w-32 rounded-lg" />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
