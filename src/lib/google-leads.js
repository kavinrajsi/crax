import crypto from "node:crypto"

/**
 * Google Ads lead form helpers. Unlike Facebook (see facebook-leads.js),
 * Google's webhook POST carries the complete lead inline — no follow-up
 * API call, no stored tokens — so this module is just the payload mapper
 * and the shared-key check.
 */

/**
 * Maps user_column_data (array of {column_id, string_value}) to the shape
 * the intake INSERT expects. Standard column_ids are fixed by Google;
 * custom questions arrive under their own ids and fall through into
 * `message` rather than being dropped — same instinct as mapLeadFields()
 * in facebook-leads.js.
 */
export function mapGoogleLead(userColumnData = []) {
  let firstName = ""
  let lastName = ""
  const mapped = { name: "", email: "", phone: "" }
  const extra = []

  for (const { column_id: columnId, string_value: value, column_name: columnName } of userColumnData) {
    const trimmed = (value ?? "").trim()
    if (!trimmed) continue

    if (columnId === "FULL_NAME") mapped.name = trimmed
    else if (columnId === "FIRST_NAME") firstName = trimmed
    else if (columnId === "LAST_NAME") lastName = trimmed
    else if (columnId === "EMAIL") mapped.email = trimmed.toLowerCase()
    else if (columnId === "PHONE_NUMBER") mapped.phone = trimmed
    else extra.push(`${columnName || columnId}: ${trimmed}`)
  }

  if (!mapped.name && (firstName || lastName)) {
    mapped.name = [firstName, lastName].filter(Boolean).join(" ")
  }
  mapped.message = extra.join("\n")

  return mapped
}

/**
 * Timing-safe check of the google_key Google echoes back in each POST body
 * against GOOGLE_LEADS_WEBHOOK_KEY. Fail-closed: unset key means nothing
 * verifies — deliberately not the fail-open WEBHOOK_SECRET pattern.
 */
export function verifyGoogleKey(providedKey, expectedKey) {
  if (!expectedKey || typeof providedKey !== "string" || !providedKey) return false
  const providedBuf = Buffer.from(providedKey, "utf8")
  const expectedBuf = Buffer.from(expectedKey, "utf8")
  if (providedBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}
