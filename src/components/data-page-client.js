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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlarmClockIcon, CalendarIcon } from "lucide-react"
import { sortRows, formatDate, truncate } from "@/lib/table-utils"
import { SortableHead } from "@/components/sortable-head"
import { needsAttention, daysSinceTouch } from "@/lib/follow-up"
import { ContactDetailSheet } from "@/components/contact-detail-sheet"
import { CsvExportDialog } from "@/components/csv-export-dialog"
import { CsvImportDialog } from "@/components/csv-import-dialog"
import { AddContactDialog } from "@/components/add-contact-dialog"
import { DesktopTable, EmptyState, FilterSearch, MobileList } from "@/components/page"
import { ListCard } from "@/components/list-card"
import { useStages, useStatusMeta } from "@/components/stage-context"
import {
  ALL,
  DATE_PRESETS,
  matchesFilters,
  presetRange,
  tally,
  todayIst,
} from "@/lib/contact-filters"

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

/* Custom range bounds stop at today (IST). A typed future date is clamped
   rather than kept, so the table can never filter to days that do not exist yet. */
function clampToToday(value) {
  return value && value > todayIst() ? todayIst() : value
}

/* The Source select cannot hold "" as an item value — "" is the real "(none)"
   bucket (source_url defaults to ''), so it is mapped to this sentinel in the
   UI and back to "" in state. */
const SOURCE_NONE = "__none__"

/* ─── main component ───────────────────────────────────────────────────── */

export function DataPageClient({ contacts, companies, contactTags, sources }) {
  const statusMeta = useStatusMeta()
  const stages = useStages()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ column: "created_at", direction: "desc" })
  // Seeded from ?attention=1 so the dashboard card deep-links into this view.
  const [onlyStale, setOnlyStale] = useState(searchParams.get("attention") === "1")
  const [status, setStatus] = useState(ALL)
  const [source, setSource] = useState(ALL)
  const [datePreset, setDatePreset] = useState(ALL)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
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

  /* Source options come from source_domain, derived in SQL by data/page.js.
     Nulls are dropped; "" stays as its own option, shown as "(none)". */
  const sourceOptions = useMemo(
    () => tally(contacts.map((contact) => contact.source_domain).filter((domain) => domain != null)),
    [contacts]
  )

  /* One object carries every filter, so the table and the export dialog read
     the same values. The date preset resolves to a from/to pair here. */
  const filters = useMemo(() => {
    const range = datePreset === "custom"
      ? { from: customFrom, to: customTo }
      : presetRange(datePreset)
    return {
      status,
      source,
      preset: datePreset,
      from: range.from,
      to: range.to,
      search,
      attention: onlyStale,
    }
  }, [status, source, datePreset, customFrom, customTo, search, onlyStale])

  const rows = useMemo(
    () => sortRows(contacts.filter((contact) => matchesFilters(contact, filters)), sort.column, sort.direction),
    [contacts, filters, sort]
  )

  const activeFilterCount =
    (status !== ALL ? 1 : 0) + (source !== ALL ? 1 : 0) + (datePreset !== ALL ? 1 : 0)

  function clearFilters() {
    setStatus(ALL)
    setSource(ALL)
    setDatePreset(ALL)
    setCustomFrom("")
    setCustomTo("")
  }

  const today = todayIst()
  const sourceValue = source === ALL ? ALL : source === "" ? SOURCE_NONE : source
  const sourceLabel = source === ALL ? "All sources" : source === "" ? "(none)" : source
  const statusLabel = status === ALL ? "All statuses" : statusMeta(status).label
  const dateLabel = DATE_PRESETS.find((preset) => preset.key === datePreset)?.label

  return (
    <>
      {/* Title row: the title and the four actions share one flex row, so they
          centre on the same line. The description sits under it. */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">Data</h1>
          <div className="flex flex-wrap items-center gap-2">
            {/* Export — exports exactly the rows this view shows. */}
            <CsvExportDialog rows={rows} contactTags={contactTags} filters={filters} />
            <CsvImportDialog />
            <AddContactDialog sources={sources} />
            <Button
              variant={onlyStale ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setOnlyStale((currentOnlyStale) => !currentOnlyStale)}
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
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Live contact submissions from Neon DB — {rows.length} records
        </p>
      </div>

      <div className="mt-5 flex w-full flex-col">
        {/* Sticky header: search and filters. No bottom border. */}
        <header className="sticky top-14 z-10 flex flex-col gap-3 bg-background py-3 md:top-16">
          {/* Phone: stacked. Desktop: search fills the row, date, status and source sit beside it. */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-0 md:flex-1">
            <FilterSearch value={search} onChange={setSearch} placeholder="Search name, email, company, phone…" />
          </div>

          {/* Filters: date, status, source — combined with each other and with
              search and Needs attention, and carried into the export. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:shrink-0">
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="h-10 w-full text-sm md:h-9 md:w-44" aria-label="Date">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                    {dateLabel}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger className="h-10 w-full text-sm md:h-9 md:w-44" aria-label="Status">
                <SelectValue>{statusLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {stages.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sourceValue}
              onValueChange={(value) => setSource(value === ALL ? ALL : value === SOURCE_NONE ? "" : value)}
            >
              <SelectTrigger className="h-10 w-full text-sm md:h-9 md:w-44" aria-label="Source">
                <SelectValue>{sourceLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sources</SelectItem>
                {sourceOptions.map(({ value, count }) => (
                  <SelectItem key={value === "" ? SOURCE_NONE : value} value={value === "" ? SOURCE_NONE : value}>
                    {value === "" ? "(none)" : value} · {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          {datePreset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(event) => setCustomFrom(clampToToday(event.target.value))}
                  className="h-10 flex-1 rounded-md border border-border bg-transparent px-2 text-sm md:h-9 md:text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  onChange={(event) => setCustomTo(clampToToday(event.target.value))}
                  className="h-10 flex-1 rounded-md border border-border bg-transparent px-2 text-sm md:h-9 md:text-sm"
                />
              </label>
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} on
                {" · "}{rows.length} of {contacts.length} shown
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </header>

        {/* Phone: one card per contact. Tapping a card opens the same drawer as a row. */}
        <MobileList>
          {rows.length === 0 ? (
            <EmptyState>No records found.</EmptyState>
          ) : (
            rows.map((row) => (
              <ListCard
                key={row.id}
                onClick={() => setOpenContactId(row.id)}
                title={row.name || row.email || "—"}
                subtitle={row.email || null}
                badge={
                  row.status ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                      style={{
                        backgroundColor: `${statusMeta(row.status).color}18`,
                        color: statusMeta(row.status).color,
                        borderColor: `${statusMeta(row.status).color}40`,
                      }}
                    >
                      {statusMeta(row.status).label}
                    </Badge>
                  ) : null
                }
                meta={[row.phone, row.company || null, row.source_domain || null, formatDate(row.created_at, { compact: true })]}
              />
            ))
          )}
        </MobileList>

        <DesktopTable>
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
        </DesktopTable>

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
    </>
  )
}
