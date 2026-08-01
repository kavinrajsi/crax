import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BackLink, StatCardGrid, TableSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/admin/users/[id]/page.js and the table inside
 * src/components/logs-view.js. Update together.
 */
export default function AdminUserLogLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink width="w-32" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-2 h-5 w-64" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>

      <StatCardGrid
        count={4}
        gridClassName="grid grid-cols-2 gap-4 xl:grid-cols-4"
        withSub={false}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-56" />
            </div>
            <div className="relative w-full sm:w-60">
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-lg" />
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative h-[560px] overflow-hidden">
            <TableSkeleton
              rows={12}
              rowClassName="align-top [&>td]:pt-3"
              columns={[
                { width: "w-12", barWidth: "w-6" },
                { lines: 2 },
                { barWidth: "w-16" },
                { lines: 2 },
                { barWidth: "w-24" },
                { barWidth: "w-28" },
                { barWidth: "w-20" },
                { cellClassName: "max-w-[180px]", barWidth: "w-32" },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
