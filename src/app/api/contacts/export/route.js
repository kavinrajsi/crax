import { sql } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"
import { recordAudit } from "@/lib/audit"
import { resolveExportColumns } from "@/lib/export-columns"

/**
 * Strips the scheme and a leading `www.` so what is left of source_url up to the
 * first `/` is the domain. String.raw is load-bearing: in a plain template
 * literal `\.` collapses to `.`, which would match any character.
 *
 * This expression — not sourceDomain() in table-utils.js — is the authority on
 * what "domain" means for filtering. The two disagree on real rows: new URL()
 * drops the port (`localhost:8080` → `localhost`) and throws on the empty string
 * that source_url defaults to. /data derives the same column from the same
 * expression so the picker's options always match what this filter accepts.
 */
const SOURCE_DOMAIN_RE = String.raw`^https?://(www\.)?`

/** Date inputs are wall-clock dates in IST, matching the app's en-IN display. */
const EXPORT_TZ_OFFSET = "+05:30"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `[]` and `[""]` mean different things and must not be collapsed together.
 * An absent key yields `[]` → null → the filter is off. A present-but-empty
 * value yields `[""]`, which is the "(none)" source domain being deliberately
 * selected (source_url defaults to ''), and has to stay a real filter.
 */
function listParam(searchParams, key) {
  const values = searchParams.getAll(key)
  return values.length > 0 ? values : null
}

export async function GET(request) {
  const user = await getUserOrNull()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get("ids")

  let ids = null
  if (idsParam) {
    /* `.filter(Boolean)` used to sit here, which silently dropped id 0 and
       coerced garbage to NaN — `?ids=abc` returned HTTP 200 and a headers-only
       CSV with no indication anything was wrong. Validate and 400 instead. */
    const raw = idsParam.split(",")
    // Match the digits explicitly rather than trusting Number(): `Number.isInteger`
    // alone accepts 1e20, which then overflows the int4 column and 500s.
    const valid = raw.every((t) => /^\d{1,9}$/.test(t.trim()))
    if (!valid) {
      return Response.json(
        { error: "The ids parameter must be a comma-separated list of positive integers." },
        { status: 400 }
      )
    }
    ids = raw.map((t) => Number(t.trim()))
  }

  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  for (const [name, value] of [["from", fromParam], ["to", toParam]]) {
    if (value && !DATE_RE.test(value)) {
      return Response.json(
        { error: `The ${name} parameter must be a date in YYYY-MM-DD format.` },
        { status: 400 }
      )
    }
  }
  const from = fromParam ? `${fromParam}T00:00:00${EXPORT_TZ_OFFSET}` : null
  const to = toParam ? `${toParam}T00:00:00${EXPORT_TZ_OFFSET}` : null

  const domains = listParam(searchParams, "domain")
  const needs = listParam(searchParams, "need")
  const tags = listParam(searchParams, "tag")
  const columns = resolveExportColumns(listParam(searchParams, "col"))

  /* One query, no branches. Every filter is a bound parameter guarded by an
     IS NULL check, so an absent filter costs a constant-folded TRUE rather than
     a second copy of the SELECT — the previous version duplicated its whole
     query per branch, which does not survive five optional filters.

     The derived columns are computed in an inner select so the domain
     expression is written exactly once and the WHERE clause filters the alias.

     Note a date filter also excludes rows with a NULL created_at (the column is
     nullable, though no such row exists today). With no date filter set, none
     are dropped. */
  const contacts = await sql`
    SELECT * FROM (
      SELECT cu.*,
             split_part(regexp_replace(cu.source_url, ${SOURCE_DOMAIN_RE}, ''), '/', 1) AS source_domain,
             array_to_string(cu.needs, ', ') AS needs_str
      FROM public.contact_us cu
    ) c
    WHERE (${ids}::int[] IS NULL OR c.id = ANY(${ids}))
      AND (${domains}::text[] IS NULL OR c.source_domain = ANY(${domains}))
      AND (${from}::timestamptz IS NULL OR c.created_at >= ${from})
      AND (${to}::timestamptz IS NULL OR c.created_at < ${to}::timestamptz + interval '1 day')
      AND (${needs}::text[] IS NULL OR c.needs && ${needs})
      AND (${tags}::text[] IS NULL OR EXISTS (
            SELECT 1 FROM public.contact_tags t
            WHERE t.contact_id = c.id AND t.tag = ANY(${tags})))
    ORDER BY c.created_at DESC
  `

  const headers = columns.map((column) => column.label)

  function escape(val) {
    if (val == null) return ""
    let s = String(val)
    /* CSV formula injection: a cell whose first character is one of = + - @, or
       a leading tab/CR, is executed as a formula by Excel/Sheets/LibreOffice
       when the file is opened. The payload arrives through the unauthenticated
       intake form and detonates on a staff member's workstation. Prefixing a
       tab neutralises the formula while displaying the original text. */
    if (/^[=+\-@\t\r]/.test(s)) s = "\t" + s
    /* \r added to the quoting triggers: a bare CR is a row terminator to Excel
       and several parsers, so an un-quoted CR silently splits one row into two. */
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  /* Timestamps are deliberately passed through untouched rather than formatted:
     the Date column has always been whatever String() makes of the driver's
     value, and reformatting it here would change every existing export. */
  function toCell(value) {
    if (value == null) return ""
    if (Array.isArray(value)) return value.join(", ")
    if (value instanceof Date) return value
    if (typeof value === "object") return JSON.stringify(value)
    return value
  }

  const rows = contacts.map((c) =>
    columns.map((column) => escape(toCell(c[column.key]))).join(",")
  )

  /* The one read worth auditing: this is contact PII leaving the system. */
  await recordAudit(user, "contact.export", {
    table: "contact_us",
    after: { count: contacts.length, scoped: Boolean(idsParam) },
  })

  /* Leading UTF-8 BOM so Excel reads the file as UTF-8 rather than the local
     ANSI codepage, which otherwise mangles non-ASCII names. */
  const csv = "﻿" + [headers.join(","), ...rows].join("\r\n")
  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
