import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageHeading, BarRowsContent } from "@/components/skeletons"

/** Mirrors src/app/(app)/analytics/page.js. Update both together. */

// Fixed silhouette for the 30-day chart — a flat row of equal bars doesn't read
// as a chart, and a random one would differ between server and client.
const CHART_BARS = [
  30, 55, 20, 70, 45, 35, 60, 25, 80, 40,
  50, 15, 65, 30, 75, 45, 20, 55, 35, 60,
  25, 70, 40, 30, 85, 50, 20, 45, 65, 35,
]

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading titleWidth="w-36" subWidth="w-56" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contacts by Status */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <BarRowsContent rows={7} />
        </Card>

        {/* New Contacts — Last 30 Days */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-64" />
                <Skeleton className="mt-1 h-5 w-40" />
              </div>
              <Skeleton className="h-5 w-20 rounded-4xl" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 w-full items-end gap-px">
              {CHART_BARS.map((height, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse rounded-t-sm bg-muted"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-14" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
