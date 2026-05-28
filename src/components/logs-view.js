"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from "lucide-react"

/* ─── helpers ─────────────────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function timeAgo(iso) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function shortUA(ua) {
  if (!ua) return "—"
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)
  const os = ua.match(/\(([^)]+)\)/)
  const b = browser ? browser[0] : "Unknown"
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

function getValue(row, key) {
  const v = row[key]
  if (v === null || v === undefined) return ""
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).getTime()
  return typeof v === "string" ? v.toLowerCase() : v
}

function sortRows(rows, col, dir) {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = getValue(a, col)
    const bv = getValue(b, col)
    if (av < bv) return dir === "asc" ? -1 : 1
    if (av > bv) return dir === "asc" ? 1 : -1
    return 0
  })
}

function useSort(defaultCol = "created_at", defaultDir = "desc") {
  const [sort, setSort] = useState({ col: defaultCol, dir: defaultDir })
  function toggle(col) {
    setSort((prev) =>
      prev.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : { col: null, dir: "asc" }
        : { col, dir: "asc" }
    )
  }
  return { sort, toggle }
}

/* ─── SortableHead ─────────────────────────────────────────────────────── */

function SortableHead({ label, col, sort, onSort, className = "" }) {
  const active = sort.col === col
  const Icon = active
    ? sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon
    : ChevronsUpDownIcon
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap sticky top-0 bg-card ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  )
}

/* ─── JsonCell ─────────────────────────────────────────────────────────── */

function JsonCell({ data }) {
  const [open, setOpen] = useState(false)
  if (!data) return <span className="text-muted-foreground text-xs">—</span>
  const preview = JSON.stringify(data)
  const short = preview.length > 30 ? preview.slice(0, 30) + "…" : preview
  return (
    <div className="max-w-[200px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDownIcon className="h-3 w-3 shrink-0" /> : <ChevronRightIcon className="h-3 w-3 shrink-0" />}
        <span className="font-mono truncate">{short}</span>
      </button>
      {open && (
        <pre className="mt-1 rounded bg-muted p-2 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all max-w-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ─── LogsView ─────────────────────────────────────────────────────────── */

export function LogsView({ logs }) {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const { sort, toggle } = useSort("created_at", "desc")

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
    return sortRows(filtered, sort.col, sort.dir)
  }, [logs, actionFilter, search, sort])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              Showing {rows.length} of {logs.length} records
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
                <SortableHead label="ID"         col="id"           sort={sort} onSort={toggle} className="w-12" />
                <SortableHead label="Timestamp"  col="created_at"   sort={sort} onSort={toggle} />
                <SortableHead label="Action"     col="action"       sort={sort} onSort={toggle} />
                <SortableHead label="Actor"      col="actor_email"  sort={sort} onSort={toggle} />
                <SortableHead label="Target"     col="target_table" sort={sort} onSort={toggle} />
                <SortableHead label="After"      col="after"        sort={sort} onSort={toggle} />
                <SortableHead label="IP"         col="ip_address"   sort={sort} onSort={toggle} />
                <SortableHead label="Browser/OS" col="user_agent"   sort={sort} onSort={toggle} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    No events match your filters.
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

                    <TableCell className="pt-3"><JsonCell data={row.after} /></TableCell>

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
