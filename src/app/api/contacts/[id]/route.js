import { sql } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"

export async function GET(request, { params }) {
  if (!(await getUserOrNull())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: contactId } = await params
  // The column is an integer; anything else would blow up in the driver.
  if (!/^\d+$/.test(contactId)) {
    return Response.json({ error: "Not Found" }, { status: 404 })
  }

  const [notes, tags] = await Promise.all([
    sql`SELECT * FROM public.contact_notes WHERE contact_id = ${contactId} ORDER BY created_at ASC`,
    sql`SELECT * FROM public.contact_tags WHERE contact_id = ${contactId} ORDER BY created_at ASC`,
  ])

  return Response.json({ notes, tags })
}
