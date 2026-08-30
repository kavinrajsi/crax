import { sql } from "@/lib/db"
import { DEFAULT_CONTACT_STATUS } from "@/lib/contact-statuses"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"
import {
  challengeResponse,
  verifyLinkedInSignature,
  getAccessToken,
  fetchLeadFormResponse,
  fetchLeadForm,
  formIdFromVersionedUrn,
  mapLinkedInLead,
} from "@/lib/linkedin-leads"

/**
 * LinkedIn Lead Gen Form intake (Lead Sync API). LinkedIn GETs a
 * challengeCode handshake — initially, on subscription creation, and again
 * every ~2 hours; 3 straight failures block the endpoint — then POSTs
 * LEAD_ACTION notifications carrying only the response URN. The answers
 * come from a follow-up fetch, joined against the form definition because
 * answers are keyed by bare numeric questionId.
 *
 * Same conventions as the Facebook webhook route: fail-closed signature
 * check, linkedin_lead_id idempotency, known-email-appends-a-note dedupe,
 * best-effort enrichment, one bad lead never loses the rest of a batch.
 */

function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const challengeCode = searchParams.get("challengeCode")
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!challengeCode || !clientSecret) {
    return Response.json({ error: "Verification failed" }, { status: 403 })
  }
  return Response.json({
    challengeCode,
    challengeResponse: challengeResponse(challengeCode, clientSecret),
  })
}

export async function POST(request) {
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const rawBody = await request.text()

  if (!verifyLinkedInSignature(rawBody, request.headers.get("x-li-signature"), clientSecret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // A single POST may carry one notification object or an array of them.
  const notifications = (Array.isArray(body) ? body : [body]).filter(
    (n) => n?.type === "LEAD_ACTION" && n?.leadAction === "CREATED" && n?.leadGenFormResponse
  )

  for (const notification of notifications) {
    // "urn:li:leadGenFormResponse:abc-123" → "abc-123" (the REST path id)
    const responseId = String(notification.leadGenFormResponse).split(":").pop()
    try {
      const [already] = await sql`SELECT id FROM public.contact_us WHERE linkedin_lead_id = ${responseId} LIMIT 1`
      if (already) continue

      const accountUrn = notification.owner?.sponsoredAccount ?? notification.owner?.organization
      const token = await getAccessToken(accountUrn)
      if (!token) {
        console.error("[linkedin-webhook] no connection for owner", { accountUrn, responseId })
        continue
      }

      const lead = await fetchLeadFormResponse(responseId, token)

      const formId = formIdFromVersionedUrn(lead.versionedLeadGenFormUrn ?? notification.leadGenForm)
      let form = null
      try {
        form = formId ? await fetchLeadForm(formId, token) : null
      } catch (error) {
        // Mapping degrades gracefully without the form (answers land in
        // message unlabeled) — better than dropping the lead.
        console.error("[linkedin-webhook] form fetch failed", { formId, error: String(error?.message ?? error) })
      }

      const { name, email, phone, message } = mapLinkedInLead(lead, form)

      /* message counts here, unlike the Facebook/Google routes: when the
         form fetch fails, ALL answers land unlabeled in message (see the
         degraded path in mapLinkedInLead) and dropping the lead over a
         missing label would lose it entirely. */
      if (!name && !email && !phone && !message) {
        console.error("[linkedin-webhook] lead had no usable fields", { responseId })
        continue
      }

      const accountId = (accountUrn ?? "").split(":").pop() || "unknown"
      const sourceUrl = `https://linkedin.com/leadform/${accountId}/${formId ?? "unknown"}`
      const rawPayload = JSON.stringify({ notification, lead })

      if (email) {
        const [existing] = await sql`SELECT id FROM public.contact_us WHERE email = ${email} LIMIT 1`
        if (existing) {
          if (message) {
            await sql`
              INSERT INTO public.contact_notes (contact_id, author_email, body)
              VALUES (${existing.id}, ${"linkedin-lead-form"}, ${message})
            `
          }
          await sql`UPDATE public.contact_us SET linkedin_lead_id = ${responseId} WHERE id = ${existing.id} AND linkedin_lead_id IS NULL`
          continue
        }
      }

      const [contact] = await sql`
        INSERT INTO public.contact_us
          (name, email, phone, company, message, role, location,
           source_url, ip_address, needs, status, raw_payload, linkedin_lead_id,
           utm_source, utm_medium, utm_campaign, utm_term, utm_content,
           gclid, wbraid, gbraid, fbclid, msclkid)
        VALUES
          (${str(name)}, ${str(email)}, ${str(phone)}, '', ${str(message)}, '', '',
           ${sourceUrl}, '', ${[]}, ${DEFAULT_CONTACT_STATUS}, ${rawPayload}, ${responseId},
           '', '', '', '', '',
           NULL, NULL, NULL, NULL, NULL)
        ON CONFLICT (linkedin_lead_id) WHERE linkedin_lead_id IS NOT NULL DO NOTHING
        RETURNING id
      `
      if (!contact) continue // lost the race to a redelivery

      try {
        await autoLinkCompany(contact.id, email, "")
      } catch (error) {
        console.error("[linkedin-webhook] company enrichment failed", { contactId: contact.id, error })
        await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
          table: "contact_us",
          id: contact.id,
          after: { source: "linkedin-lead-form", email, error: String(error?.message ?? error) },
        })
      }
    } catch (error) {
      console.error("[linkedin-webhook] failed to process lead", { responseId, error })
    }
  }

  return Response.json({ ok: true })
}
