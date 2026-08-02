/**
 * Internal/test addresses that used to be hidden from counts and lists via
 * the `public.visible_contacts` view. That view was dropped on 2026-08-03 —
 * every read now queries `contact_us` directly and no longer filters these
 * out. This list is unused for filtering; kept only as a record of which
 * addresses were previously excluded.
 *
 * Deliberately in its own module rather than in src/lib/db.js, which calls
 * `neon()` at import time and so throws for any script running without a
 * DATABASE_URL.
 */
export const EXCLUDED_EMAILS = [
  "kavin@madarth.com",
  "sikavinraj@gmail.com",
  "kavinrajsi01@gmail.com",
]
