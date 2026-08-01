import { CONTACT_FIELDS } from "@/lib/contact-fields"

/**
 * Every column the CSV export can emit, in the order they appear in the picker.
 *
 * Labels are NOT taken wholesale from CONTACT_FIELDS, deliberately. Three of the
 * nine default columns are labelled differently by the export than by the detail
 * view — `source_url` is "Source URL" here but "Source" there, `created_at` is
 * "Date" here but "Submitted" there — and four more (id, name, status,
 * company_id) are in HANDLED_ELSEWHERE and have no label there at all. Adopting
 * the CONTACT_FIELDS wording would silently rewrite the header row of every
 * existing export. The default nine below reproduce today's header exactly:
 *
 *   ID,Name,Email,Phone,Company,Source URL,Status,Needs,Date
 *
 * `label()` is used only for the columns this export is newly exposing, so the
 * two lists still cannot drift on the wording of anything they share.
 */

/** Label from CONTACT_FIELDS, falling back to an explicit one. */
function label(key, fallback) {
  return CONTACT_FIELDS.find((field) => field.key === key)?.label ?? fallback
}

export const EXPORT_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "source_url", label: "Source URL" },
  { key: "status", label: "Status" },
  /* Flattened from the needs text[] by the query, as `array_to_string(needs, ', ')`.
     The raw array column is intentionally not offered separately — two columns
     both labelled "Needs" would be worse than one. */
  { key: "needs_str", label: "Needs" },
  { key: "created_at", label: "Date" },

  /* Derived in SQL, not a stored column. See the export route for why this is
     the single authority on "domain" rather than sourceDomain(). */
  { key: "source_domain", label: "Source Domain" },

  { key: "role", label: label("role", "Role") },
  { key: "message", label: label("message", "Message") },
  { key: "company_id", label: "Company ID" },
  { key: "location", label: label("location", "Location") },
  { key: "ip_address", label: label("ip_address", "IP Address") },

  { key: "utm_source", label: label("utm_source", "UTM Source") },
  { key: "utm_medium", label: label("utm_medium", "UTM Medium") },
  { key: "utm_campaign", label: label("utm_campaign", "UTM Campaign") },
  { key: "utm_term", label: label("utm_term", "UTM Term") },
  { key: "utm_content", label: label("utm_content", "UTM Content") },

  { key: "gclid", label: label("gclid", "gclid") },
  { key: "wbraid", label: label("wbraid", "wbraid") },
  { key: "gbraid", label: label("gbraid", "gbraid") },
  { key: "fbclid", label: label("fbclid", "fbclid") },
  { key: "msclkid", label: label("msclkid", "msclkid") },

  { key: "raw_payload", label: label("raw_payload", "Raw Payload") },
]

/**
 * The nine columns the export has always emitted. An untouched dialog must
 * produce a byte-identical CSV to the pre-dialog export, so this list and its
 * order are load-bearing — see the regression test in the plan.
 */
export const DEFAULT_EXPORT_COLUMNS = [
  "id",
  "name",
  "email",
  "phone",
  "company",
  "source_url",
  "status",
  "needs_str",
  "created_at",
]

const BY_KEY = new Map(EXPORT_COLUMNS.map((column) => [column.key, column]))

/**
 * Resolve requested column keys to column objects, dropping anything unknown.
 * Unknown keys are discarded rather than echoed — the value never reaches SQL
 * (the query is a fixed `SELECT cu.*` and projection happens in JS), and this
 * keeps a bogus `?col=` out of the header row too.
 *
 * Returns the default set when nothing usable was requested.
 */
export function resolveExportColumns(keys) {
  const resolved = (keys ?? []).map((key) => BY_KEY.get(key)).filter(Boolean)
  if (resolved.length > 0) return resolved
  return DEFAULT_EXPORT_COLUMNS.map((key) => BY_KEY.get(key))
}
