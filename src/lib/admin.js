/**
 * Who is a super admin.
 *
 * The list lives in the SUPER_ADMIN_EMAILS environment variable rather than in
 * the database, so promoting someone is a deploy and shows up in the
 * environment's own audit trail — there is no in-app screen that can grant
 * admin to an account, which is the property worth having while there is
 * exactly one admin.
 *
 * `neon_auth."user"` does carry a `role` column (better-auth's admin plugin
 * ships it), and `/admin/list-users` upstream gates on it. Deliberately unused:
 * populating it means configuring the admin plugin on the Neon Auth backend,
 * which this repo does not control.
 *
 * Kept free of `server-only` and of any direct `process.env` read so the rules
 * below are a pure function the tests can pin. The caller passes the raw
 * variable in; `src/lib/dal.js` is the only place that reads it from the
 * environment.
 */

/**
 * Splits the raw variable into a set of comparable addresses.
 *
 * Lower-cased and trimmed because the same address arrives from three
 * independent places that do not agree on casing — Neon Auth's `user.email`,
 * this environment variable as a human typed it, and `audit_logs.actor_email`.
 *
 * @param {string|undefined} raw  comma-separated, e.g. "a@x.com, b@x.com"
 * @returns {Set<string>}
 */
export function parseAdminEmails(raw) {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      // A trailing comma yields "", which would otherwise match any user whose
      // email is missing or empty.
      .filter(Boolean)
  )
}

/**
 * Fails closed. An unset, empty or malformed SUPER_ADMIN_EMAILS makes *nobody*
 * an admin — never everybody. The repo already carries one fail-open switch
 * (WEBHOOK_SECRET, documented in .env.example); the gate in front of the user
 * list is not a place to add a second.
 *
 * @param {string|null|undefined} email  from the session user
 * @param {string|undefined} raw         process.env.SUPER_ADMIN_EMAILS
 */
export function isAdminEmail(email, raw) {
  const normalized = String(email ?? "").trim().toLowerCase()
  if (!normalized) return false
  return parseAdminEmails(raw).has(normalized)
}
