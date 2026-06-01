"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FilterIcon,
  SearchIcon,
  DownloadIcon,
  XIcon,
} from "lucide-react"
import { bulkUpdateStatus } from "@/app/(app)/data/actions"

/* ─── helpers ─────────────────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function sourcePath(url) {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, "") || "/"
    return u.hostname.replace("www.", "") + path
  } catch {
    return url || "—"
  }
}

function truncate(str, n = 20) {
  if (!str) return "—"
  return str.length > n ? str.slice(0, n) + "…" : str
}

const STATUS_COLORS = {
  New:       "secondary",
  Contacted: "outline",
  Closed:    "destructive",
}

const STATUS_OPTIONS = ["New", "follow-up", "win", "closed", "rejected", "fake"]

/* ─── sort ─────────────────────────────────────────────────────────────── */

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

function SortableHead({ label, col, sort, onSort, className = "" }) {
  const active = sort.col === col
  const Icon = active
    ? sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon
    : ChevronsUpDownIcon
  return (
    <TableHead
      className={`sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-background ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  )
}

/* ─── main component ───────────────────────────────────────────────────── */

export function DataPageClient({ contacts }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sort, setSort] = useState({ col: "created_at", dir: "desc" })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState("")
  const [isPending, startTransition] = useTransition()

  function toggleSort(col) {
    setSort((prev) =>
      prev.col === col
        ? prev.dir === "asc" ? { col, dir: "desc" } : { col: null, dir: "asc" }
        : { col, dir: "asc" }
    )
  }

  const statuses = useMemo(
    () => [...new Set(contacts.map((r) => r.status).filter(Boolean))],
    [contacts]
  )

  const sources = useMemo(
    () => [...new Set(contacts.map((r) => sourcePath(r.source_url)).filter(Boolean))],
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

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)))
    }
  }

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleExport(idsToExport) {
    const url = idsToExport?.length
      ? `/api/contacts/export?ids=${idsToExport.join(",")}`
      : "/api/contacts/export"
    window.location.href = url
  }

  function handleBulkStatus() {
    if (!bulkStatus || !selectedIds.size) return
    const ids = [...selectedIds]
    startTransition(async () => {
      await bulkUpdateStatus(ids, bulkStatus)
      setSelectedIds(new Set())
      setBulkStatus("")
      router.refresh()
    })
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "260px" }}>
      {/* Filter sidebar */}
      <Sidebar collapsible="none" className="border-r">
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {(statusFilter !== "all" || sourceFilter !== "all") && (
              <button
                onClick={() => { setStatusFilter("all"); setSourceFilter("all") }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Status filter */}
          <SidebarGroup>
            <SidebarGroupLabel>Status</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                    <span>All</span>
                    <span className="ml-auto text-xs text-muted-foreground">{contacts.length}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {statuses.map((s) => (
                  <SidebarMenuItem key={s}>
                    <SidebarMenuButton isActive={statusFilter === s} onClick={() => setStatusFilter(s)}>
                      <span>{s}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {contacts.filter((r) => r.status === s).length}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator />

          {/* Source filter */}
          <SidebarGroup>
            <SidebarGroupLabel>Source</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>
                    <span>All</span>
                    <span className="ml-auto text-xs text-muted-foreground">{contacts.length}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {sources.map((s) => (
                  <SidebarMenuItem key={s}>
                    <SidebarMenuButton
                      isActive={sourceFilter === s}
                      onClick={() => setSourceFilter(s)}
                      className="h-auto py-1.5"
                    >
                      <span className="truncate text-xs leading-snug">{s}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {contacts.filter((r) => sourcePath(r.source_url) === s).length}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Main content */}
      <SidebarInset>
        {/* Sticky header */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium">Contacts</span>
            <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
          </div>

          {/* Active filter badges */}
          {(statusFilter !== "all" || sourceFilter !== "all") && (
            <div className="flex items-center gap-1.5">
              {statusFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1">
                  {statusFilter}
                  <button onClick={() => setStatusFilter("all")} className="hover:text-destructive leading-none">×</button>
                </Badge>
              )}
              {sourceFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1 max-w-[180px]">
                  <span className="truncate">{sourceFilter}</span>
                  <button onClick={() => setSourceFilter("all")} className="hover:text-destructive leading-none shrink-0">×</button>
                </Badge>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Export all */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleExport(null)}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Export CSV
            </Button>

            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-56 text-xs"
              />
            </div>
          </div>
        </header>

        {/* Table */}
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-10 bg-background w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border cursor-pointer"
                  />
                </TableHead>
                <SortableHead label="ID"           col="id"         sort={sort} onSort={toggleSort} className="w-12" />
                <SortableHead label="Name / Email" col="name"       sort={sort} onSort={toggleSort} />
                <SortableHead label="Phone"        col="phone"      sort={sort} onSort={toggleSort} />
                <SortableHead label="Company"      col="company"    sort={sort} onSort={toggleSort} />
                <SortableHead label="Source"       col="source_url" sort={sort} onSort={toggleSort} />
                <SortableHead label="Needs"        col="needs"      sort={sort} onSort={toggleSort} />
                <SortableHead label="Status"       col="status"     sort={sort} onSort={toggleSort} />
                <SortableHead label="Date"         col="created_at" sort={sort} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No records match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-selected={selectedIds.has(row.id) || undefined}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 rounded border-border cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs" onClick={() => router.push(`/contacts/${row.id}`)}>{row.id}</TableCell>
                    <TableCell onClick={() => router.push(`/contacts/${row.id}`)}>
                      <div className="font-medium whitespace-nowrap">{row.name || "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.email || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap" onClick={() => router.push(`/contacts/${row.id}`)}>{row.phone || "—"}</TableCell>
                    <TableCell className="text-xs" onClick={() => router.push(`/contacts/${row.id}`)}>{truncate(row.company) || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" onClick={() => router.push(`/contacts/${row.id}`)}>{sourcePath(row.source_url)}</TableCell>
                    <TableCell className="text-xs" onClick={() => router.push(`/contacts/${row.id}`)}>
                      {Array.isArray(row.needs) && row.needs.length > 0 ? row.needs.join(", ") : "—"}
                    </TableCell>
                    <TableCell onClick={() => router.push(`/contacts/${row.id}`)}>
                      <Badge variant={STATUS_COLORS[row.status] ?? "outline"} className="text-xs">
                        {row.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" onClick={() => router.push(`/contacts/${row.id}`)}>
                      {formatDate(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-background shadow-lg px-4 py-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Separator orientation="vertical" className="h-4" />

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleExport([...selectedIds])}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Export
            </Button>

            <div className="flex items-center gap-1.5">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Set status…" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="text-xs"
                onClick={handleBulkStatus}
                disabled={!bulkStatus || isPending}
              >
                {isPending ? "Updating…" : "Apply"}
              </Button>
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
