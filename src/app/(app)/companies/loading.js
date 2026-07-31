import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading, TableSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/companies/page.js and the toolbar inside
 * src/components/companies-table.js — note the page header carries no action;
 * "New Company" lives in the table's own toolbar.
 */
export default function CompaniesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading titleWidth="w-40" subWidth="w-32" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-5 w-8 rounded-4xl" />
            <Skeleton className="h-7 w-32 rounded-lg" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          {/* No density override — companies-table keeps the default p-2 cells */}
          <TableSkeleton
            rows={8}
            columns={[
              {},
              {},
              {},
              {},
              { width: "w-24", cellClassName: "text-center" },
              { width: "w-16", barWidth: "w-6" },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
