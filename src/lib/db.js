import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL)

/**
 * Internal/test addresses hidden from anything a user reads as a count or a list.
 *
 * Apply it to every **display** read of contact_us — lists, aggregates, exports.
 * Skipping it on one of those is not cosmetic: the dashboard's "Total Contacts"
 * filtered while its "Contacts by Source" rollup did not, so the two counted
 * different populations and could never reconcile on screen.
 *
 * Do NOT apply it to **lookups by id** (contacts/[id], the server actions,
 * company-enrichment) or to the webhook's dedupe probe — those address one known
 * row, and filtering them would make an internal contact silently unopenable or
 * let it be inserted twice.
 *
 * TODO: a `public.visible_contacts` view would enforce this instead of relying
 * on every call site remembering. Deferred because it is a schema change.
 */
export const EXCLUDED_EMAILS = [
  "kavin@madarth.com",
  "sikavinraj@gmail.com",
  "kavinrajsi01@gmail.com",
]
