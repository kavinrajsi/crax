/**
 * What counts as a lead that needs attention.
 *
 * 72 of 85 contacts had no note and no activity ever, and there were 0 open
 * tasks. The CRM was recording arrivals, not work.
 *
 * There is deliberately no age threshold. One was tried at 30 days and the
 * dial had nothing to grip on: at 3 days it flagged 52 open leads, at 90 days
 * 45, because the median open lead had been untouched for 226 days. The
 * meaningful signal is simply whether anyone has worked the lead at all.
 *
 * Kept in one module so the dashboard count and the /data filter can never
 * disagree — the mistake EXCLUDED_EMAILS made across nine call sites.
 */

/**
 * Statuses that mean the lead is finished. Anything else is still open.
 *
 * Re-exported from src/lib/contact-statuses.js rather than listed again. This
 * list and the four copies of the vocabulary elsewhere were maintained by hand,
 * and two had already drifted. A status added there but forgotten here would
 * make every lead in it count as open forever — the dashboard's "needs
 * attention" card and the /data filter would agree with each other and both be
 * wrong, which is the failure mode this module's own header warns about.
 */
/* A relative specifier, not the "@/lib/..." alias used elsewhere in src/lib:
   test/follow-up.test.mjs imports this module under plain `node --test`, which
   has no knowledge of jsconfig's path alias and would fail to resolve it. */
import { RESOLVED_STATUS_KEYS } from "./contact-statuses.js"

export const RESOLVED_STATUSES = RESOLVED_STATUS_KEYS

export function isOpen(contact) {
  return !RESOLVED_STATUSES.includes(contact.status)
}

/**
 * Whole days since the last note or activity, falling back to arrival.
 * Display only — the "Last touch" column. Not part of the rule below.
 */
export function daysSinceTouch(contact) {
  const touched = contact.last_touch ?? contact.created_at
  if (!touched) return null
  return Math.floor((Date.now() - new Date(touched).getTime()) / 86_400_000)
}

/** Open, and nobody has left a note or logged an activity against it. */
export function needsAttention(contact) {
  return isOpen(contact) && !contact.has_touch
}
