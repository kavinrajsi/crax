import crypto from "node:crypto"
import { sql } from "@/lib/db"
import { autoLinkCompany } from "@/lib/company-enrichment"
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit"

/**
 * Google Ads lead form helpers — the payload mappers, the shared-key check,
 * and the single contact_us write both intake paths go through.
 *
 * Two paths reach the same leads. The webhook POST carries the complete lead
 * inline (no follow-up call, no stored tokens), while the backfill reads them
 * back out of the Reporting API's lead_form_submission_data resource — see
 * fetchLeadFormSubmissions() in src/lib/google-ads.js. The two deliver the
 * same answers in different shapes, so both are normalised to the webhook's
 * user_column_data before mapping.
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
 * Reshapes a Reporting API submission into the webhook's user_column_data so
 * mapGoogleLead() above stays the single mapper.
 *
 * The two surfaces name the same things differently: the webhook sends
 * `{column_id, string_value}` with snake_case ids, the Reporting API sends
 * `{fieldType, fieldValue}` — but fieldType is the same enum (FULL_NAME,
 * EMAIL, PHONE_NUMBER, …) that appears as column_id, so the values line up
 * without a translation table.
 *
 * Custom questions have no id at all on the reporting side, only the question
 * text; they are passed through under column_name so they land in `message`
 * rather than being dropped.
 */
export function submissionToColumnData(submission = {}) {
  const standard = (submission.leadFormSubmissionFields ?? []).map((field) => ({
    column_id: field.fieldType,
    string_value: field.fieldValue,
  }))
  const custom = (submission.customLeadFormSubmissionFields ?? []).map((field) => ({
    column_id: "CUSTOM",
    column_name: field.questionText,
    string_value: field.fieldValue,
  }))
  return [...standard, ...custom]
}

/**
 * Last segment of a Google Ads resource name — "customers/1/campaigns/42"
 * becomes "42". The webhook sends bare ids while the Reporting API sends
 * full resource names, and source_url should read the same either way.
 */
export function resourceId(resourceName) {
  return (resourceName ?? "").split("/").pop() ?? ""
}

/** Trims to a string, mapping null/undefined to "" — the INSERT below has no nullable text columns. */
function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

/**
 * Writes one Google Ads lead into contact_us — the single source of truth for
 * what a Google lead becomes, called by both the webhook and the backfill so
 * live and historical leads land identically.
 *
 * Mirrors upsertFacebookLead() in src/lib/facebook-leads.js exactly: same
 * dedupe rules, same best-effort enrichment, same result shape.
 *   { skipped: true }            no usable name/email/phone
 *   { duplicate: true }          google_lead_id already recorded
 *   { isNew: false, contactId }  matched an existing contact by email
 *   { isNew: true, contactId }   inserted
 */
export async function upsertGoogleLead({ leadId, userColumnData, campaignId, formId, gclid, rawPayload }) {
  // Already processed — Google can redeliver the same lead, and a backfill
  // re-run walks leads the webhook already took.
  const [already] = await sql`SELECT id FROM public.contact_us WHERE google_lead_id = ${leadId} LIMIT 1`
  if (already) return { duplicate: true, contactId: already.id }

  const { name, email, phone, message } = mapGoogleLead(userColumnData)
  if (!name && !email && !phone) return { skipped: true }

  const sourceUrl = `https://ads.google.com/leadform/${str(campaignId)}/${str(formId)}`

  // Known email: append the message rather than creating a second contact —
  // same convention as the Facebook and submit routes.
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
      return { isNew: false, contactId: existing.id }
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
       ${str(gclid) || null}, NULL, NULL, NULL, NULL)
    ON CONFLICT (google_lead_id) WHERE google_lead_id IS NOT NULL DO NOTHING
    RETURNING id
  `
  if (!contact) return { duplicate: true } // lost the race to a redelivery

  try {
    await autoLinkCompany(contact.id, email, "")
  } catch (error) {
    console.error("[google-leads] company enrichment failed", { contactId: contact.id, error })
    await recordAudit(SYSTEM_ACTOR, "contact.enrichment_failed", {
      table: "contact_us",
      id: contact.id,
      after: { source: "google-lead-form", email, error: String(error?.message ?? error) },
    })
  }

  return { isNew: true, contactId: contact.id }
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
