/**
 * Internal/test addresses hidden from anything a user reads as a count or a list.
 *
 * These are the rows `public.visible_contacts` filters out
 * (db/migrations/003-create-visible-contacts.sql). Every **display** read of
 * contact_us — lists, aggregates, exports — selects from that view rather than
 * naming these addresses again. Before the view existed the rule was remembered
 * by hand at twelve query sites, and skipping it on one was not cosmetic: the
 * dashboard's "Total Contacts" filtered while its "Contacts by Source" rollup
 * did not, so the two counted different populations and could never reconcile
 * on screen.
 *
 * The view is NOT used for **lookups by id** (contacts/[id], the server
 * actions, company-enrichment) or for the webhook's dedupe probe — those
 * address one known row, and filtering them would make an internal contact
 * silently unopenable or let it be inserted twice.
 *
 * This list stays the single source of truth, but nothing enforces that any
 * more — the guard comparing it against the view was deleted on 2026-08-01.
 * Change this array and db/migrations/003-create-visible-contacts.sql together,
 * and re-run the CREATE OR REPLACE VIEW against the database.
 *
 * Deliberately in its own module rather than in src/lib/db.js, which calls
 * `neon()` at import time and so throws for any script running without a
 * DATABASE_URL — including the guard above, in CI's secret-free job.
 */
export const EXCLUDED_EMAILS = [
  "kavin@madarth.com",
  "sikavinraj@gmail.com",
  "kavinrajsi01@gmail.com",
]
