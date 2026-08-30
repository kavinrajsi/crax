"use client"

import { useState, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  SearchIcon,
  AlarmClockIcon,
} from "lucide-react"
import { sortRows, formatDate, truncate } from "@/lib/table-utils"
import { SortableHead } from "@/components/sortable-head"
import { needsAttention, daysSinceTouch } from "@/lib/follow-up"
import { ContactDetailSheet } from "@/components/contact-detail-sheet"
import { CsvExportDialog } from "@/components/csv-export-dialog"
import { statusMeta } from "@/lib/contact-statuses"

/* The badge previously keyed a variant map on New / Contacted / Closed. Only
   "New" ever matched: "Contacted" is not a status this app has, and the real
   key is lowercase "closed", so six of the seven statuses fell through to the
   same outline badge and the two dead entries were unreachable. Colour now
   comes from src/lib/contact-statuses.js, the same source the select and the
   pipeline read, so a new status cannot arrive without one. */

/** Age since the last note, red once the lead is stale. */
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

export function DataPageClient({ contacts, companies, contactTags }) {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ column: "created_at", direction: "desc" })
  // Seeded from ?attention=1 so the dashboard card deep-links into this view.
  const [onlyStale, setOnlyStale] = useState(searchParams.get("attention") === "1")
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

  // id + name/email + phone/company + status + source + date + last touch
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
              title="Open leads nobody has left a note on"
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

            {/* Export — opens the filter/column dialog. Leaving it untouched
                exports everything, which is what this button used to do. */}
            <CsvExportDialog contacts={contacts} contactTags={contactTags} />

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
                <SortableHead label="ID"           column="id"         sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background w-12" />
                <SortableHead label="Name / Email"   column="name"       sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Phone / Company" column="phone"     sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Status"       column="status"     sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Source"       column="source_domain" sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Date"         column="created_at" sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
                <SortableHead label="Last touch"   column="last_touch" sort={sort} onSort={toggleSort} className="sticky top-0 z-10 bg-background" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-12 text-sm">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50 [&>td]:py-1"
                    onClick={(event) => handleRowClick(event, row.id)}
                  >
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
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{
                          backgroundColor: `${statusMeta(row.status).color}18`,
                          color: statusMeta(row.status).color,
                          borderColor: `${statusMeta(row.status).color}40`,
                        }}
                      >
                        {row.status ? statusMeta(row.status).label : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.source_domain || "—"}
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
