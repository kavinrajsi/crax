"use client"

import { useMemo, useState } from "react"
import { PageShell, PageHeader, FilterSearch } from "@/components/page"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContactsKanban } from "@/components/contacts-kanban"
import { CalendarIcon } from "lucide-react"
import {
  PIPELINE_SOURCES,
  DEFAULT_PIPELINE_SOURCE,
  contactMatchesSource,
} from "@/lib/contact-sources"
import { ALL, tally, todayIst } from "@/lib/contact-filters"
import { DATE_WINDOWS, matchesPipelineFilters } from "@/lib/pipeline-filters"

/**
 * Pipeline page body: one board, four source tabs (All / Zoho / Madarth /
 * Search), plus search, date window and needs filters above it. Everything
 * filters client-side over the full contact list so switching tabs or filters
 * never remounts the kanban — an in-flight optimistic status move survives.
 *
 * The chosen tab is mirrored into ?source= via history.replaceState (which
 * Next syncs with useSearchParams) so a tab is linkable without a navigation
 * that would re-run the page's SQL and flash the loading skeleton.
 */
/* Chip colours for the source filter. Zoho is kept so a future Zoho import
   gets a colour; the tab itself stays hidden while it has no contacts. */
const SOURCE_COLORS = {
  all: "#64748b",
  zoho: "#a855f7",
  madarth: "#0ea5e9",
  search: "#f59e0b",
}

export function PipelineBoard({ contacts, statusColumns, initialSource }) {
  const [source, setSource] = useState(initialSource)
  const [query, setQuery] = useState("")
  const [windowKey, setWindowKey] = useState("any")
  const [custom, setCustom] = useState({ startDate: "", startTime: "", endDate: "", endTime: "" })
  const [needs, setNeeds] = useState(ALL)

  const today = todayIst()

  const needsOptions = useMemo(
    () => tally(contacts.flatMap((c) => c.needs ?? [])),
    [contacts]
  )

  /* Everything except the source tab. The tab counts are taken from this set,
     so each tab's number matches what it shows once selected. */
  const filters = useMemo(
    () => ({ query, window: windowKey, custom, needs }),
    [query, windowKey, custom, needs]
  )
  const base = useMemo(
    () => contacts.filter((c) => matchesPipelineFilters(c, filters)),
    [contacts, filters]
  )

  const counts = Object.fromEntries(
    PIPELINE_SOURCES.map((s) => [s.key, base.filter((c) => contactMatchesSource(c, s.key)).length])
  )
  /* A source with no contacts in the current view gets no tab (Zoho, once its
     rows are gone). "All" always stays. A ?source= pointing at a hidden tab
     falls back to All. */
  const shownSources = PIPELINE_SOURCES.filter(
    (s) => s.key === DEFAULT_PIPELINE_SOURCE || s.key === source || counts[s.key] > 0
  )
  const activeSource = shownSources.some((s) => s.key === source) ? source : DEFAULT_PIPELINE_SOURCE
  const visible = counts[activeSource] ?? 0
  const filtersActive = query.trim() !== "" || windowKey !== "any" || needs !== ALL

  function onSourceChange(next) {
    setSource(next)
    const url = new URL(window.location.href)
    if (next === DEFAULT_PIPELINE_SOURCE) url.searchParams.delete("source")
    else url.searchParams.set("source", next)
    window.history.replaceState(null, "", url)
  }

  /* Custom bounds stop at today (IST). A typed future date is clamped, as on
     the Data page, so the board never filters to days that do not exist yet. */
  function setCustomDate(field, value) {
    const clamped = value && value > today ? today : value
    setCustom((prev) => ({ ...prev, [field]: clamped }))
  }

  function setCustomTime(field, value) {
    setCustom((prev) => ({ ...prev, [field]: value }))
  }

  function clearFilters() {
    setQuery("")
    setWindowKey("any")
    setNeeds(ALL)
    setCustom({ startDate: "", startTime: "", endDate: "", endTime: "" })
  }

  const windowLabel = DATE_WINDOWS.find((w) => w.key === windowKey)?.label

  return (
    <PageShell>
      <PageHeader
        title="Pipeline"
        description={`Track ${visible} lead${visible === 1 ? "" : "s"} across the pipeline.`}
      />

      <div className="flex flex-col gap-3">
        {/* Source chips, styled like the contacts status chips: tinted, with the
            selected one stronger. Hidden sources (no contacts) are not shown. */}
        <div role="group" aria-label="Source" className="flex flex-wrap gap-2">
          {shownSources.map((s) => {
            const active = s.key === activeSource
            const color = SOURCE_COLORS[s.key] ?? "#64748b"
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSourceChange(s.key)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors"
                style={{
                  backgroundColor: `${color}${active ? "30" : "12"}`,
                  color,
                  borderColor: `${color}${active ? "90" : "40"}`,
                }}
              >
                {s.label}
                <span className="font-medium tabular-nums">{counts[s.key]}</span>
              </button>
            )
          })}
        </div>

        {/* Phone: stacked. Desktop: search fills the row, date and needs sit beside it. */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="min-w-0 md:flex-1">
          <FilterSearch value={query} onChange={setQuery} placeholder="Search name, email, phone or company…" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:shrink-0">
          <Select value={windowKey} onValueChange={setWindowKey}>
            <SelectTrigger className="h-10 w-full text-sm md:h-9 md:w-44" aria-label="Date">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                  {windowLabel}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_WINDOWS.map((w) => (
                <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={needs} onValueChange={setNeeds}>
            <SelectTrigger className="h-10 w-full text-sm md:h-9 md:w-44" aria-label="Needs">
              <SelectValue>{needs === ALL ? "All needs" : needs}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All needs</SelectItem>
              {needsOptions.map(({ value, count }) => (
                <SelectItem key={value} value={value}>{value} · {count}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        </div>

        {windowKey === "custom" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DateTimePair
              label="Start"
              date={custom.startDate}
              time={custom.startTime}
              max={custom.endDate || today}
              onDate={(v) => setCustomDate("startDate", v)}
              onTime={(v) => setCustomTime("startTime", v)}
            />
            <DateTimePair
              label="End"
              date={custom.endDate}
              time={custom.endTime}
              min={custom.startDate || undefined}
              max={today}
              onDate={(v) => setCustomDate("endDate", v)}
              onTime={(v) => setCustomTime("endTime", v)}
            />
          </div>
        )}

        {filtersActive && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{base.length} of {contacts.length} shown</span>
            <button type="button" onClick={clearFilters} className="underline-offset-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>


      <ContactsKanban
        contacts={contacts}
        statusColumns={statusColumns}
        filter={(c) => matchesPipelineFilters(c, filters) && contactMatchesSource(c, activeSource)}
      />
    </PageShell>
  )
}

function DateTimePair({ label, date, time, min, max, onDate, onTime }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="date"
        value={date}
        min={min}
        max={max}
        onChange={(event) => onDate(event.target.value)}
        className="h-10 flex-1 rounded-md border border-border bg-transparent px-2 text-sm md:h-8 md:text-xs"
      />
      <input
        type="time"
        value={time}
        onChange={(event) => onTime(event.target.value)}
        className="h-10 w-28 rounded-md border border-border bg-transparent px-2 text-sm md:h-8 md:text-xs"
      />
    </div>
  )
}
