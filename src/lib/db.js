import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL)

/**
 * Re-exported so the many call sites that already import it from here keep
 * working. The list itself lives in src/lib/excluded-emails.js, which stays
 * free of the `neon()` call above so that scripts without a DATABASE_URL can
 * import it — see the comment there.
 *
 * The public.visible_contacts view that made this unnecessary for display
 * reads was dropped on 2026-08-03; those reads now select from contact_us
 * directly and are unfiltered.
 */
export { EXCLUDED_EMAILS } from "./excluded-emails.js"
