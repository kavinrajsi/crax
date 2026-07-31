import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"

export async function GET(request) {
  if (!(await getUserOrNull())) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get("ids")

  let contacts
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
    const ids = raw.map((t) => Number(t.trim()))
    contacts = await sql`
      SELECT id, name, email, phone, company, source_url, status,
             array_to_string(needs, ', ') AS needs_str, created_at
      FROM public.contact_us
      WHERE id = ANY(${ids}) AND email != ALL(${EXCLUDED_EMAILS})
      ORDER BY created_at DESC
    `
  } else {
    contacts = await sql`
      SELECT id, name, email, phone, company, source_url, status,
             array_to_string(needs, ', ') AS needs_str, created_at
      FROM public.contact_us
      WHERE email != ALL(${EXCLUDED_EMAILS})
      ORDER BY created_at DESC
    `
  }

  const headers = ["ID", "Name", "Email", "Phone", "Company", "Source URL", "Status", "Needs", "Date"]

  function escape(val) {
    if (val == null) return ""
    const s = String(val)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = contacts.map(c =>
    [c.id, c.name, c.email, c.phone, c.company, c.source_url, c.status, c.needs_str, c.created_at]
      .map(escape)
      .join(",")
  )

  const csv = [headers.join(","), ...rows].join("\n")
  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
