import { sql } from "@/lib/db"
import { evaluateRules } from "@/lib/automation"
import { autoLinkCompany } from "@/lib/company-enrichment"

export async function POST(request) {
  // Optional secret auth
  const secret = process.env.WEBHOOK_SECRET
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name    = body.name?.trim()    || null
  const email   = body.email?.trim()?.toLowerCase() || null
  const phone   = body.phone?.trim()   || null
  const company = body.company?.trim() || null
  const message = body.message?.trim() || null
  const source  = body.source?.trim()  || "webhook"

  let needs = []
  if (Array.isArray(body.needs)) needs = body.needs.map((n) => String(n).trim()).filter(Boolean)
  else if (typeof body.needs === "string") needs = body.needs.split(",").map((n) => n.trim()).filter(Boolean)

  if (!name && !email && !phone) {
    return Response.json({ error: "At least one of name, email, or phone is required" }, { status: 400 })
  }

  // Rate-limit: reject same email if submitted in last 60 seconds
  if (email) {
    const [recent] = await sql`
      SELECT id FROM public.contact_us
      WHERE email = ${email} AND created_at > NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `
    if (recent) {
      return Response.json({ ok: true, contactId: recent.id, isNew: false, duplicate: true })
    }
  }

  let contactId = null
  let isNew = false

  // If email already exists, log re-submission as timeline note
  if (email) {
    const [existing] = await sql`SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1`
    if (existing) {
      contactId = existing.id
      if (message) {
        await sql`
          INSERT INTO public.contact_activities
            (contact_id, author_email, type, title, body, completed_at)
          VALUES
            (${contactId}, 'webhook', 'note',
             ${"Re-submitted via " + source}, ${message}, NOW())
        `
      }
    }
  }

  if (!contactId) {
    const [contact] = await sql`
      INSERT INTO public.contact_us
        (name, email, phone, company, source_url, needs, status)
      VALUES
        (${name}, ${email}, ${phone}, ${company}, ${source}, ${needs}, 'New')
      RETURNING id
    `
    contactId = contact.id
    isNew = true

    if (message) {
      await sql`
        INSERT INTO public.contact_activities
          (contact_id, author_email, type, title, body, completed_at)
        VALUES
          (${contactId}, 'webhook', 'note',
           ${"Form submission via " + source}, ${message}, NOW())
      `
    }

    await autoLinkCompany(contactId, email, company)
    await evaluateRules("contact_created", { contactId })
  }

  return Response.json({ ok: true, contactId, isNew })
}
