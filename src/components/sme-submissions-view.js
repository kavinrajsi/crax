"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchIcon } from "lucide-react"
import { sortRows, formatDate, timeAgo, sourceDomain } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"
import { JsonViewer } from "@/components/json-viewer"

const TYPE_STYLES = {
  quiz:           "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  strategy_call:  "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
  demo_call:      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
}

const TYPE_LABELS = {
  quiz: "Quiz",
  strategy_call: "Strategy Call",
  demo_call: "Demo Call",
}

/** @param {object[]} submissions  unbounded — sme_submissions is small (backfilled history) */
export function SmeSubmissionsView({ submissions }) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const { sort, toggleSort } = useSort({ column: "created_at", direction: "desc" })

  const presentTypes = useMemo(
    () => ["all", ...new Set(submissions.map((r) => r.type))],
    [submissions]
  )

  const rows = useMemo(() => {
    let filtered = submissions
    if (typeFilter !== "all") filtered = filtered.filter((r) => r.type === typeFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          String(r.id).includes(q)
      )
    }
    return sortRows(filtered, sort.column, sort.direction)
  }, [submissions, typeFilter, search, sort])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>Showing {rows.length} of {submissions.length} records</CardDescription>
          </div>
          <div className="relative w-full sm:w-60">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {presentTypes.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              size="xs"
              onClick={() => setTypeFilter(type)}
              className="h-6 px-2 text-xs"
            >
              {type === "all" ? "all" : TYPE_LABELS[type] ?? type}
              <span className="ml-1 text-[10px] opacity-70">
                {type === "all" ? submissions.length : submissions.filter((r) => r.type === type).length}
              </span>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="ID"        column="id"         sort={sort} onSort={toggleSort} className="sticky top-0 bg-card w-12" />
                <SortableHead label="Timestamp" column="created_at" sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Type"      column="type"       sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Name"      column="name"       sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Email"     column="email"      sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Phone"     column="phone"      sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Source"    column="source_url" sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Details"   column="details"    sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                    No submissions match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="text-muted-foreground text-xs pt-3">{row.id}</TableCell>

                    <TableCell className="text-xs pt-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">{formatDate(row.created_at)}</div>
                      <div className="text-muted-foreground mt-0.5">{timeAgo(row.created_at)}</div>
                    </TableCell>

                    <TableCell className="pt-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[row.type] ?? TYPE_STYLES.quiz}`}>
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs pt-3">{row.name || "—"}</TableCell>
                    <TableCell className="text-xs pt-3">{row.email || "—"}</TableCell>
                    <TableCell className="text-xs pt-3 whitespace-nowrap">{row.phone || "—"}</TableCell>

                    <TableCell className="text-xs text-muted-foreground pt-3 whitespace-nowrap">
                      {sourceDomain(row.source_url)}
                    </TableCell>

                    <TableCell className="pt-3"><JsonViewer className="max-w-[200px]" data={row.details} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
