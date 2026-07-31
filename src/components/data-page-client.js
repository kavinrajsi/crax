"use client"

import { useState, useMemo, useRef, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  SearchIcon,
  DownloadIcon,
  XIcon,
  AlarmClockIcon,
} from "lucide-react"
import { bulkUpdateStatus } from "@/app/(app)/data/actions"
import { sortRows, formatDate, truncate } from "@/lib/table-utils"
import { SortableHead } from "@/components/sortable-head"
import { needsAttention, daysSinceTouch } from "@/lib/follow-up"
import { ContactDetailSheet } from "@/components/contact-detail-sheet"

const STATUS_COLORS = {
  New:       "secondary",
  Contacted: "outline",
  Closed:    "destructive",
}

const STATUS_OPTIONS = ["New", "follow-up", "win", "closed", "rejected", "fake", "test"]

/** Age since the last note or activity, red once the lead is stale. */
function LastTouchCell({ row }) {
  const days = daysSinceTouch(row)
  if (days == null) return <span className="text-muted-foreground">—</span>
  const stale = needsAttention(row)
  const label = days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`
  return (
    <span className={stale ? "text-destructive font-medium" : "text-muted-foreground"}>
      {label}
    </span>
  )
}

/* ─── main component ───────────────────────────────────────────────────── */

export function DataPageClient({ contacts, companies }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ column: "created_at", direction: "desc" })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState("")
  // Seeded from ?attention=1 so the dashboard card deep-links into this view.
  const [bulkError, setBulkError] = useState(null)
  const [onlyStale, setOnlyStale] = useState(searchParams.get("attention") === "1")
  const [isPending, startTransition] = useTransition()
  const rowLinkRef = useRef(null)

  /* Drawer open state lives in the URL, but written with the native History API
     rather than router.push: /data is force-dynamic, so a push would re-run the
     whole SELECT server-side just to carry a query param page.js never reads.
     Next integrates history.pushState with useSearchParams, so this still
     re-renders and Back still works — with zero server traffic. */
  const contactParam = searchParams.get("contact")
  const openContactId = contactParam ? Number(contactParam) : null

  function setOpenContactId(contactId) {
    const nextParams = new URLSearchParams(searchParams.toString())
    if (contactId == null) nextParams.delete("contact")
    else nextParams.set("contact", String(contactId))
    const queryString = nextParams.toString()
    const url = queryString ? `?${queryString}` : "/data"
    // Asymmetric on purpose: if closing also pushed, Back would land on
    // ?contact=<id> and re-open the drawer.
    if (contactId == null) window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
  }

  // Look up from `contacts`, not `rows`, so filtering doesn't close the drawer,
  // and so an RSC refresh (revalidatePath) hands the sheet fresh values.
  const openContact =
    openContactId == null
      ? null
      : contacts.find((contact) => contact.id === openContactId) ?? null

  function handleRowLinkClick(event, contactId) {
    // The anchor owns both paths — letting this bubble to the row would open
    // the drawer on top of a cmd-click that already spawned a new tab.
    event.stopPropagation()
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    rowLinkRef.current = event.currentTarget
    setOpenContactId(contactId)
  }

  function handleRowClick(event, contactId) {
    rowLinkRef.current = event.currentTarget.querySelector("a[data-row-link]")
    setOpenContactId(contactId)
  }

  // checkbox + id + name/email + phone/company + status + date + last touch
  const columnCount = 7


  function toggleSort(column) {
    setSort((prevSort) =>
      prevSort.column === column
        ? prevSort.direction === "asc"
          ? { column, direction: "desc" }
          : { column: null, direction: "asc" }
        : { column, direction: "asc" }
    )
  }

  const staleCount = useMemo(() => contacts.filter(needsAttention).length, [contacts])

  const rows = useMemo(() => {
    let filtered = contacts
    if (onlyStale) filtered = filtered.filter(needsAttention)
    if (search) {
      const query = search.toLowerCase()
      filtered = filtered.filter(
        (contact) =>
          contact.name?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query) ||
          contact.phone?.includes(query)
      )
    }
    return sortRows(filtered, sort.column, sort.direction)
  }, [contacts, search, sort, onlyStale])

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id))

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((row) => row.id)))
    }
  }

  function toggleRow(contactId) {
    setSelectedIds((prevSelected) => {
      const nextSelected = new Set(prevSelected)
      nextSelected.has(contactId) ? nextSelected.delete(contactId) : nextSelected.add(contactId)
      return nextSelected
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
    setBulkError(null)
    startTransition(async () => {
      try {
        await bulkUpdateStatus(ids, bulkStatus)
        setSelectedIds(new Set())
        setBulkStatus("")
        router.refresh()
      } catch (error) {
        // The selection is kept so the user can retry rather than having to
        // re-tick every row. Previously the failure cleared it silently.
        console.error("[data] bulkUpdateStatus failed", { count: ids.length, error })
        setBulkError(`Couldn't update ${ids.length} contact${ids.length === 1 ? "" : "s"}.`)
      }
    })
  }

  return (
    <div className="flex flex-col w-full">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium">Contacts</span>
            <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">

            {/* Needs attention */}
            <Button
              variant={onlyStale ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setOnlyStale((v) => !v)}
              aria-pressed={onlyStale}
              title="Open leads nobody has left a note or activity on"
              disabled={staleCount === 0 && !onlyStale}
            >
              <AlarmClockIcon className="h-3.5 w-3.5" />
              Needs attention
              <Badge
                variant={onlyStale ? "secondary" : "outline"}
                className="text-[10px] px-1.5 py-0 tabular-nums"
              >
                {staleCount}
              </Badge>
            </Button>

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
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8 h-8 w-56 text-xs"
              />
            </div>
          </div>
        </header>

        {/* Table */}
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:h-8 [&>th]:text-xs">
                <TableHead className="sticky top-0 z-10 bg-background w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border cursor-pointer"
                  />
                </TableHead>
                <SortableHead label="ID"           column="id"         sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background w-12" />
                <SortableHead label="Name / Email"   column="name"       sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Phone / Company" column="phone"     sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Status"       column="status"     sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Date"         column="created_at" sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Last touch"   column="last_touch" sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-12">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50 [&>td]:py-1"
                    data-selected={selectedIds.has(row.id) || undefined}
                    onClick={(event) => handleRowClick(event, row.id)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 rounded border-border cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.id}</TableCell>
                    <TableCell>
                      {/* Plain <a>, not next/link — Link would prefetch every visible
                          row's detail page for what is now the exception path. It is
                          also the whole keyboard story (focusable, Enter opens) and
                          makes cmd-click open the full page in a new tab. */}
                      <a
                        href={`/contacts/${row.id}`}
                        data-row-link=""
                        onClick={(event) => handleRowLinkClick(event, row.id)}
                        className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="whitespace-nowrap text-xs leading-tight">
                          <div className="font-medium">{row.name || "—"}</div>
                          <div className="text-muted-foreground">{row.email || "—"}</div>
                        </div>
                      </a>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="whitespace-nowrap leading-tight">
                        <div>{row.phone || "—"}</div>
                        <div className="text-muted-foreground">{truncate(row.company)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_COLORS[row.status] ?? "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {row.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.created_at, { compact: true })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <LastTouchCell row={row} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Bulk action bar — hidden while the drawer is up; it is fixed z-50 like
            the sheet, so it would sit blurred under the overlay and focus-trapped away. */}
        {selectedIds.size > 0 && openContactId == null && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-background shadow-lg px-4 py-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            {bulkError && <span className="text-xs text-destructive">{bulkError}</span>}
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
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
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

        {/* Gate on the row, not the id: a pasted ?contact=<deleted id> would
            otherwise mount an empty overlay. */}
        <ContactDetailSheet
          contact={openContact}
          companies={companies}
          open={openContact != null}
          onOpenChange={(nextOpen) => { if (!nextOpen) setOpenContactId(null) }}
          finalFocusRef={rowLinkRef}
        />
    </div>
  )
}
