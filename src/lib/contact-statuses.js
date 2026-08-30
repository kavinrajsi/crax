/**
 * The contact status vocabulary, defined once.
 *
 * `contact_us.status` was `text DEFAULT 'New'` with **no CHECK constraint** —
 * the last ungoverned enum in the schema, and the one that drives the dashboard
 * counts, the /data filter, the pipeline columns and the status badge. Anything
 * could be written to it, including a typo, and nothing would notice until a
 * board grew a column nobody meant to create.
 *
 * That is the same class of bug that cost this project a feature: the
 * contact_activities CHECK allowed call/meeting/email/task while the code
 * always inserted 'status_change', so every status change threw after updating
 * the row and the table sat empty for months. The difference here is the
 * opposite failure — no constraint at all rather than a wrong one — so the fix
 * is a constraint plus this module. The script that held the two together was
 * deleted on 2026-08-01; the constraint itself is still live in the database.
 *
 * The vocabulary already existed in FIVE places that had begun to drift:
 *
 *   src/components/contact-status-select.js  value/label/color
 *   src/app/(app)/pipeline/page.js            key/label/color, same seven
 *   src/components/data-page-client.js       STATUS_OPTIONS, keys only
 *   src/components/data-page-client.js       a badge-variant map keyed
 *                                            "Contacted" and "Closed" — one
 *                                            status that has never existed and
 *                                            one whose real key is lowercase,
 *                                            so both entries were already dead
 *   src/lib/follow-up.js                     RESOLVED_STATUSES, the complement
 *
 * Six copies of getValue drifting apart is what started the testing effort in
 * this repo. This is the same shape, caught earlier.
 *
 * Deliberately NOT "use client": the pipeline and the dashboard are Server
 * Components, and a "use client" module's exports reach them as client
 * references rather than values. Same constraint documented in
 * src/lib/table-utils.js and src/lib/contact-fields.js.
 *
 * The keys below MUST match the live contact_us_status_check CHECK constraint
 * in the database. Adding a key here without widening the CHECK makes every write of
 * that status throw; removing one the database still allows leaves rows no code
 * path renders. Nothing checks this — change both together.
 */

/**
 * Order is the pipeline's column order and the select's menu order — it is
 * presentation, not just a list, so it lives here rather than being sorted at
 * each call site.
 *
 * `resolved: true` means the lead is finished and needs no further work. That
 * flag is the single source for follow-up.js's RESOLVED_STATUSES; before this
 * module the two lists were maintained by hand and could disagree about
 * whether, say, a new "archived" status counted as open — which would have made
 * the dashboard's "needs attention" card link to a /data filter that returned a
 * different set.
 */
export const CONTACT_STATUSES = [
  { key: "lead",           label: "Lead (Needs Analysis)",         color: "#3b82f6" },
  { key: "first-touch",    label: "First Touch",                   color: "#0ea5e9" },
  { key: "discovery-call", label: "Discovery Call",                color: "#8b5cf6" },
  { key: "proposal",       label: "Proposal Given",                color: "#f59e0b" },
  { key: "negotiation",    label: "Price Estimation/Negotiation",  color: "#f97316" },
  { key: "closed-won",     label: "Closed Won",                    color: "#22c55e", resolved: true },
  { key: "closed-lost",    label: "Closed Lost",                   color: "#ef4444", resolved: true },
  { key: "fake",           label: "Fake",                          color: "#a855f7", resolved: true },
  { key: "test",           label: "Test",                          color: "#14b8a6", resolved: true },
]

/**
 * Every key, in column order. This is the constant the CHECK constraint is
 * compared against.
 *
 * Vocabulary reworked 2026-08-30 from the original seven (New, follow-up, win,
 * closed, rejected, fake, test) into a sales-pipeline shape; existing rows were
 * migrated (New→lead, follow-up→first-touch, win→closed-won,
 * closed/rejected→closed-lost) in the same transaction that rewrote the CHECK.
 * "fake" and "test" are triage outcomes for junk submissions on a public
 * intake form, not leftovers.
 */
export const CONTACT_STATUS_KEYS = CONTACT_STATUSES.map((s) => s.key)

/** Statuses that mean the lead is finished. Anything else is still open. */
export const RESOLVED_STATUS_KEYS = CONTACT_STATUSES
  .filter((s) => s.resolved)
  .map((s) => s.key)

/**
 * What a new row gets. Matches the column default in the schema and the literal
 * written by both intake paths (api/contacts/submit and api/contacts/import),
 * which is why it is exported rather than repeated a fourth time.
 */
export const DEFAULT_CONTACT_STATUS = "lead"

export function isContactStatus(key) {
  return CONTACT_STATUS_KEYS.includes(key)
}

/**
 * Falls back to the first status rather than returning undefined, so a row
 * carrying a value written before the constraint existed still renders a badge
 * instead of crashing the row it appears in.
 */
export function statusMeta(key) {
  return CONTACT_STATUSES.find((s) => s.key === key) ?? CONTACT_STATUSES[0]
}
