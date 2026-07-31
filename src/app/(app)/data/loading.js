import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading, TableSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/data/page.js and the header bar inside
 * src/components/data-page-client.js. Update all three together.
 */
export default function DataLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeading titleWidth="w-24" subWidth="w-80" />
        {/* CsvImportDialog trigger, size="sm" */}
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex w-full flex-col">
          {/* DataPageClient's sticky header */}
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-8 rounded-4xl" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-56 rounded-lg" />
            </div>
          </header>

          <TableSkeleton
            rows={12}
            headClassName="[&>th]:h-8"
            rowClassName="[&>td]:py-1"
            columns={[
              { width: "w-10", barWidth: "w-4" },
              { width: "w-12", barWidth: "w-6" },
              { lines: 2 },
              { lines: 2 },
              { barWidth: "w-14" },
              { barWidth: "w-20" },
              { barWidth: "w-16" },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
