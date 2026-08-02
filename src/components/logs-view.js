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
import {
  SearchIcon,
} from "lucide-react"
import { sortRows, formatDate, timeAgo } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"
import { JsonViewer } from "@/components/json-viewer"

/* ─── helpers ─────────────────────────────────────────────────────────── */



/**
 * Non-browser clients are named, not flattened to "Unknown".
 *
 * 3 of the 4 rows in audit_logs store the literal user agent "node" — what
 * `fetch` sends by default — because they are script sign-ins from smoke runs,
 * one of them from ::1 against the production database. Rendering those as
 * "Unknown" made machine traffic indistinguishable from a person on an
 * unrecognised browser, in a table whose entire job is answering "who did
 * this?".
 */
function shortUA(ua) {
  if (!ua) return "—"
  if (/^node(\/|$)/i.test(ua)) return "Script · node"
  if (/^(curl|wget|python-requests|axios|got|postman)/i.test(ua)) {
    return `Script · ${ua.split("/")[0].toLowerCase()}`
  }
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)
  const os = ua.match(/\(([^)]+)\)/)
  const b = browser ? browser[0] : "Unrecognised client"
  const o = os ? os[1].split(";")[0].trim() : ""
  return o ? `${b} · ${o}` : b
}

const ACTION_STYLES = {
  login:       "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  view_list:   "bg-muted text-muted-foreground border border-border",
  view_detail: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
  create:      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  update:      "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  delete:      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
}

/* ─── sort helpers ─────────────────────────────────────────────────────── */




/* ─── SortableHead ─────────────────────────────────────────────────────── */



/* ─── LogsView ─────────────────────────────────────────────────────────── */

/**
 * @param {object[]} logs   the most recent page of events, already bounded by
 *                          the server — filtering and sorting here apply to
 *                          this page only
 * @param {number} [total]  events in the whole table, so the caption cannot
 *                          claim to be showing everything when it is not
 */
export function LogsView({ logs, total }) {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const { sort, toggleSort } = useSort({ column: "created_at", direction: "desc" })

  const presentActions = useMemo(
    () => ["all", ...new Set(logs.map((r) => r.action))],
    [logs]
  )

  const rows = useMemo(() => {
    let filtered = logs
    if (actionFilter !== "all") filtered = filtered.filter((r) => r.action === actionFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.actor_email?.toLowerCase().includes(q) ||
          r.action?.toLowerCase().includes(q) ||
          r.target_table?.toLowerCase().includes(q) ||
          String(r.target_id ?? "").includes(q) ||
          String(r.id).includes(q)
      )
    }
    return sortRows(filtered, sort.column, sort.direction)
  }, [logs, actionFilter, search, sort])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              {total > logs.length
                ? `Showing ${rows.length} of the most recent ${logs.length} — ${total} events in total`
                : `Showing ${rows.length} of ${logs.length} records`}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-60">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actor, action, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Action filter chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presentActions.map((action) => (
            <Button
              key={action}
              variant={actionFilter === action ? "default" : "outline"}
              size="xs"
              onClick={() => setActionFilter(action)}
              className="h-6 px-2 text-xs"
            >
              {action}
              <span className="ml-1 text-[10px] opacity-70">
                {action === "all" ? logs.length : logs.filter((r) => r.action === action).length}
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
                <SortableHead label="ID"         column="id"           sort={sort} onSort={toggleSort} className="sticky top-0 bg-card w-12" />
                <SortableHead label="Timestamp"  column="created_at"   sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Action"     column="action"       sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Actor"      column="actor_email"  sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Target"     column="target_table" sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="After"      column="after"        sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="IP"         column="ip_address"   sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
                <SortableHead label="Browser/OS" column="user_agent"   sort={sort} onSort={toggleSort} className="sticky top-0 bg-card" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                    No events match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="text-muted-foreground text-xs pt-3">{row.id}</TableCell>

                    <TableCell className="text-xs pt-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">{formatDate(row.created_at, { seconds: true })}</div>
                      <div className="text-muted-foreground mt-0.5">{timeAgo(row.created_at)}</div>
                    </TableCell>

                    <TableCell className="pt-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[row.action] ?? ACTION_STYLES.view_list}`}>
                        {row.action}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs pt-3">
                      <div className="font-medium">{row.actor_email || "—"}</div>
                      {row.actor_user_id && (
                        <div className="text-muted-foreground font-mono text-[10px] mt-0.5">
                          {row.actor_user_id.slice(0, 8)}…
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs pt-3">
                      {row.target_table ? (
                        <span className="font-medium">{row.target_table}
                          {row.target_id && <span className="text-muted-foreground ml-1">#{row.target_id}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="pt-3"><JsonViewer className="max-w-[200px]" data={row.after} /></TableCell>

                    <TableCell className="text-xs text-muted-foreground pt-3 whitespace-nowrap">
                      {row.ip_address || "—"}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground pt-3 max-w-[180px]">
                      <span className="block truncate">{shortUA(row.user_agent)}</span>
                    </TableCell>
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
