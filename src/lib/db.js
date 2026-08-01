import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL)

/**
 * Re-exported so the many call sites that already import it from here keep
 * working. The list itself lives in src/lib/excluded-emails.js, which stays
 * free of the `neon()` call above so that scripts without a DATABASE_URL can
 * import it — see the comment there.
 *
 * Display reads no longer need it: they select from public.visible_contacts.
 */
export { EXCLUDED_EMAILS } from "./excluded-emails.js"
