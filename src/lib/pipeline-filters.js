/**
 * Filters for the pipeline board: search, date window and needs.
 *
 * The board holds the full contact list and filters it in the browser, so a
 * filter change never re-runs the page's SQL. Source tabs and status columns
 * are not here: the tabs narrow by source on top of these filters, and the
 * kanban narrows by status.
 *
 * Plain module, no "use client".
 */
import { todayIst, IST_OFFSET } from "./contact-filters.js"

export const DATE_WINDOWS = [
  { key: "any", label: "Any date" },
  { key: "hour", label: "Last hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range…" },
]

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/**
 * Turn a YYYY-MM-DD date and an HH:mm time, both IST wall-clock, into an
 * instant. Empty strings return null so an unset bound is open.
 */
function istInstant(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || "00:00"}:00${IST_OFFSET}`)
}

/**
 * The [from, to] instants a window stands for. Either bound may be null
 * (open). Rolling windows are measured from `now`; calendar windows use IST
 * days.
 */
export function windowBounds(window, custom, now = new Date()) {
  switch (window) {
    case "hour": return { from: new Date(now.getTime() - HOUR_MS), to: null }
    case "24h": return { from: new Date(now.getTime() - DAY_MS), to: null }
    case "7d": return { from: new Date(now.getTime() - 7 * DAY_MS), to: null }
    case "30d": return { from: new Date(now.getTime() - 30 * DAY_MS), to: null }
    case "month": {
      const today = todayIst(now)
      return { from: istInstant(`${today.slice(0, 8)}01`, "00:00"), to: null }
    }
    case "custom": {
      // An end date with no time means the whole day, so it runs to 23:59:59.999.
      const end = custom.endDate && !custom.endTime
        ? new Date(istInstant(custom.endDate).getTime() + DAY_MS - 1)
        : istInstant(custom.endDate, custom.endTime)
      return { from: istInstant(custom.startDate, custom.startTime), to: end }
    }
    default:
      return { from: null, to: null }
  }
}

/**
 * Filter shape: { query, window, custom, needs }.
 *   query   free text, matched case-insensitively against name, email, phone, company
 *   window  one of DATE_WINDOWS keys
 *   custom  { startDate, startTime, endDate, endTime } for "custom"
 *   needs   ALL or a needs value; the contact must carry it
 */
export function matchesPipelineFilters(contact, filters, now = new Date()) {
  const query = filters.query.trim().toLowerCase()
  if (query) {
    const hit = [contact.name, contact.email, contact.phone, contact.company]
      .some((value) => value?.toLowerCase().includes(query))
    if (!hit) return false
  }

  if (filters.needs !== "all" && !(contact.needs ?? []).includes(filters.needs)) return false

  const { from, to } = windowBounds(filters.window, filters.custom, now)
  if (from || to) {
    if (!contact.created_at) return false
    const at = new Date(contact.created_at).getTime()
    if (from && at < from.getTime()) return false
    if (to && at > to.getTime()) return false
  }
  return true
}
