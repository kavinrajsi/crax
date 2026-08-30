import crypto from "node:crypto"
import { sql } from "@/lib/db"
import { DEFAULT_CONTACT_STATUS } from "@/lib/contact-statuses"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"

/* Abuse limits for the one public, unauthenticated write path. A browser form
   cannot hold a shared secret, so the real controls here are size caps — a
   distributed per-IP rate limit needs a shared store (KV/Upstash) and is
   tracked separately. */
const MAX_BODY_BYTES = 64 * 1024      // whole request body
const MAX_RAW_PAYLOAD_BYTES = 16 * 1024 // what we persist to raw_payload

/** Constant-time header-secret compare — avoids leaking the secret by timing. */
function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided ?? ""))
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

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

/**
 * Reads a tracking value from whichever shape the posting form uses.
 *
 * Two forms post here and they do not agree. The flat shape puts everything at
 * the top level; the `seomart-audit` form on searchmadarth.com nests it:
 *
 *   { gclid: "...", utm_source: "google" }                        flat
 *   { tracking: { gclid: "...", utmSource: "google",              nested
 *                 params: { gclid: "...", utm_source: "google" } } }
 *
 * Reading only `body.gclid` discarded the click ID on every nested submission —
 * four leads (ids 116, 117, 118, 121) arrived with a real Google click ID and
 * it was dropped. The value survived only inside raw_payload, which nothing
 * queries.
 *
 * Precedence is most-explicit-first: a form that deliberately sets a top-level
 * field overrides its own tracking blob, and `tracking.params` comes last
 * because it is a raw dump of the query string rather than a considered value.
 *
 * @param {object} body
 * @param {string} snake  the flat/params name, e.g. "utm_source"
 * @param {string} [camel] the tracking.* name when it differs, e.g. "utmSource"
 */
function tracked(body, snake, camel = snake) {
  const tracking = body?.tracking
  const params = tracking?.params
  return (
    str(body?.[snake]) ||
    str(tracking?.[camel]) ||
    str(tracking?.[snake]) ||
    str(params?.[snake]) ||
    ""
  )
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
  } else if (!secretMatches(providedSecret, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  /* Read raw text so we can cap the size before parsing — request.json() would
     buffer an arbitrarily large body first. Content-Length can lie or be
     absent, so the byte length of what we actually read is the real check. */
  const rawText = await request.text()
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 })
  }

  let body
  try {
    body = JSON.parse(rawText)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
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
  /* tracking.pageUrl is where the nested form puts it. Without it a nested
     submission falls through to `source` and every one of them records
     "webhook" as its source domain — the same conflation the comment above
     describes, arriving by a different route. */
  const sourceUrl =
    str(body.source_url) ||
    str(body.page_url) ||
    str(body.tracking?.pageUrl) ||
    str(body.tracking?.page_url) ||
    source
  const needs = parseNeeds(body.needs)

  /* camelCase second argument only where tracking.* spells it differently. */
  const utm = {
    source:   tracked(body, "utm_source", "utmSource"),
    medium:   tracked(body, "utm_medium", "utmMedium"),
    campaign: tracked(body, "utm_campaign", "utmCampaign"),
    term:     tracked(body, "utm_term", "utmTerm"),
    content:  tracked(body, "utm_content", "utmContent"),
  }
  /* Click IDs are nullable, unlike the UTM columns which are NOT NULL DEFAULT
     '' — so an absent one is null rather than an empty string. Keeping that
     distinction is what makes "no click ID" queryable as IS NULL. */
  const click = {
    gclid:   tracked(body, "gclid")   || null,
    wbraid:  tracked(body, "wbraid")  || null,
    gbraid:  tracked(body, "gbraid")  || null,
    fbclid:  tracked(body, "fbclid")  || null,
    msclkid: tracked(body, "msclkid") || null,
  }

  if (!name && !email && !phone) {
    return Response.json(
      { error: "At least one of name, email, or phone is required" },
      { status: 400 }
    )
  }

  /* Persist the submitted body for debugging, but never let an attacker use it
     as unbounded storage. Over the cap, store a marker instead of the blob. */
  const rawPayloadJson = JSON.stringify(body)
  const rawPayload =
    Buffer.byteLength(rawPayloadJson, "utf8") > MAX_RAW_PAYLOAD_BYTES
      ? JSON.stringify({ truncated: true, bytes: Buffer.byteLength(rawPayloadJson, "utf8") })
      : rawPayloadJson

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
         ${sourceUrl}, ${clientIp(request)}, ${needs}, ${DEFAULT_CONTACT_STATUS}, ${rawPayload},
         ${utm.source}, ${utm.medium}, ${utm.campaign}, ${utm.term}, ${utm.content},
         ${click.gclid}, ${click.wbraid}, ${click.gbraid}, ${click.fbclid}, ${click.msclkid})
      RETURNING id
    `

    /* Enrichment is best-effort: a failure here must not lose the lead that is
       already safely stored. It is also audited, because for two months it
       failed on every lead and console.error was the only trace — Vercel keeps
       runtime logs for a short window, so by the time anyone noticed the
       companies table was empty the reason was unrecoverable. recordAudit
       swallows its own errors, so this cannot itself break intake. */
    try {
      await autoLinkCompany(contact.id, email, company)
    } catch (error) {
      console.error("[submit] company enrichment failed", { contactId: contact.id, error })
      await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
        table: "contact_us",
        id: contact.id,
        after: { source: "submit", email, company, error: String(error?.message ?? error) },
      })
    }

    return Response.json({ ok: true, contactId: contact.id, isNew: true })
  } catch (error) {
    // Previously this threw uncaught: the caller got a 500 with no detail and
    // nothing was written to the log, so lost leads were invisible.
    console.error("[submit] failed to record submission", { email, source, error })
    return Response.json({ error: "Could not record submission" }, { status: 500 })
  }
}
