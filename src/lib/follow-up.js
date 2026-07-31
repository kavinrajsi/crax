/**
 * What counts as a lead that needs attention.
 *
 * As of writing: 72 of 85 contacts had no note and no activity ever, 46 were
 * open and untouched for 30+ days, and there were 0 open tasks. The CRM was
 * recording arrivals, not work. This is the definition that makes that visible.
 *
 * Kept in one module so the dashboard count and the /data filter can never
 * disagree — the mistake EXCLUDED_EMAILS made across nine call sites.
 *
 * The matching SQL lives inline in data/page.js: it computes `last_touch` as
 * GREATEST(created_at, newest note, newest activity). Every query in this
 * codebase is a tagged template with no string interpolation, so the fragment
 * is not shared as a constant — if you change one, change the other.
 */

/** Statuses that mean the lead is finished. Anything else is still open. */
export const RESOLVED_STATUSES = ["win", "closed", "rejected", "fake", "test"]

/** Days without a note or activity before an open lead is "stale". */
export const STALE_AFTER_DAYS = 30

export function isOpen(contact) {
  return !RESOLVED_STATUSES.includes(contact.status)
}

/** Whole days since the last sign of life, falling back to arrival. */
export function daysSinceTouch(contact) {
  const touched = contact.last_touch ?? contact.created_at
  if (!touched) return null
  return Math.floor((Date.now() - new Date(touched).getTime()) / 86_400_000)
}

export function needsAttention(contact) {
  if (!isOpen(contact)) return false
  const days = daysSinceTouch(contact)
  return days != null && days >= STALE_AFTER_DAYS
}
