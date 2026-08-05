import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { PageHeading, BarRowsContent } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors src/app/(app)/ads/page.js. Update both together. */

export default function AdsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading titleWidth="w-32" subWidth="w-56" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-44" />
              <Skeleton className="mt-1 h-5 w-64" />
            </div>
            <Skeleton className="h-5 w-24 rounded-4xl" />
          </div>
        </CardHeader>
        <BarRowsContent rows={5} />
      </Card>

      {/* The backfill card, which the real page only renders once Google Ads
          is configured — something this skeleton cannot know yet. Matching the
          configured case (the common one) means an unconfigured account sees
          this card resolve away, which is the lesser of the two flashes: an
          element disappearing is easier to read than the page growing under a
          cursor that has already moved. */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-1 h-5 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardContent>
        <CardFooter className="justify-end">
          <Skeleton className="h-8 w-40 rounded-lg" />
        </CardFooter>
      </Card>
    </div>
  )
}
