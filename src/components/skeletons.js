/**
 * Skeleton primitives for the `loading.js` fallbacks.
 *
 * HARD RULE: this file, and every loading.js that uses it, may import only
 * `Skeleton`, the `Card*` family, `cn`, and plain HTML. Everything else in
 * src/components/ui that a page reaches for — table, separator, scroll-area,
 * tabs, avatar, label, sidebar — is "use client". Importing one of those ships
 * client JS into the boundary whose entire job is painting before any JS runs.
 * Plain-div equivalents that match the real markup:
 *
 *   Separator      → <div className="h-px w-full shrink-0 bg-border" />
 *   Table/TableRow → <table className="w-full caption-bottom text-sm"> / <tr className="border-b">
 *   TableHead      → <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
 *   TableCell      → <td className="p-2 align-middle whitespace-nowrap">
 *   ScrollArea     → <div className="relative h-[560px] overflow-hidden">
 *   Avatar h-7 w-7 → <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
 *
 * Deliberately NOT "use client" — same constraint documented in
 * src/lib/table-utils.js.
 *
 * Counts are fixed literals everywhere. No Math.random / Date: these render on
 * the server, and a varying count would desync if a client component ever
 * rendered one of these.
 */

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/* ─── page chrome ──────────────────────────────────────────────────────── */

/**
 * The <h1> + subtitle every page opens with. 32px (text-2xl line box) + 4px
 * (mt-1) + 20px (text-sm) = 56px, so the real heading drops in without shifting
 * whatever follows.
 */
export function PageHeading({ titleWidth = "w-48", subWidth = "w-72" }) {
  return (
    <div>
      <Skeleton className={cn("h-8", titleWidth)} />
      <Skeleton className={cn("mt-1 h-5", subWidth)} />
    </div>
  )
}

/** The "← Back to X" link on the two detail pages. */
export function BackLink({ width = "w-28" }) {
  return (
    <div className="flex w-fit items-center gap-1.5">
      <Skeleton className="h-4 w-4" />
      <Skeleton className={cn("h-5", width)} />
    </div>
  )
}

/** TabsList: h-8 pill, bg-muted, 3px inset — planner and profile. */
export function TabsListSkeleton({ widths = ["w-24", "w-24"] }) {
  return (
    <div className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg bg-muted p-[3px]">
      {widths.map((width, i) => (
        <Skeleton key={i} className={cn("h-[calc(100%-1px)] rounded-md", width)} />
      ))}
    </div>
  )
}

/* ─── cards ────────────────────────────────────────────────────────────── */

/**
 * The label + icon + big-number cards on /dashboard and /logs.
 *
 * `withSub` because dashboard cards carry a second line
 * (CardContent flex flex-col gap-0.5) and logs cards do not.
 *
 * The odd-looking `flex-row` on CardHeader is copied from the real pages on
 * purpose: CardHeader's base is `grid auto-rows-min`, and tailwind-merge files
 * `flex-row` under flex-direction rather than display, so grid wins and the
 * label sits *above* the icon. Reproducing the layout means reproducing that.
 */
export function StatCardGrid({
  count = 2,
  gridClassName = "grid gap-4 sm:grid-cols-2",
  withSub = true,
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent className={withSub ? "flex flex-col gap-0.5" : undefined}>
            <Skeleton className="h-8 w-16" />
            {withSub && <Skeleton className="h-4 w-24" />}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Fixed fill widths so a stack of bars reads as data, not as a block. */
const BAR_FILLS = ["w-4/5", "w-3/5", "w-1/2", "w-2/5", "w-1/3", "w-1/4", "w-1/6"]

/**
 * The label · bar · number rows inside the two /analytics breakdown cards.
 * Renders its own CardContent, since both real cards use the same one.
 */
export function BarRowsContent({
  rows = 5,
  labelWidth = "w-20",
  barClassName = "h-6 rounded-lg",
  valueWidth = "w-8",
}) {
  return (
    <CardContent className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className={cn("h-4 shrink-0", labelWidth)} />
          {/* bg-muted track is the real thing, not a placeholder — only the
              fill inside it pulses */}
          <div className={cn("flex-1 overflow-hidden bg-muted", barClassName)}>
            <Skeleton className={cn("h-full", BAR_FILLS[i % BAR_FILLS.length])} />
          </div>
          <Skeleton className={cn("h-4 shrink-0", valueWidth)} />
        </div>
      ))}
    </CardContent>
  )
}

/**
 * The icon + label + value card used ~23× on /contacts/[id] and twice on
 * /companies/[id]. `wide` mirrors the field list's own `wide` flag.
 */
export function FieldCardSkeleton({ wide = false, valueLines = 1 }) {
  return (
    <Card className={wide ? "col-span-full" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {Array.from({ length: valueLines }, (_, i) => (
          <Skeleton
            key={i}
            className={cn("h-5", i === valueLines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </CardContent>
    </Card>
  )
}

/* ─── threads ──────────────────────────────────────────────────────────── */

/**
 * ContactTimeline and CompanyNotesSection: heading row, avatar + text entries
 * separated by rules, then the composer.
 */
export function ThreadSkeleton({
  titleWidth = "w-20",
  entries = 3,
  entryGapClassName = "gap-4",
  showMetaIcon = false,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className={cn("h-5", titleWidth)} />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
      </div>

      <div className={cn("flex flex-col", entryGapClassName)}>
        {Array.from({ length: entries }, (_, i) => (
          <div key={i}>
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-full shrink-0 bg-border",
                  entryGapClassName === "gap-3" ? "mb-3" : "mb-4"
                )}
              />
            )}
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  {showMetaIcon && <Skeleton className="h-3 w-3" />}
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      {/* Textarea rows={3} + the right-aligned submit */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="flex justify-end">
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/* ─── tables ───────────────────────────────────────────────────────────── */

/**
 * Plain-<table> stand-in for src/components/ui/table.jsx, which is a client
 * component. Base classes below are copied from it verbatim, so row pitch
 * matches; per-table density rides in on `headClassName` / `rowClassName`
 * (`[&>th]:h-8`, `[&>td]:py-1`, `align-top [&>td]:pt-3`).
 *
 * @param columns {Array<{width?: string, lines?: 1|2, cellClassName?: string, barWidth?: string}>}
 */
export function TableSkeleton({ columns, rows = 10, headClassName = "", rowClassName = "" }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b">
          <tr className={cn("border-b", headClassName)}>
            {columns.map((column, i) => (
              <th
                key={i}
                className={cn(
                  "h-10 px-2 text-left align-middle font-medium whitespace-nowrap",
                  column.width
                )}
              >
                <Skeleton className="h-3 w-14" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className={cn("border-b", rowClassName)}>
              {columns.map((column, i) => (
                <td
                  key={i}
                  className={cn("p-2 align-middle whitespace-nowrap", column.cellClassName)}
                >
                  {column.lines === 2 ? (
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ) : (
                    <Skeleton className={cn("h-3", column.barWidth ?? "w-20")} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
