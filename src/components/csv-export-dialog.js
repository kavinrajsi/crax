"use client"

import { useMemo, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { EXPORT_COLUMNS, DEFAULT_EXPORT_COLUMNS } from "@/lib/export-columns"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"
import { ALL, DATE_PRESETS, tally } from "@/lib/contact-filters"

/** Shown for the contacts whose source_url is the empty-string default. */
const NO_DOMAIN_LABEL = "(none)"

function toggle(set, value) {
  const next = new Set(set)
  next.has(value) ? next.delete(value) : next.add(value)
  return next
}

function CheckRow({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-border"
      />
      <span className="truncate" title={label}>{label}</span>
      {count != null && (
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{count}</span>
      )}
    </label>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="max-h-32 overflow-y-auto rounded-lg border border-border px-2 py-1.5">
        {children}
      </div>
    </div>
  )
}

/** The table's filters as a sentence, so the dialog says what it will export. */
function describeFilters(filters) {
  const parts = []
  if (filters.status !== ALL) {
    parts.push(`Status: ${CONTACT_STATUSES.find((s) => s.key === filters.status)?.label ?? filters.status}`)
  }
  if (filters.source !== ALL) {
    parts.push(`Source: ${filters.source === "" ? NO_DOMAIN_LABEL : filters.source}`)
  }
  if (filters.preset !== ALL) {
    const label = filters.preset === "custom"
      ? `${filters.from || "…"} to ${filters.to || "…"}`
      : DATE_PRESETS.find((p) => p.key === filters.preset)?.label
    parts.push(`Date: ${label}`)
  }
  if (filters.search.trim()) parts.push(`Search: "${filters.search.trim()}"`)
  if (filters.attention) parts.push("Needs attention only")
  return parts
}

/**
 * The export dialog. `rows` is what the table currently shows, already filtered
 * by status, source, date, search and attention; this dialog adds the needs and
 * tags filters and the column choice, then sends every filter to the export
 * route so the server returns the same set.
 */
export function CsvExportDialog({ rows, contactTags, filters }) {
  const [open, setOpen] = useState(false)
  const [needs, setNeeds] = useState(new Set())
  const [tags, setTags] = useState(new Set())
  const [columns, setColumns] = useState(new Set(DEFAULT_EXPORT_COLUMNS))

  /* Options come from the rows the table shows, so a need or tag with no match
     in the current view is not offered. */
  const needOptions = useMemo(
    () => tally(rows.flatMap((contact) => contact.needs ?? [])),
    [rows]
  )
  const tagOptions = useMemo(
    () => tally((contactTags ?? []).map((row) => row.tag)),
    [contactTags]
  )

  const tagsByContact = useMemo(() => {
    const map = new Map()
    for (const { contact_id, tag } of contactTags ?? []) {
      if (!map.has(contact_id)) map.set(contact_id, new Set())
      map.get(contact_id).add(tag)
    }
    return map
  }, [contactTags])

  /* The table's rows are already filtered by everything except needs and tags,
     so the live count is those rows narrowed by the two remaining filters. The
     server applies the same algebra: OR within a group, AND across groups. */
  const matchCount = useMemo(() => {
    return rows.filter((contact) => {
      if (needs.size && !(contact.needs ?? []).some((need) => needs.has(need))) return false
      if (tags.size) {
        const owned = tagsByContact.get(contact.id)
        if (!owned || ![...tags].some((tag) => owned.has(tag))) return false
      }
      return true
    }).length
  }, [rows, needs, tags, tagsByContact])

  function handleExport() {
    const params = new URLSearchParams()
    // Registry order, not click order, so an untouched default selection
    // reproduces the historic header row byte for byte.
    for (const column of EXPORT_COLUMNS) {
      if (columns.has(column.key)) params.append("col", column.key)
    }
    for (const need of needs) params.append("need", need)
    for (const tag of tags) params.append("tag", tag)

    if (filters.status !== ALL) params.set("status", filters.status)
    // "" is the real "(none)" bucket, so it is sent as an empty value, not skipped.
    if (filters.source !== ALL) params.append("domain", filters.source)
    if (filters.from) params.set("from", filters.from)
    if (filters.to) params.set("to", filters.to)
    if (filters.search.trim()) params.set("q", filters.search.trim())
    if (filters.attention) params.set("attention", "1")

    window.location.href = `/api/contacts/export?${params.toString()}`
    setOpen(false)
  }

  function handleReset() {
    setNeeds(new Set())
    setTags(new Set())
    setColumns(new Set(DEFAULT_EXPORT_COLUMNS))
  }

  const noColumns = columns.size === 0
  const activeFilters = describeFilters(filters)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Label and size held identical to the button this replaced — the /data
          loading skeleton sizes its header bars to match. */}
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" />}>
        <DownloadIcon className="h-3.5 w-3.5" />
        Export CSV
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Contacts</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {activeFilters.length > 0
            ? <>Exports the rows the table is filtered to: <span className="text-foreground">{activeFilters.join(" · ")}</span>. </>
            : <>Exports every contact. </>}
          Needs and tags narrow further; options within each match any.
        </p>

        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          <Section title="Needs">
            {needOptions.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">No needs recorded.</p>
            ) : (
              needOptions.map(({ value, count }) => (
                <CheckRow
                  key={value}
                  checked={needs.has(value)}
                  onChange={() => setNeeds((prev) => toggle(prev, value))}
                  label={value}
                  count={count}
                />
              ))
            )}
          </Section>

          <Section title="Tags">
            {tagOptions.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">No tags yet.</p>
            ) : (
              tagOptions.map(({ value, count }) => (
                <CheckRow
                  key={value}
                  checked={tags.has(value)}
                  onChange={() => setTags((prev) => toggle(prev, value))}
                  label={value}
                  count={count}
                />
              ))
            )}
          </Section>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Columns
            </p>
            <button
              type="button"
              onClick={() => setColumns(new Set(DEFAULT_EXPORT_COLUMNS))}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Reset to default
            </button>
          </div>
          <div className="grid max-h-36 grid-cols-2 gap-x-4 overflow-y-auto rounded-lg border border-border px-2 py-1.5 sm:grid-cols-3">
            {EXPORT_COLUMNS.map((column) => (
              <CheckRow
                key={column.key}
                checked={columns.has(column.key)}
                onChange={() => setColumns((prev) => toggle(prev, column.key))}
                label={column.label}
              />
            ))}
          </div>
        </div>

        <DialogFooter showCloseButton>
          <div className="mr-auto text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{matchCount}</span>
            {matchCount === 1 ? " contact" : " contacts"}
            {" · "}
            <span className="tabular-nums">{columns.size}</span>
            {columns.size === 1 ? " column" : " columns"}
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleReset}>
            Reset
          </Button>
          <Button size="sm" className="text-xs" onClick={handleExport} disabled={noColumns || matchCount === 0}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
