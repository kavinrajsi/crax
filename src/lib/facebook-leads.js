import crypto from "node:crypto"
import { sql } from "@/lib/db"

/**
 * Facebook Lead Ads helpers — fetching, mapping, and verifying webhook
 * signatures for leads pulled via the Graph API.
 */

export const GRAPH_API_VERSION = "v21.0"

/** How long to wait on the Graph API before giving up on a lead fetch. Same
 * timeout convention as src/lib/company-enrichment.js's isDomainLive(). */
const FETCH_TIMEOUT_MS = 8000

/**
 * Fetches the full lead object — field_data plus ad/campaign/form context —
 * for a leadgen_id. The webhook POST body only ever contains the ID; the
 * answers themselves live behind this call.
 */
export async function fetchLeadFields(leadgenId, accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?fields=field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,created_time,platform&access_token=${accessToken}`
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
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
  return connection?.access_token ?? process.env.FB_PAGE_ACCESS_TOKEN
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
