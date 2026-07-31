import { sql } from "@/lib/db"
import { autoLinkCompany } from "@/lib/company-enrichment"

/**
 * Public form intake. The only automated way contacts enter the CRM.
 *
 * Three defects were losing leads here before this rewrite:
 *
 *  1. name, email and phone are NOT NULL with no default, but the route
 *     inserted null for any the caller omitted. Its own validation only
 *     required *one* of the three, so a form collecting name and email — the
 *     common case — passed validation and then threw on the INSERT. The lead
 *     was lost with an unhandled 500 and no log line.
 *  2. The message was written to contact_activities with type 'note', which
 *     the CHECK constraint rejects (call/meeting/email/task/status_change).
 *     Every submission carrying a message therefore created the contact and
 *     then threw, so the caller saw a failure and the message was discarded.
 *     Messages now go to contact_us.message — the column that already existed
 *     for them — and re-submissions append to contact_notes, which has no such
 *     constraint and is what the timeline reads.
 *  3. ip_address, location, role, raw_payload and all ten UTM/click-id columns
 *     existed and were never written by anything, so they were empty on every
 *     row. They are captured now.
 */

/** Trim to a string, never null — the NOT NULL columns have no default. */
function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

/** First public IP from the proxy chain. */
function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? ""
}

function parseNeeds(raw) {
  if (Array.isArray(raw)) return raw.map((n) => String(n).trim()).filter(Boolean)
  if (typeof raw === "string") return raw.split(",").map((n) => n.trim()).filter(Boolean)
  return []
}

export async function POST(request) {
  /* Optional secret auth — deliberately fail-OPEN so live form intake keeps
     working while WEBHOOK_SECRET is being coordinated with the form owner.
     Set WEBHOOK_SECRET in .env.local and in Vercel, then change the condition
     to `if (!secret || header !== secret)` to close it. */
  const secret = process.env.WEBHOOK_SECRET
  const providedSecret = request.headers.get("x-webhook-secret")
  if (!secret) {
    console.error(
      "[SECURITY] WEBHOOK_SECRET is unset — accepting an unauthenticated POST to /api/contacts/submit"
    )
  } else if (providedSecret !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name    = str(body.name)
  const email   = str(body.email).toLowerCase()
  const phone   = str(body.phone)
  const company = str(body.company)
  const message = str(body.message)
  const role    = str(body.role)
  const location = str(body.location)
  const source  = str(body.source) || "webhook"
  // source_url is a URL; `source` is a label. Conflating them is why every
  // existing row shows "webhook" as its source domain.
  const sourceUrl = str(body.source_url) || str(body.page_url) || source
  const needs = parseNeeds(body.needs)

  const utm = {
    source:   str(body.utm_source),
    medium:   str(body.utm_medium),
    campaign: str(body.utm_campaign),
    term:     str(body.utm_term),
    content:  str(body.utm_content),
  }
  const click = {
    gclid:   str(body.gclid)   || null,
    wbraid:  str(body.wbraid)  || null,
    gbraid:  str(body.gbraid)  || null,
    fbclid:  str(body.fbclid)  || null,
    msclkid: str(body.msclkid) || null,
  }

  if (!name && !email && !phone) {
    return Response.json(
      { error: "At least one of name, email, or phone is required" },
      { status: 400 }
    )
  }

  try {
    // Rate-limit: same email within 60 seconds is treated as a duplicate.
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

    // Known email: append the message rather than creating a second contact.
    if (email) {
      const [existing] = await sql`SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1`
      if (existing) {
        if (message) {
          await sql`
            INSERT INTO public.contact_notes (contact_id, author_email, body)
            VALUES (${existing.id}, ${"form:" + source}, ${message})
          `
        }
        return Response.json({ ok: true, contactId: existing.id, isNew: false })
      }
    }

    const [contact] = await sql`
      INSERT INTO public.contact_us
        (name, email, phone, company, message, role, location,
         source_url, ip_address, needs, status, raw_payload,
         utm_source, utm_medium, utm_campaign, utm_term, utm_content,
         gclid, wbraid, gbraid, fbclid, msclkid)
      VALUES
        (${name}, ${email}, ${phone}, ${company}, ${message}, ${role}, ${location},
         ${sourceUrl}, ${clientIp(request)}, ${needs}, 'New', ${JSON.stringify(body)},
         ${utm.source}, ${utm.medium}, ${utm.campaign}, ${utm.term}, ${utm.content},
         ${click.gclid}, ${click.wbraid}, ${click.gbraid}, ${click.fbclid}, ${click.msclkid})
      RETURNING id
    `

    // Enrichment is best-effort: a failure here must not lose the lead that is
    // already safely stored.
    try {
      await autoLinkCompany(contact.id, email, company)
    } catch (error) {
      console.error("[submit] company enrichment failed", { contactId: contact.id, error })
    }

    return Response.json({ ok: true, contactId: contact.id, isNew: true })
  } catch (error) {
    // Previously this threw uncaught: the caller got a 500 with no detail and
    // nothing was written to the log, so lost leads were invisible.
    console.error("[submit] failed to record submission", { email, source, error })
    return Response.json({ error: "Could not record submission" }, { status: 500 })
  }
}
