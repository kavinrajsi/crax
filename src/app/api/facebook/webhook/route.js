import { sql } from "@/lib/db"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"
import { fetchLeadFields, mapLeadFields, verifySignature, getPageAccessToken } from "@/lib/facebook-leads"

/**
 * Facebook Lead Ads intake. Meta calls GET once to verify the endpoint, then
 * POSTs a leadgen_id (never the answers themselves) on every new lead —
 * see src/lib/facebook-leads.js for the Graph API fetch that resolves it.
 *
 * Mirrors src/app/api/contacts/submit/route.js's shape (same INSERT columns,
 * same best-effort enrichment, same known-email-appends-a-note dedupe) with
 * two differences: the signature check fails CLOSED (Meta signs every call,
 * so there's no "coordinating the secret with a form owner" grace period to
 * design around), and fb_lead_id gives a second, stronger idempotency guard
 * against Meta's webhook retries re-delivering the same lead.
 */

function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN
  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return Response.json({ error: "Verification failed" }, { status: 403 })
}

export async function POST(request) {
  const appSecret = process.env.FB_APP_SECRET
  const rawBody = await request.text()

  // Unlike submit/route.js's optional shared secret, this fails CLOSED: Meta
  // signs every call with the app secret, so there is no unauthenticated
  // path to leave open while credentials are being set up.
  if (!appSecret || !verifySignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const leadgenChanges = (body.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .filter((change) => change.field === "leadgen")
    .map((change) => change.value)

  for (const { leadgen_id: leadgenId, form_id: formId, page_id: pageId } of leadgenChanges) {
    try {
      // Already processed — Meta retries delivery on anything but a fast 200.
      const [already] = await sql`SELECT id FROM public.contact_us WHERE fb_lead_id = ${leadgenId} LIMIT 1`
      if (already) continue

      // Prefers a Page connected via OAuth (Profile → Integrations) over the
      // manually-set FB_PAGE_ACCESS_TOKEN — see getPageAccessToken()'s doc.
      const accessToken = await getPageAccessToken(pageId)
      const lead = await fetchLeadFields(leadgenId, accessToken)
      const { name, email, phone, message } = mapLeadFields(lead.field_data)

      if (!name && !email && !phone) {
        console.error("[facebook-webhook] lead had no usable name/email/phone", { leadgenId })
        continue
      }

      const sourceUrl = `https://facebook.com/${pageId}/leads/${formId}`
      const rawPayload = JSON.stringify({ ...lead, leadgen_id: leadgenId, page_id: pageId })

      // Known email: append the message rather than creating a second
      // contact — same convention as submit/route.js.
      if (email) {
        const [existing] = await sql`SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1`
        if (existing) {
          if (message) {
            await sql`
              INSERT INTO public.contact_notes (contact_id, author_email, body)
              VALUES (${existing.id}, ${"facebook-lead-ads"}, ${message})
            `
          }
          await sql`UPDATE public.contact_us SET fb_lead_id = ${leadgenId} WHERE id = ${existing.id} AND fb_lead_id IS NULL`
          continue
        }
      }

      const [contact] = await sql`
        INSERT INTO public.contact_us
          (name, email, phone, company, message, role, location,
           source_url, ip_address, needs, status, raw_payload, fb_lead_id,
           utm_source, utm_medium, utm_campaign, utm_term, utm_content,
           gclid, wbraid, gbraid, fbclid, msclkid)
        VALUES
          (${str(name)}, ${str(email)}, ${str(phone)}, '', ${str(message)}, '', '',
           ${sourceUrl}, '', ${[]}, 'New', ${rawPayload}, ${leadgenId},
           '', '', '', '', '',
           NULL, NULL, NULL, NULL, NULL)
        ON CONFLICT (fb_lead_id) WHERE fb_lead_id IS NOT NULL DO NOTHING
        RETURNING id
      `
      if (!contact) continue // lost the race to a concurrent retry

      try {
        await autoLinkCompany(contact.id, email, "")
      } catch (error) {
        console.error("[facebook-webhook] company enrichment failed", { contactId: contact.id, error })
        await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
          table: "contact_us",
          id: contact.id,
          after: { source: "facebook-lead-ads", email, error: String(error?.message ?? error) },
        })
      }
    } catch (error) {
      // One bad lead in a batch must not lose the rest.
      console.error("[facebook-webhook] failed to process lead", { leadgenId, error })
    }
  }

  return Response.json({ ok: true })
}
