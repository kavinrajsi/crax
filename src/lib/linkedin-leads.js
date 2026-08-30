import crypto from "node:crypto"
import { sql } from "@/lib/db"
import { encryptToken, decryptToken } from "@/lib/token-crypto"

/**
 * LinkedIn Lead Gen Form helpers (Lead Sync API). Shapes verified against
 * the Microsoft Learn docs on 2026-08-03:
 * https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync
 * https://learn.microsoft.com/en-us/linkedin/shared/api-guide/webhook-validation
 *
 * Architecture matches facebook-leads.js (webhook notifies with an ID, a
 * follow-up fetch gets the answers) with two LinkedIn-specific twists:
 * answers are keyed by numeric questionId whose meaning (FIRST_NAME, EMAIL…)
 * lives in the *form definition*, so mapping needs the form too; and tokens
 * expire (~60d access / ~365d refresh), so getAccessToken() refreshes.
 */

/** LinkedIn versions the Marketing API monthly (Linkedin-Version: YYYYMM). */
export const LINKEDIN_API_VERSION = "202606"

const FETCH_TIMEOUT_MS = 8000

/** Standard REST headers every /rest/* call needs. */
function restHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Linkedin-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  }
}

async function restFetch(url, token) {
  const response = await fetch(url, {
    headers: restHeaders(token),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message ?? `LinkedIn API responded ${response.status} for ${url}`)
  }
  return data
}

/**
 * Webhook validation handshake: LinkedIn GETs ?challengeCode=… and expects
 * {challengeCode, challengeResponse} back, where challengeResponse is the
 * lowercase-hex HMAC-SHA256 of the challengeCode keyed by the client secret.
 * Re-validated every ~2 hours; 3 straight failures block the endpoint.
 */
export function challengeResponse(challengeCode, clientSecret) {
  return crypto.createHmac("sha256", clientSecret).update(challengeCode).digest("hex")
}

/**
 * Verifies the X-LI-Signature header on webhook POSTs. Per the docs, the
 * string-to-sign is the literal prefix "hmacsha256=" + the RAW body, keyed
 * by the client secret; the header carries only the bare lowercase-hex
 * digest (the prefix is NOT in the header). Must run on the body exactly as
 * received — re-serialized JSON won't reproduce the signature.
 */
export function verifyLinkedInSignature(rawBody, signatureHeader, clientSecret) {
  if (!clientSecret || !signatureHeader) return false
  const expected = crypto
    .createHmac("sha256", clientSecret)
    .update("hmacsha256=" + rawBody, "utf8")
    .digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  let providedBuf
  try {
    providedBuf = Buffer.from(signatureHeader.trim(), "hex")
  } catch {
    return false
  }
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/** Refresh when the stored access token is within 7 days of expiring. */
const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Access token for a sponsored account, refreshing if near expiry — the
 * piece with no Facebook equivalent (Meta's page tokens are long-lived;
 * LinkedIn's member tokens are not). Falls back to returning the stored
 * token as-is if the refresh fails: a soon-to-expire token beats none.
 */
export async function getAccessToken(accountUrn) {
  const [conn] = await sql`
    SELECT id, access_token, refresh_token, expires_at
    FROM public.linkedin_connections WHERE account_urn = ${accountUrn} LIMIT 1
  `
  if (!conn) return null

  const storedAccess = decryptToken(conn.access_token)
  const storedRefresh = decryptToken(conn.refresh_token)

  const nearExpiry = conn.expires_at && new Date(conn.expires_at).getTime() - Date.now() < REFRESH_MARGIN_MS
  if (!nearExpiry || !storedRefresh) return storedAccess

  try {
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: storedRefresh,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const data = await response.json()
    if (!response.ok || !data.access_token) {
      throw new Error(data?.error_description ?? `token refresh responded ${response.status}`)
    }
    await sql`
      UPDATE public.linkedin_connections SET
        access_token = ${encryptToken(data.access_token)},
        refresh_token = ${encryptToken(data.refresh_token ?? storedRefresh)},
        expires_at = ${new Date(Date.now() + (data.expires_in ?? 0) * 1000).toISOString()},
        updated_at = now()
      WHERE id = ${conn.id}
    `
    return data.access_token
  } catch (error) {
    console.error("[linkedin-leads] token refresh failed", { accountUrn, error: String(error?.message ?? error) })
    return storedAccess
  }
}

/**
 * Fetches one submitted lead. Response's answers live at
 * formResponse.answers[]: {questionId, answerDetails: {textQuestionAnswer:
 * {answer} | multipleChoiceAnswer: {options: [ids]}}} — questionId only,
 * no semantics. The response id (not a URN) is the path segment.
 */
export function fetchLeadFormResponse(responseId, token) {
  return restFetch(`https://api.linkedin.com/rest/leadFormResponses/${encodeURIComponent(responseId)}`, token)
}

/**
 * Fetches a form definition to learn what each questionId means:
 * content.questions[] carries {questionId, predefinedField (FIRST_NAME,
 * LAST_NAME, EMAIL, PHONE_NUMBER, …), question.localized.<locale>}.
 */
export function fetchLeadForm(formId, token) {
  return restFetch(`https://api.linkedin.com/rest/leadForms/${encodeURIComponent(formId)}`, token)
}

/** "urn:li:versionedLeadGenForm:(urn:li:leadGenForm:818,1)" → "818". */
export function formIdFromVersionedUrn(versionedUrn) {
  const match = /urn:li:leadGenForm:(\d+)/.exec(versionedUrn ?? "")
  return match?.[1] ?? null
}

/** First localized string of a form question's label, any locale. */
function questionLabel(question) {
  const localized = question?.question?.localized
  if (!localized) return null
  const first = Object.values(localized)[0]
  return typeof first === "string" ? first : null
}

/**
 * Joins a lead's answers to the form's questions and maps to the intake
 * shape. Standard predefinedFields map to columns; everything else — custom
 * questions, multiple-choice selections — lands in `message`, same
 * don't-drop-answers rule as mapLeadFields()/mapGoogleLead().
 */
export function mapLinkedInLead(leadResponse, form) {
  const questionsById = new Map(
    (form?.content?.questions ?? []).map((question) => [question.questionId, question])
  )

  let firstName = ""
  let lastName = ""
  const mapped = { name: "", email: "", phone: "" }
  const extra = []

  for (const answer of leadResponse?.formResponse?.answers ?? []) {
    const question = questionsById.get(answer.questionId)
    const details = answer.answerDetails ?? {}

    let value = ""
    if (details.textQuestionAnswer) {
      value = (details.textQuestionAnswer.answer ?? "").trim()
    } else if (details.multipleChoiceAnswer) {
      value = (details.multipleChoiceAnswer.options ?? []).join(", ")
    }
    if (!value) continue

    const field = question?.predefinedField
    if (field === "FIRST_NAME") firstName = value
    else if (field === "LAST_NAME") lastName = value
    else if (field === "FULL_NAME") mapped.name = value
    else if (field === "EMAIL" || field === "WORK_EMAIL") mapped.email = value.toLowerCase()
    else if (field === "PHONE_NUMBER" || field === "WORK_PHONE_NUMBER" || field === "MOBILE_PHONE_NUMBER") mapped.phone = value
    else {
      const label = questionLabel(question) ?? field ?? `Question ${answer.questionId}`
      extra.push(`${label}: ${value}`)
    }
  }

  if (!mapped.name && (firstName || lastName)) {
    mapped.name = [firstName, lastName].filter(Boolean).join(" ")
  }
  mapped.message = extra.join("\n")

  return mapped
}
