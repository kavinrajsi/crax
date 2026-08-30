import crypto from "node:crypto"
import { sql } from "@/lib/db"
import { DEFAULT_CONTACT_STATUS } from "@/lib/contact-statuses"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"
import { decryptToken } from "@/lib/token-crypto"

/**
 * Facebook Lead Ads helpers — fetching, mapping, and verifying webhook
 * signatures for leads pulled via the Graph API.
 */

export const GRAPH_API_VERSION = "v21.0"

/** How long to wait on the Graph API before giving up on a lead fetch. Same
 * timeout convention as src/lib/company-enrichment.js's isDomainLive(). */
const FETCH_TIMEOUT_MS = 8000

/**
 * Ceiling on how many `paging.next` hops a single walk will follow. Meta's
 * cursors are supposed to terminate, but a bad cursor that returns itself
 * would otherwise spin the route until the platform timeout kills it with
 * nothing written to show for the work.
 */
const MAX_PAGES = 100

/**
 * Fetches the full lead object — field_data plus ad/campaign/form context —
 * for a leadgen_id. The webhook POST body only ever contains the ID; the
 * answers themselves live behind this call.
 */
export async function fetchLeadFields(leadgenId, accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}?fields=field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,created_time,platform`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Graph API responded ${response.status} for leadgen_id ${leadgenId}`)
  }
  return response.json()
}

/**
 * Maps Meta's field_data (an array of {name, values: [value]}) to the shape
 * submit/route.js expects. Standard question keys are fixed by Meta; custom
 * questions vary per form, so unmatched answers fall through into `message`
 * rather than being dropped — same "don't lose the lead" instinct as the
 * substring matching in csv-import-dialog.js's guessMapping().
 */
export function mapLeadFields(fieldData = []) {
  let firstName = ""
  let lastName = ""
  const mapped = { name: "", email: "", phone: "" }
  const extra = []

  for (const { name, values } of fieldData) {
    const value = (values?.[0] ?? "").trim()
    if (!value) continue
    const key = name.toLowerCase()

    if (key === "full_name" || key === "name") mapped.name = value
    else if (key === "first_name") firstName = value
    else if (key === "last_name") lastName = value
    else if (key.includes("email")) mapped.email = value.toLowerCase()
    else if (key.includes("phone")) mapped.phone = value
    else extra.push(`${name}: ${value}`)
  }

  if (!mapped.name && (firstName || lastName)) {
    mapped.name = [firstName, lastName].filter(Boolean).join(" ")
  }
  mapped.message = extra.join("\n")

  return mapped
}

/**
 * One Graph GET, JSON out. Kept private: every public caller below wants the
 * same timeout and the same "throw with the status in the message" failure,
 * and the OAuth callback already has its own copy for the token exchange.
 */
async function graphFetch(url, what, accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    const body = await response.text()
    // Meta puts the useful part (error.code / error_user_msg) in the body —
    // logged rather than thrown, since the message reaches HTTP clients.
    console.error("[facebook-leads] graph request failed", { what, status: response.status, body })
    throw new Error(`Graph API responded ${response.status} for ${what}`)
  }
  return response.json()
}

/**
 * Follows Meta's cursor pagination (`paging.next` is a complete URL, access
 * token already embedded) and concatenates every page's `data` array.
 *
 * Deliberately eager rather than a generator: callers here write each batch
 * to Postgres anyway, and the page counts involved (a form's leads, a Page's
 * forms) are small enough that holding them is cheaper than the ceremony.
 */
async function graphFetchAll(firstUrl, what, accessToken) {
  const items = []
  let url = firstUrl

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const body = await graphFetch(url, what, accessToken)
    items.push(...(body.data ?? []))
    /* paging.next carries the token in the query only when the first request
       did; we now send it as a header, so the token is passed to each page
       explicitly instead of riding along in the URL. */
    url = body.paging?.next ?? null
  }

  // Not an error — just the only honest thing to report when the walk stops
  // early. Callers surface it so a partial backfill never reads as complete.
  return { items, truncated: Boolean(url) }
}

/** Every Page connected through Profile → Integrations, newest first. */
export async function listConnectedPages() {
  const rows = await sql`
    SELECT page_id, page_name, access_token
    FROM public.facebook_page_connections
    ORDER BY created_at DESC
  `
  return rows.map((r) => ({ ...r, access_token: decryptToken(r.access_token) }))
}

/**
 * Every lead form ever created on a Page, including archived ones — an
 * archived form still holds the leads it collected while it ran, so
 * filtering by status here would silently drop history.
 */
export async function fetchLeadForms(pageId, accessToken) {
  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/leadgen_forms` +
    `?fields=id,name,status,leads_count,created_time&limit=100`
  return graphFetchAll(url, `leadgen_forms of page ${pageId}`, accessToken)
}

/**
 * Every lead a form still holds, oldest cursor first.
 *
 * Meta only retains lead answers for 90 days, so this is "everything the API
 * will admit to", not "everything the form ever collected" — leads older
 * than that are gone and no endpoint can bring them back.
 *
 * Same `fields` list as fetchLeadFields() so both intake paths store the same
 * raw_payload shape, with `id` added: the single-lead fetch is keyed by the
 * id it was given, this one has to read it off each row.
 */
export async function fetchFormLeads(formId, accessToken) {
  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(formId)}/leads` +
    `?fields=id,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,created_time,platform` +
    `&limit=100`
  return graphFetchAll(url, `leads of form ${formId}`, accessToken)
}

