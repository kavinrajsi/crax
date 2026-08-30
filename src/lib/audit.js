import "server-only"
import { headers } from "next/headers"
import { sql } from "@/lib/db"

/**
 * Writes the audit trail that /logs reads.
 *
 * Until now nothing wrote to public.audit_logs — `git log -S` finds no commit
 * that ever inserted into it, and there are no triggers or functions. The 28
 * rows in production are seed data from one local session (all 2026-05-25, one
 * actor, ip_address ::1), while the page advertised a "Complete activity
 * trail". It answered "who changed this?" with a confident, wrong answer.
 *
 * Deliberately best-effort: a failure here logs and returns rather than
 * throwing. An audit write must never roll back or block the business action
 * it is describing — losing a log line is better than losing a lead. The
 * trade-off is that the trail is not guaranteed complete under database
 * failure, which is the right call at this scale but would need revisiting if
 * the log ever becomes a compliance artefact.
 */

/**
 * How many rows any page ships to the browser.
 *
 * One constant because three surfaces render this table — /logs, /admin/users
 * (which cites the number) and /admin/users/[id] — and a page whose caption
 * claims a bound the query does not apply is exactly the class of lie this
 * module was written to stop.
 */
export const LOG_PAGE_LIMIT = 200

/**
 * Actor for writes that no signed-in user triggered.
 *
 * The public intake webhook and the CSV importer both run work — company
 * enrichment — with nobody logged in, so there is no user to attribute it to.
 * Before this existed those failures went to console.error and nowhere else,
 * and company enrichment failed on every lead for two months without one
 * surface in the app showing it.
 *
 * Deliberately an address no account can hold, so it never collides with a real
 * user: /admin/users/[id] joins the trail on lower(actor_email), and a system
 * row must not appear inside a person's log.
 */
export const SYSTEM_ACTOR = { email: "system@intake.local", id: null }

/**
 * @param {object} user      from requireUserOrThrow(), or SYSTEM_ACTOR
 * @param {string} action    verb, e.g. "contact.update", "company.delete"
 * @param {object} [target]
 * @param {string} [target.table]
 * @param {string|number} [target.id]
 * @param {object} [target.before]  row state before the change
 * @param {object} [target.after]   row state after, or the submitted fields
 */
export async function recordAudit(user, action, target = {}) {
  try {
    const { table = null, id = null, before = null, after = null } = target

    // Available in server actions and route handlers. Wrapped because a
    // caller outside a request scope would otherwise throw.
    let ip = null
    let userAgent = null
    try {
      const h = await headers()
      ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? null
      userAgent = h.get("user-agent") ?? null
    } catch {
      // no request scope — leave both null
    }

    await sql`
      INSERT INTO public.audit_logs
        (actor_email, actor_user_id, action, target_table, target_id,
         before, after, ip_address, user_agent)
      VALUES
        (${user?.email ?? "unknown"}, ${user?.id ?? null}, ${action},
         ${table}, ${id == null ? null : String(id)},
         ${before ? JSON.stringify(before) : null},
         ${after ? JSON.stringify(after) : null},
         ${ip}, ${userAgent})
    `
  } catch (error) {
    console.error("[audit] failed to record", { action, error })
  }
}

/**
 * Reads a row so a mutation can record what it replaced. Returns null rather
 * than throwing — a missing `before` is worth less than a failed action.
 */
export async function snapshot(table, id) {
  try {
    switch (table) {
      case "contact_us":
        return (await sql`SELECT * FROM public.contact_us WHERE id = ${id}`)[0] ?? null
      case "companies":
        return (await sql`SELECT * FROM public.companies WHERE id = ${id}`)[0] ?? null
      case "contact_tags":
        return (await sql`SELECT * FROM public.contact_tags WHERE id = ${id}`)[0] ?? null
      case "kanban_boards":
        return (await sql`SELECT * FROM public.kanban_boards WHERE id = ${id}`)[0] ?? null
      case "kanban_columns":
        return (await sql`SELECT * FROM public.kanban_columns WHERE id = ${id}`)[0] ?? null
      case "kanban_cards":
        return (await sql`SELECT * FROM public.kanban_cards WHERE id = ${id}`)[0] ?? null
      default:
        return null
    }
  } catch (error) {
    console.error("[audit] snapshot failed", { table, id, error })
    return null
  }
}
