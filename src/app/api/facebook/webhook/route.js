import crypto from "node:crypto"
import { verifySignature, getPageAccessToken, fetchLeadFields, upsertFacebookLead } from "@/lib/facebook-leads"

/** Constant-time string compare; false on any length/format mismatch. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""))
  const bufB = Buffer.from(String(b ?? ""))
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Facebook Lead Ads intake. Meta calls GET once to verify the endpoint, then
 * POSTs a leadgen_id (never the answers themselves) on every new lead —
 * see src/lib/facebook-leads.js for the Graph API fetch that resolves it.
 *
 * This handler is only the transport: signature check, unwrap the batch,
 * resolve each id. The write itself lives in upsertFacebookLead() so that
 * src/app/api/facebook/backfill/route.js produces byte-identical contacts
 * from historical leads.
 *
 * The signature check fails CLOSED, unlike the optional shared secret in
 * src/app/api/contacts/submit/route.js — Meta signs every call, so there is
 * no "coordinating the secret with a form owner" grace period to design
 * around.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN
  if (mode === "subscribe" && verifyToken && safeEqual(token, verifyToken) && challenge) {
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
      // Prefers a Page connected via OAuth (Profile → Integrations) over the
      // manually-set FB_PAGE_ACCESS_TOKEN — see getPageAccessToken()'s doc.
      const accessToken = await getPageAccessToken(pageId)
      const lead = await fetchLeadFields(leadgenId, accessToken)
      const result = await upsertFacebookLead(lead, { leadgenId, pageId, formId })

      if (result.skipped) {
        console.error("[facebook-webhook] lead had no usable name/email/phone", { leadgenId })
      }
    } catch (error) {
      // One bad lead in a batch must not lose the rest.
      console.error("[facebook-webhook] failed to process lead", { leadgenId, error })
    }
  }

  return Response.json({ ok: true })
}
