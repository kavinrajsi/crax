import { Skeleton } from "@/components/ui/skeleton"
import { BackLink, FieldCardSkeleton, ThreadSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/companies/[id]/page.js and
 * src/components/company-notes-section.js. Update together.
 */
export default function CompanyDetailLoading() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink width="w-36" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* building icon tile */}
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <Skeleton className="h-8 w-48" />
          </div>
          {/* industry line, indented past the tile */}
          <Skeleton className="mt-1 ml-11 h-5 w-32" />
        </div>
        {/* CompanyForm edit trigger */}
        <Skeleton className="h-7 w-28 shrink-0 rounded-lg" />
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      {/* Website + Phone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldCardSkeleton />
        <FieldCardSkeleton />
      </div>

      {/* Linked contacts */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-8 rounded-4xl" />
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-4xl" />
            </div>
          ))}
        </div>
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      <ThreadSkeleton titleWidth="w-14" entries={2} entryGapClassName="gap-3" />
    </div>
  )
}
