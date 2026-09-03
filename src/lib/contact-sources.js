/**
 * Pipeline source buckets.
 *
 * Every contact_us row lands in exactly one bucket by its source_url:
 *   zoho    — rows imported from the Zoho Deals export (source_url = "zoho-import")
 *   search  — search.madarth.com / searchmadarth.com forms
 *   madarth — every other madarth.com page
 *   other   — anything else (csv-import, ad-platform leads, …); only visible under "all"
 */

export const PIPELINE_SOURCES = [
  { key: "all",     label: "All" },
  { key: "zoho",    label: "Zoho" },
  { key: "madarth", label: "Madarth" },
  { key: "search",  label: "Search" },
]

export const DEFAULT_PIPELINE_SOURCE = "all"

const SOURCE_KEYS = new Set(PIPELINE_SOURCES.map((s) => s.key))

/** Coerce a ?source= value to a known key; unknown → default. */
export function normalizePipelineSource(value) {
  return SOURCE_KEYS.has(value) ? value : DEFAULT_PIPELINE_SOURCE
}

/** Classify one source_url into a bucket key. Never "all". */
export function contactSourceKey(sourceUrl) {
  const raw = String(sourceUrl ?? "").trim().toLowerCase()
  if (!raw) return "other"
  if (raw === "zoho-import") return "zoho"

  let host = ""
  try {
    host = new URL(raw).hostname
  } catch {
    return "other"
  }
  host = host.replace(/^www\./, "")

  if (host === "searchmadarth.com" || host === "search.madarth.com") return "search"
  if (host === "madarth.com" || host.endsWith(".madarth.com")) return "madarth"
  return "other"
}

/** True when the contact belongs on the given pipeline tab. */
export function contactMatchesSource(contact, source) {
  return source === "all" || contactSourceKey(contact.source_url) === source
}
