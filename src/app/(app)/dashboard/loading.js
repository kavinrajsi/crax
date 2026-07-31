import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageHeading, StatCardGrid } from "@/components/skeletons"

/** Mirrors src/app/(app)/dashboard/page.js. Update both together. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading titleWidth="w-40" subWidth="w-56" />

      <StatCardGrid count={3} gridClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />

      <div className="grid gap-4">
        {/* Source breakdown */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent className="p-0">
            <ul>
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  {i > 0 && <div className="h-px w-full shrink-0 bg-border" />}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <Skeleton className="h-5 w-32" />
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <Skeleton className="h-1.5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-8 rounded-4xl" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
