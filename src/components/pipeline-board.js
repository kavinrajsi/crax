"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PageShell, PageHeader, FilterSearch } from "@/components/page"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContactsKanban } from "@/components/contacts-kanban"
import { CalendarIcon, SettingsIcon } from "lucide-react"
import {
  PIPELINE_SOURCES,
  DEFAULT_PIPELINE_SOURCE,
  contactMatchesSource,
  SOURCE_DEFAULT_COLORS,
} from "@/lib/contact-sources"
import { ALL, tally, todayIst } from "@/lib/contact-filters"
import { DATE_WINDOWS, matchesPipelineFilters } from "@/lib/pipeline-filters"

/**
 * Pipeline page body: pick a pipeline, then one board with four source tabs
 * (All / Zoho / Madarth / Search), plus search, date window and needs filters.
 * Everything filters client-side over the full contact list so switching tabs
 * or filters never remounts the kanban — an in-flight optimistic status move
 * survives.
 *
 * The chosen tab is mirrored into ?source= via history.replaceState (which
 * Next syncs with useSearchParams) so a tab is linkable without a navigation
 * that would re-run the page's SQL and flash the loading skeleton.
 */


export function PipelineBoard({
  contacts,
  pipelines,
  stages,
  activePipelineId,
  initialSource,
  sourceColors: initialSourceColors,
}) {
  const [pipelineId, setPipelineId] = useState(activePipelineId)
  const [source, setSource] = useState(initialSource)
  const [query, setQuery] = useState("")
  const [windowKey, setWindowKey] = useState("any")
  const [custom, setCustom] = useState({ startDate: "", startTime: "", endDate: "", endTime: "" })
  const [needs, setNeeds] = useState(ALL)
  const sourceColors = initialSourceColors

  const today = todayIst()

  const activePipeline = pipelines.find((pipeline) => pipeline.id === pipelineId) ?? null

  /* Columns are this pipeline's stages, in their saved order. */
  const statusColumns = useMemo(
    () => stages
      .filter((stage) => stage.pipeline_id === pipelineId)
      .map((stage) => ({ key: stage.key, label: stage.label, color: stage.color, resolved: stage.resolved })),
    [stages, pipelineId]
  )

  const pipelineContacts = useMemo(
    () => contacts.filter((contact) => contact.pipeline_id === pipelineId),
    [contacts, pipelineId]
  )

  const needsOptions = useMemo(
    () => tally(pipelineContacts.flatMap((pipelineContact) => pipelineContact.needs ?? [])),
    [pipelineContacts]
  )

  /* Everything except the source tab. The tab counts are taken from this set,
     so each tab's number matches what it shows once selected. */
  const filters = useMemo(
    () => ({ query, window: windowKey, custom, needs }),
    [query, windowKey, custom, needs]
  )
  const base = useMemo(
    () => pipelineContacts.filter((pipelineContact) => matchesPipelineFilters(pipelineContact, filters)),
    [pipelineContacts, filters]
  )

  const counts = Object.fromEntries(
    PIPELINE_SOURCES.map((sourceTab) => [sourceTab.key, base.filter((contact) => contactMatchesSource(contact, sourceTab.key)).length])
  )
  /* A source with no contacts in the current view gets no tab (Zoho, once its
     rows are gone). "All" always stays. A ?source= pointing at a hidden tab
     falls back to All. */
  const shownSources = PIPELINE_SOURCES.filter(
    (sourceTab) => sourceTab.key === DEFAULT_PIPELINE_SOURCE || sourceTab.key === source || counts[sourceTab.key] > 0
  )
  const activeSource = shownSources.some((shownSource) => shownSource.key === source) ? source : DEFAULT_PIPELINE_SOURCE
  const visible = counts[activeSource] ?? 0
  const filtersActive = query.trim() !== "" || windowKey !== "any" || needs !== ALL

  function colorFor(key) {
    return sourceColors[key] ?? SOURCE_DEFAULT_COLORS[key] ?? "#64748b"
  }

  function onSourceChange(next) {
    setSource(next)
    const url = new URL(window.location.href)
    if (next === DEFAULT_PIPELINE_SOURCE) url.searchParams.delete("source")
    else url.searchParams.set("source", next)
    window.history.replaceState(null, "", url)
  }

  function onPipelineChange(next) {
    const id = Number(next)
    setPipelineId(id)
    setManaging(false)
    setError(null)
    const url = new URL(window.location.href)
    url.searchParams.set("pipeline", String(id))
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

  const windowLabel = DATE_WINDOWS.find((window) => window.key === windowKey)?.label

  return (
    <PageShell>
      <PageHeader
        title="Pipeline"
        description={`Track ${visible} lead${visible === 1 ? "" : "s"} across ${activePipeline?.name ?? "the pipeline"}.`}
      />

      {/* Pipeline switcher and management. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(pipelineId)} onValueChange={onPipelineChange}>
          <SelectTrigger className="h-9 w-56 text-sm" aria-label="Pipeline">
            <SelectValue>{activePipeline?.name ?? "Choose a pipeline"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={String(pipeline.id)}>{pipeline.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link href="/settings" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted">
          <SettingsIcon className="h-3.5 w-3.5" />
          Manage pipelines
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {/* Source chips, styled like the contacts status chips: tinted, with the
            selected one stronger. Each chip's colour is saved per user; the
            swatch beside it changes it. Hidden sources (no contacts) are not shown. */}
        <div role="group" aria-label="Source" className="flex flex-wrap items-center gap-2">
          {shownSources.map((shownSource) => {
            const active = shownSource.key === activeSource
            const color = colorFor(shownSource.key)
            return (
              <span key={shownSource.key} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSourceChange(shownSource.key)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors"
                  style={{
                    backgroundColor: `${color}${active ? "30" : "12"}`,
                    color,
                    borderColor: `${color}${active ? "90" : "40"}`,
                  }}
                >
                  {shownSource.label}
                  <span className="font-medium tabular-nums">{counts[shownSource.key]}</span>
                </button>
              </span>
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
              {DATE_WINDOWS.map((window) => (
                <SelectItem key={window.key} value={window.key}>{window.label}</SelectItem>
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
              onDate={(value) => setCustomDate("startDate", value)}
              onTime={(value) => setCustomTime("startTime", value)}
            />
            <DateTimePair
              label="End"
              date={custom.endDate}
              time={custom.endTime}
              min={custom.startDate || undefined}
              max={today}
              onDate={(value) => setCustomDate("endDate", value)}
              onTime={(value) => setCustomTime("endTime", value)}
            />
          </div>
        )}

        {filtersActive && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{base.length} of {pipelineContacts.length} shown</span>
            <button type="button" onClick={clearFilters} className="underline-offset-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>


      <ContactsKanban
        contacts={contacts}
        statusColumns={statusColumns}
        pipelines={pipelines}
        filter={(c) => c.pipeline_id === pipelineId && matchesPipelineFilters(c, filters) && contactMatchesSource(c, activeSource)}
      />
    </PageShell>
  )
}

/* Stage list, add-stage form, new-pipeline form and delete. Shown only while
   "Manage stages" is open. */
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
