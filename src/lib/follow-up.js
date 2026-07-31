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

/** Statuses that mean the lead is finished. Anything else is still open. */
export const RESOLVED_STATUSES = ["win", "closed", "rejected", "fake", "test"]

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
