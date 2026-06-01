import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get("ids")

  let contacts
  if (idsParam) {
    const ids = idsParam.split(",").map(Number).filter(Boolean)
    contacts = await sql`
      SELECT id, name, email, phone, company, source_url, status,
             array_to_string(needs, ', ') AS needs_str, created_at
      FROM public.contact_us
      WHERE id = ANY(${ids})
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
