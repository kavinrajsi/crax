"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchIcon, ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react"

/* ─── helpers ─────────────────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function domain(url) {
  try { return new URL(url).hostname.replace("www.", "") }
  catch { return url || "—" }
}

function truncate(str, n = 20) {
  if (!str) return "—"
  return str.length > n ? str.slice(0, n) + "…" : str
}

const statusColors = {
  New: "secondary",
  Contacted: "outline",
  Closed: "destructive",
}

const actionColors = {
  login:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  view_list:   "bg-muted text-muted-foreground",
  view_detail: "bg-muted text-muted-foreground",
  create:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  delete:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

/* ─── sort helpers ─────────────────────────────────────────────────────── */

function getValue(row, key) {
  const v = row[key]
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.getTime()
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

function useSort() {
  const [sort, setSort] = useState({ col: null, dir: "asc" })
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
  const Icon = active ? (sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon) : ChevronsUpDownIcon
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  )
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

function sourcePath(url) {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, "") || "/"
    return u.hostname.replace("www.", "") + path
  } catch {
    return url || "—"
  }
}

/* ─── ContactsTable ────────────────────────────────────────────────────── */

export function ContactsTable({ contacts }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const { sort, toggle } = useSort()

  const statuses = useMemo(
    () => ["all", ...new Set(contacts.map((r) => r.status).filter(Boolean))],
    [contacts]
  )

  const sources = useMemo(
    () => ["all", ...new Set(contacts.map((r) => sourcePath(r.source_url)).filter(Boolean))],
    [contacts]
  )

  const rows = useMemo(() => {
    let filtered = contacts
    if (statusFilter !== "all") filtered = filtered.filter((r) => r.status === statusFilter)
    if (sourceFilter !== "all") filtered = filtered.filter((r) => sourcePath(r.source_url) === sourceFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.company?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
      )
    }
    return sortRows(filtered, sort.col, sort.dir)
  }, [contacts, statusFilter, sourceFilter, search, sort])

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Contact Submissions</CardTitle>
            <CardDescription>{rows.length} of {contacts.length} records</CardDescription>
          </div>

          {/* Filters + Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.filter((s) => s !== "all").map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                    <span className="ml-1.5 text-muted-foreground text-[11px]">
                      ({contacts.filter((r) => r.status === s).length})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source */}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.filter((s) => s !== "all").map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="truncate max-w-[200px] block">{s}</span>
                    <span className="ml-1.5 text-muted-foreground text-[11px]">
                      ({contacts.filter((r) => sourcePath(r.source_url) === s).length})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 text-xs"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="ID"      col="id"         sort={sort} onSort={toggle} className="w-12" />
                <SortableHead label="Name"    col="name"       sort={sort} onSort={toggle} />
                <SortableHead label="Email"   col="email"      sort={sort} onSort={toggle} />
                <SortableHead label="Phone"   col="phone"      sort={sort} onSort={toggle} />
                <SortableHead label="Company" col="company"    sort={sort} onSort={toggle} />
                <SortableHead label="Source"  col="source_url" sort={sort} onSort={toggle} />
                <SortableHead label="Needs"   col="needs"      sort={sort} onSort={toggle} />
                <SortableHead label="Status"  col="status"     sort={sort} onSort={toggle} />
                <SortableHead label="Date"    col="created_at" sort={sort} onSort={toggle} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground text-xs">{row.id}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{row.name || "—"}</TableCell>
                    <TableCell className="text-xs">{row.email || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{truncate(row.company) || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{domain(row.source_url)}</TableCell>
                    <TableCell className="text-xs">
                      {Array.isArray(row.needs) && row.needs.length > 0 ? row.needs.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[row.status] ?? "outline"} className="text-xs">
                        {row.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── AuditLogsTable ───────────────────────────────────────────────────── */

function AuditLogsTable({ auditLogs }) {
  const [search, setSearch] = useState("")
  const { sort, toggle } = useSort()

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? auditLogs.filter(
          (r) =>
            r.actor_email?.toLowerCase().includes(q) ||
            r.action?.toLowerCase().includes(q) ||
            r.target_table?.toLowerCase().includes(q)
        )
      : auditLogs
    return sortRows(filtered, sort.col, sort.dir)
  }, [auditLogs, search, sort])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>{rows.length} of {auditLogs.length} events</CardDescription>
          </div>
          <div className="relative w-56">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actor, action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="ID"       col="id"           sort={sort} onSort={toggle} className="w-12" />
                <SortableHead label="Action"   col="action"       sort={sort} onSort={toggle} />
                <SortableHead label="Actor"    col="actor_email"  sort={sort} onSort={toggle} />
                <SortableHead label="Table"    col="target_table" sort={sort} onSort={toggle} />
                <SortableHead label="Target ID" col="target_id"   sort={sort} onSort={toggle} />
                <SortableHead label="IP"       col="ip_address"   sort={sort} onSort={toggle} />
                <SortableHead label="Date"     col="created_at"   sort={sort} onSort={toggle} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground text-xs">{row.id}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${actionColors[row.action] ?? "bg-muted text-muted-foreground"}`}>
                        {row.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{row.actor_email || "—"}</TableCell>
                    <TableCell className="text-xs">{row.target_table || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.target_id || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.ip_address || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── DataTables ───────────────────────────────────────────────────────── */

export function DataTables({ contacts, auditLogs }) {
  return (
    <Tabs defaultValue="contacts">
      <TabsList>
        <TabsTrigger value="contacts">
          Contact Submissions
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {contacts.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="audit">
          Audit Logs
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {auditLogs.length}
          </span>
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <TabsContent value="contacts">
          <ContactsTable contacts={contacts} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogsTable auditLogs={auditLogs} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
