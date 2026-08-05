import { verifyGoogleKey, upsertGoogleLead } from "@/lib/google-leads"

/**
 * Google Ads lead form intake. Configured per lead form asset in the Google
 * Ads UI (Lead delivery → Webhook): URL is this route, key is
 * GOOGLE_LEADS_WEBHOOK_KEY. Google POSTs the complete lead inline — unlike
 * the Facebook route there is no follow-up API fetch.
 *
 * This handler is only the transport: key check, unwrap, hand off. The write
 * lives in upsertGoogleLead() so src/app/api/google/backfill/route.js
 * produces identical contacts from historical submissions.
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
    const result = await upsertGoogleLead({
      leadId,
      userColumnData: body.user_column_data,
      campaignId: str(body.campaign_id),
      formId: str(body.form_id),
      gclid: str(body.gclid),
      rawPayload: JSON.stringify(body),
    })

    if (result.skipped) {
      console.error("[google-webhook] lead had no usable name/email/phone", { leadId })
    }

    return Response.json({ ok: true, ...result })
  } catch (error) {
    console.error("[google-webhook] failed to record lead", { leadId, error })
    return Response.json({ error: "Could not record lead" }, { status: 500 })
  }
}
