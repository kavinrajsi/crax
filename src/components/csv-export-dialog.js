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

/** Matches EXPORT_TZ_OFFSET in the export route — see the note on dates below. */
const EXPORT_TZ_OFFSET = "+05:30"

/** Shown for the contacts whose source_url is the empty-string default. */
const NO_DOMAIN_LABEL = "(none)"

function toggle(set, value) {
  const next = new Set(set)
  next.has(value) ? next.delete(value) : next.add(value)
  return next
}

/** Distinct values with counts, most common first. */
function tally(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
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

export function CsvExportDialog({ contacts, contactTags }) {
  const [open, setOpen] = useState(false)
  const [domains, setDomains] = useState(new Set())
  const [needs, setNeeds] = useState(new Set())
  const [tags, setTags] = useState(new Set())
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [columns, setColumns] = useState(new Set(DEFAULT_EXPORT_COLUMNS))

  /* Options come from source_domain, derived in SQL by data/page.js using the
     same expression the export route filters with. Deriving them here with
     sourceDomain() instead would produce options that match nothing server-side
     — it drops the port and throws on the empty string. */
  /* Nulls are dropped rather than folded into the "" bucket: server-side
     `source_domain = ANY(...)` is NULL for a NULL domain and so matches nothing.
     Offering it as "(none)" would advertise an option that exports zero rows.
     ("" itself is a real, matchable value — source_url defaults to it.) */
  const domainOptions = useMemo(
    () => tally(contacts.map((contact) => contact.source_domain).filter((d) => d != null)),
    [contacts]
  )
  const needOptions = useMemo(
    () => tally(contacts.flatMap((contact) => contact.needs ?? [])),
    [contacts]
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

  /* Mirrors the server's filter algebra exactly: OR within a group, AND across
     groups, and a half-open date range whose bounds are IST wall-clock dates. */
  const matchCount = useMemo(() => {
    const fromAt = from ? new Date(`${from}T00:00:00${EXPORT_TZ_OFFSET}`) : null
    const toAt = to ? new Date(`${to}T00:00:00${EXPORT_TZ_OFFSET}`) : null
    /* Postgres advances `+ interval '1 day'` in the session timezone; setDate
       advances a local calendar day. The two differ by an hour across a DST
       transition, which IST does not have — inert for the intended user. */
    if (toAt) toAt.setDate(toAt.getDate() + 1)

    return contacts.filter((contact) => {
      // `== null` check, not `?? ""` — see domainOptions.
      if (domains.size && (contact.source_domain == null || !domains.has(contact.source_domain))) return false
      if (needs.size && !(contact.needs ?? []).some((need) => needs.has(need))) return false
      if (tags.size) {
        const owned = tagsByContact.get(contact.id)
        if (!owned || ![...tags].some((tag) => owned.has(tag))) return false
      }
      if (fromAt || toAt) {
        // A date filter drops NULL-dated rows, matching the SQL comparison.
        if (!contact.created_at) return false
        const at = new Date(contact.created_at)
        if (fromAt && at < fromAt) return false
        if (toAt && at >= toAt) return false
      }
      return true
    }).length
  }, [contacts, domains, needs, tags, from, to, tagsByContact])

  function handleExport() {
    const params = new URLSearchParams()
    // Registry order, not click order, so an untouched default selection
    // reproduces the historic header row byte for byte.
    for (const column of EXPORT_COLUMNS) {
      if (columns.has(column.key)) params.append("col", column.key)
    }
    for (const { value } of domainOptions) if (domains.has(value)) params.append("domain", value)
    for (const { value } of needOptions) if (needs.has(value)) params.append("need", value)
    for (const { value } of tagOptions) if (tags.has(value)) params.append("tag", value)
    if (from) params.set("from", from)
    if (to) params.set("to", to)

    window.location.href = `/api/contacts/export?${params.toString()}`
    setOpen(false)
  }

  function handleReset() {
    setDomains(new Set())
    setNeeds(new Set())
    setTags(new Set())
    setFrom("")
    setTo("")
    setColumns(new Set(DEFAULT_EXPORT_COLUMNS))
  }

  const noColumns = columns.size === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Label and size held identical to the button this replaced — the /data
          loading skeleton sizes its three header bars to match (w-24 here). */}
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" />}>
        <DownloadIcon className="h-3.5 w-3.5" />
        Export CSV
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Contacts</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Leave a filter empty to include everything. Options within a filter match
          any; separate filters must all match.
        </p>

        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          <Section title="Source">
            {domainOptions.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">No sources.</p>
            ) : (
              domainOptions.map(({ value, count }) => (
                <CheckRow
                  key={value}
                  checked={domains.has(value)}
                  onChange={() => setDomains((prev) => toggle(prev, value))}
                  label={value === "" ? NO_DOMAIN_LABEL : value}
                  count={count}
                />
              ))
            )}
          </Section>

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

          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Date range
            </p>
            <div className="flex flex-col gap-2 rounded-lg border border-border px-2 py-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">From</span>
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">To</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-xs"
                />
              </label>
              <p className="text-[10px] text-muted-foreground">
                Inclusive of both days, in IST.
              </p>
            </div>
          </div>
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