/** Trims to a string, mapping null/undefined to "" — the INSERT below has no nullable text columns. */
function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

/**
 * Writes one Facebook lead into contact_us. The single source of truth for
 * "what a Facebook lead becomes" — the webhook and the backfill both call
 * this, so historical and live leads land identically (same dedupe, same
 * enrichment, same raw_payload shape).
 *
 * `lead` is the Graph object; the ids are passed separately because the
 * webhook learns them from the change notification while the backfill reads
 * them off the row and the form it was walking.
 *
 * Returns a discriminated result rather than throwing on the ordinary
 * outcomes — same case set as the Google webhook's JSON responses:
 *   { skipped: true }            no usable name/email/phone
 *   { duplicate: true }          fb_lead_id already recorded
 *   { isNew: false, contactId }  matched an existing contact by email
 *   { isNew: true, contactId }   inserted
 */
export async function upsertFacebookLead(lead, { leadgenId, pageId, formId }) {
  // Already processed — Meta retries delivery on anything but a fast 200,
  // and a backfill re-run walks leads the webhook already took.
  const [already] = await sql`SELECT id FROM public.contact_us WHERE fb_lead_id = ${leadgenId} LIMIT 1`
  if (already) return { duplicate: true, contactId: already.id }

  const { name, email, phone, message } = mapLeadFields(lead.field_data)
  if (!name && !email && !phone) return { skipped: true }

  const sourceUrl = `https://facebook.com/${pageId}/leads/${formId}`
  const rawPayload = JSON.stringify({ ...lead, leadgen_id: leadgenId, page_id: pageId })

  // Known email: append the message rather than creating a second contact —
  // same convention as submit/route.js.
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
      return { isNew: false, contactId: existing.id }
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
       ${sourceUrl}, '', ${[]}, ${DEFAULT_CONTACT_STATUS}, ${rawPayload}, ${leadgenId},
       '', '', '', '', '',
       NULL, NULL, NULL, NULL, NULL)
    ON CONFLICT (fb_lead_id) WHERE fb_lead_id IS NOT NULL DO NOTHING
    RETURNING id
  `
  if (!contact) return { duplicate: true } // lost the race to a concurrent retry

  try {
    await autoLinkCompany(contact.id, email, "")
  } catch (error) {
    console.error("[facebook-leads] company enrichment failed", { contactId: contact.id, error })
    await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
      table: "contact_us",
      id: contact.id,
      after: { source: "facebook-lead-ads", email, error: String(error?.message ?? error) },
    })
  }

  return { isNew: true, contactId: contact.id }
}

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body.
 * Must run against the raw bytes, before any JSON.parse — a re-serialized
 * body will not reproduce the same signature.
 */
export function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader?.startsWith("sha256=")) return false
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  const provided = signatureHeader.slice("sha256=".length)
  const expectedBuf = Buffer.from(expected, "hex")
  const providedBuf = Buffer.from(provided, "hex")
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Resolves the Page Access Token to use for a given Page.
 *
 * Prefers a token connected via OAuth (Profile → Integrations,
 * facebook_page_connections) over the single manually-generated
 * FB_PAGE_ACCESS_TOKEN env var, so Pages connected that way don't need the
 * env var touched. Falls back to the env var for any Page that hasn't been
 * connected — keeps the original manual-token setup working unchanged.
 */
export async function getPageAccessToken(pageId) {
  const [connection] = await sql`
    SELECT access_token FROM public.facebook_page_connections WHERE page_id = ${pageId} LIMIT 1
  `
  return connection?.access_token
    ? decryptToken(connection.access_token)
    : process.env.FB_PAGE_ACCESS_TOKEN
}

/* createOAuthState/readOAuthState/htmlRedirect moved to src/lib/oauth-flow.js
   when LinkedIn became the second OAuth-connect flow — shared there now. */

/**
 * Verifies and decodes Meta's `signed_request` — the format Meta POSTs to
 * the deauthorize and data-deletion callbacks (`<sig>.<payload>`, both
 * base64url, signature is HMAC-SHA256 of the payload segment). Not the same
 * shape as the leadgen webhook's X-Hub-Signature-256 header, so it needs its
 * own parser rather than reusing verifySignature() above.
 *
 * Returns the decoded payload (contains `user_id`) or null if the signature
 * doesn't check out.
 */
export function parseSignedRequest(signedRequest, appSecret) {
  const parts = signedRequest?.split(".") ?? []
  if (parts.length !== 2) return null
  const [encodedSig, encodedPayload] = parts

  let sigBuf, expectedBuf
  try {
    sigBuf = Buffer.from(encodedSig, "base64url")
    expectedBuf = crypto.createHmac("sha256", appSecret).update(encodedPayload).digest()
  } catch {
    return null
  }
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    return payload.algorithm === "HMAC-SHA256" ? payload : null
  } catch {
    return null
  }
}
