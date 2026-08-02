import { sql } from "@/lib/db"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"
import { mapGoogleLead, verifyGoogleKey } from "@/lib/google-leads"

/**
 * Google Ads lead form intake. Configured per lead form asset in the Google
 * Ads UI (Lead delivery → Webhook): URL is this route, key is
 * GOOGLE_LEADS_WEBHOOK_KEY. Google POSTs the complete lead inline — unlike
 * the Facebook route there is no follow-up API fetch, so this is the whole
 * pipeline in one handler.
 *
 * Mirrors src/app/api/facebook/webhook/route.js's conventions: fail-closed
 * auth, google_lead_id idempotency (SELECT guard + partial-unique-index
 * ON CONFLICT), known-email-appends-a-note dedupe, best-effort enrichment.
 */

function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!verifyGoogleKey(body.google_key, process.env.GOOGLE_LEADS_WEBHOOK_KEY)) {
    return Response.json({ error: "Invalid key" }, { status: 401 })
  }

  const leadId = str(body.lead_id)
  if (!leadId) {
    return Response.json({ error: "Missing lead_id" }, { status: 400 })
  }

  try {
    // Already processed — Google can redeliver the same lead.
    const [already] = await sql`SELECT id FROM public.contact_us WHERE google_lead_id = ${leadId} LIMIT 1`
    if (already) return Response.json({ ok: true, contactId: already.id, duplicate: true })

    const { name, email, phone, message } = mapGoogleLead(body.user_column_data)

    if (!name && !email && !phone) {
      console.error("[google-webhook] lead had no usable name/email/phone", { leadId })
      return Response.json({ ok: true, skipped: true })
    }

    const sourceUrl = `https://ads.google.com/leadform/${str(body.campaign_id)}/${str(body.form_id)}`
    const gclid = str(body.gclid) || null
    const rawPayload = JSON.stringify(body)

    // Known email: append the message rather than creating a second
    // contact — same convention as the Facebook and submit routes.
    if (email) {
      const [existing] = await sql`SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1`
      if (existing) {
        if (message) {
          await sql`
            INSERT INTO public.contact_notes (contact_id, author_email, body)
            VALUES (${existing.id}, ${"google-lead-form"}, ${message})
          `
        }
        await sql`UPDATE public.contact_us SET google_lead_id = ${leadId} WHERE id = ${existing.id} AND google_lead_id IS NULL`
        return Response.json({ ok: true, contactId: existing.id, isNew: false })
      }
    }

    const [contact] = await sql`
      INSERT INTO public.contact_us
        (name, email, phone, company, message, role, location,
         source_url, ip_address, needs, status, raw_payload, google_lead_id,
         utm_source, utm_medium, utm_campaign, utm_term, utm_content,
         gclid, wbraid, gbraid, fbclid, msclkid)
      VALUES
        (${str(name)}, ${str(email)}, ${str(phone)}, '', ${str(message)}, '', '',
         ${sourceUrl}, '', ${[]}, 'New', ${rawPayload}, ${leadId},
         '', '', '', '', '',
         ${gclid}, NULL, NULL, NULL, NULL)
      ON CONFLICT (google_lead_id) WHERE google_lead_id IS NOT NULL DO NOTHING
      RETURNING id
    `
    if (!contact) return Response.json({ ok: true, duplicate: true }) // lost the race to a redelivery

    try {
      await autoLinkCompany(contact.id, email, "")
    } catch (error) {
      console.error("[google-webhook] company enrichment failed", { contactId: contact.id, error })
      await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
        table: "contact_us",
        id: contact.id,
        after: { source: "google-lead-form", email, error: String(error?.message ?? error) },
      })
    }

    return Response.json({ ok: true, contactId: contact.id, isNew: true })
  } catch (error) {
    console.error("[google-webhook] failed to record lead", { leadId, error })
    return Response.json({ error: "Could not record lead" }, { status: 500 })
  }
}
