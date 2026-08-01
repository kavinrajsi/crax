import { Card, CardContent } from "@/components/ui/card"
import { PageHeading, StatCardGrid, TableSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/admin/users/page.js. Update together.
 */
export default function AdminUsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading titleWidth="w-32" subWidth="w-96" />

      {/* Four cards, no sub-line — same shape as the logs page's */}
      <StatCardGrid
        count={4}
        gridClassName="grid grid-cols-2 gap-4 xl:grid-cols-4"
        withSub={false}
      />

      <Card>
        <CardContent className="p-0">
          <TableSkeleton
            rows={6}
            rowClassName="align-top"
            columns={[
              { lines: 2 },
              {},
              { barWidth: "w-24" },
              { barWidth: "w-20" },
              { width: "w-16", cellClassName: "text-right", barWidth: "w-6" },
              { barWidth: "w-20" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
