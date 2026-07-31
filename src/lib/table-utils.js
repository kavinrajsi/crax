/**
 * Pure table/formatting helpers, shared by server and client components.
 *
 * These previously existed as up to six near-identical copies that had drifted
 * apart — one `getValue` had a Date branch the others lacked, `formatDate`
 * differed on seconds vs compact. One copy now, so a fix lands everywhere.
 *
 * Deliberately NOT marked "use client": server components call these directly
 * (contacts/[id]/page.js, dashboard/page.js), and a "use client" module's
 * exports would arrive there as client references rather than functions.
 * The React pieces live in `src/components/sortable-head.js`.
 *
 * Sort state shape is { column, direction } throughout.
 */

/* ─── sort ─────────────────────────────────────────────────────────────── */

export function getValue(row, key) {
  const value = row[key]
  if (value == null) return ""
  // @neondatabase/serverless can hand back timestamptz as a Date rather than a
  // string, and only one of the original copies handled that.
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).getTime()
  }
  return typeof value === "string" ? value.toLowerCase() : value
}

export function sortRows(rows, column, direction) {
  if (!column) return rows
  return [...rows].sort((rowA, rowB) => {
    const aValue = getValue(rowA, column)
    const bValue = getValue(rowB, column)
    if (aValue < bValue) return direction === "asc" ? -1 : 1
    if (aValue > bValue) return direction === "asc" ? 1 : -1
    return 0
  })
}

/* ─── formatting ───────────────────────────────────────────────────────── */

/**
 * @param {object} [opts]
 * @param {boolean} [opts.compact]  day + month only (dense table rows)
 * @param {boolean} [opts.seconds]  include seconds (audit log)
 */
export function formatDate(isoDate, { compact = false, seconds = false } = {}) {
  if (!isoDate) return "—"
  const options = compact
    ? { day: "2-digit", month: "short" }
    : {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        ...(seconds ? { second: "2-digit" } : {}),
      }
  return new Date(isoDate).toLocaleString("en-IN", options)
}

export function timeAgo(isoDate) {
  if (!isoDate) return ""
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function truncate(text, maxLength = 20) {
  if (!text) return "—"
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text
}

/** hostname + path, www stripped. Falls back to the raw string. */
export function sourcePath(url) {
  try {
    const parsedUrl = new URL(url)
    const path = parsedUrl.pathname.replace(/\/$/, "") || "/"
    return parsedUrl.hostname.replace("www.", "") + path
  } catch {
    return url || "—"
  }
}

/** hostname only. */
export function sourceDomain(url, fallback = "—") {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url || fallback
  }
}
