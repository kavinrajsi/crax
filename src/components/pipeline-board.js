"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchIcon } from "lucide-react"
import { ContactsKanban } from "@/components/contacts-kanban"
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
  const visible = counts[source] ?? 0
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track {visible} lead{visible === 1 ? "" : "s"} across the pipeline.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone or company…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-8 h-9 w-full text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={windowKey} onValueChange={setWindowKey}>
            <SelectTrigger className="h-9 w-full text-sm" aria-label="Date">
              <SelectValue>{windowLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_WINDOWS.map((w) => (
                <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={needs} onValueChange={setNeeds}>
            <SelectTrigger className="h-9 w-full text-sm" aria-label="Needs">
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

      <Tabs value={source} onValueChange={onSourceChange}>
        <TabsList>
          {PIPELINE_SOURCES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
              <span className="text-xs tabular-nums text-muted-foreground">{counts[s.key]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ContactsKanban
        contacts={contacts}
        statusColumns={statusColumns}
        filter={(c) => matchesPipelineFilters(c, filters) && contactMatchesSource(c, source)}
      />
    </div>
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
        className="h-8 flex-1 rounded-md border border-border bg-transparent px-2 text-xs"
      />
      <input
        type="time"
        value={time}
        onChange={(event) => onTime(event.target.value)}
        className="h-8 w-28 rounded-md border border-border bg-transparent px-2 text-xs"
      />
    </div>
  )
}
