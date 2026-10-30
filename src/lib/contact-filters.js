/**
 * Filters for the Data page table and the CSV export, defined once.
 *
 * The table filters rows in the browser; the export route filters the same
 * rows in SQL. Both read the date, search and attention rules from here or
 * mirror them exactly, so the count the export dialog shows and the rows the
 * CSV contains cannot disagree.
 *
 * Plain module, no "use client": it is pure JS and is safe to load anywhere.
 */
import { needsAttention } from "./follow-up.js"

/** Dates are IST wall-clock days, the zone the export route and en-IN display use. */
export const IST_OFFSET = "+05:30"

const DAY_MS = 86_400_000

/** Sentinel for "no filter on this dimension". */
export const ALL = "all"

export const DATE_PRESETS = [
  { key: ALL, label: "All dates" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range" },
]

/** Today's date in IST as YYYY-MM-DD. en-CA is the locale that formats ISO-style. */
export function todayIst(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

/** Shift a YYYY-MM-DD string by whole days. Done in UTC so the browser's zone cannot move it. */
function shiftDay(ymd, days) {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** The inclusive from/to pair a preset stands for. "custom" and "all" have none. */
export function presetRange(preset, today = todayIst()) {
  switch (preset) {
    case "today": return { from: today, to: today }
    case "7d": return { from: shiftDay(today, -6), to: today }
    case "30d": return { from: shiftDay(today, -29), to: today }
    case "month": return { from: `${today.slice(0, 8)}01`, to: today }
    default: return { from: "", to: "" }
  }
}

/**
 * True when createdAt falls on an IST day within [from, to], both inclusive.
 * An empty bound is open. A missing timestamp fails any active bound, which is
 * what the SQL comparison does with NULL.
 */
export function inDateRange(createdAt, from, to) {
  if (!from && !to) return true
  if (!createdAt) return false
  const at = new Date(createdAt).getTime()
  if (from && at < new Date(`${from}T00:00:00${IST_OFFSET}`).getTime()) return false
  if (to && at >= new Date(`${to}T00:00:00${IST_OFFSET}`).getTime() + DAY_MS) return false
  return true
}

/**
 * Filter shape: { status, source, from, to, search, attention }.
 *   status    ALL or a contact status key
 *   source    ALL or a source_domain value ("" is the real "(none)" bucket)
 *   from/to   YYYY-MM-DD IST, or "" for open
 *   search    free text, matched case-insensitively against name, email, company, phone
 *   attention true to keep only leads that need attention
 */
export function matchesFilters(contact, filters) {
  if (filters.status !== ALL && contact.status !== filters.status) return false
  // `== null` is not matched by "" — a NULL domain is never a real source.
  if (filters.source !== ALL && contact.source_domain !== filters.source) return false
  if (!inDateRange(contact.created_at, filters.from, filters.to)) return false
  if (filters.attention && !needsAttention(contact)) return false
  const query = filters.search.trim().toLowerCase()
  if (query) {
    const hit = [contact.name, contact.email, contact.company, contact.phone]
      .some((value) => value?.toLowerCase().includes(query))
    if (!hit) return false
  }
  return true
}

/** Distinct values with counts, most common first. Nulls are the caller's to drop. */
export function tally(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((first, second) => second.count - first.count || String(first.value).localeCompare(String(second.value)))
}
