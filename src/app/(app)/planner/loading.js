import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading, TabsListSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/planner/page.js and the default tab,
 * src/components/contacts-kanban.js. Update together.
 */

// One entry per STATUS_COLUMNS column; a uniform count reads as a grid, not a
// board.
const CARDS_PER_COLUMN = [3, 2, 2, 1, 1, 1, 1]

export default function PlannerLoading() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading titleWidth="w-28" subWidth="w-72" />

      {/* Tabs root is flex flex-col gap-2 when horizontal */}
      <div className="flex flex-col gap-2">
        <TabsListSkeleton widths={["w-32", "w-28"]} />

        <div className="mt-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {CARDS_PER_COLUMN.map((cardCount, columnIndex) => (
              <div
                key={columnIndex}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-8 rounded-4xl" />
                </div>

                <div className="h-px w-full shrink-0 bg-border" />

                {/* maxHeight is what keeps the real column from growing past the
                    viewport — without it the skeleton is a different height. */}
                <div
                  className="flex min-h-[80px] flex-col gap-2 overflow-y-auto p-2"
                  style={{ maxHeight: "calc(100vh - 260px)" }}
                >
                  {Array.from({ length: cardCount }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-card p-3 text-xs shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="h-4 w-10 shrink-0" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-3 w-3 shrink-0" />
                            <Skeleton className="h-4 flex-1" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-3 w-3 shrink-0" />
                            <Skeleton className="h-4 flex-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
