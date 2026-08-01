import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/admin"

/**
 * Data Access Layer — the authorization boundary for this app.
 *
 * Next 16 is explicit that proxy/middleware must not be the security layer
 * (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:29`); the
 * checks belong as close to the data as possible. `src/proxy.js` is only an
 * optimistic redirect for UX — everything that touches the database goes
 * through one of the three helpers below.
 *
 * The failure mode differs by caller, which is why there are three:
 *   - a page should redirect to /login
 *   - a server action should throw (it has no page to redirect)
 *   - a route handler must return a 401 Response
 *
 * Authentication is otherwise binary: any signed-in user may read and write
 * every row. The one exception is the super-admin area under /admin, gated by
 * requireAdmin() below.
 */

/**
 * `cache()` memoizes for the duration of one render pass. Without it the layout
 * and every page it renders would each call getSession, and getSession falls
 * back to an upstream HTTP fetch whenever the signed session-data cookie misses
 * (@neondatabase/auth/dist/next/server/index.mjs:892-912) — so this is the
 * difference between one round trip per request and one per component.
 */
export const getSession = cache(async () => {
  const { data } = await auth.getSession()
  return data ?? null
})

/** Pages and layouts. Redirects to /login when there is no session. */
export async function requireUser() {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  return session.user
}

/**
 * Server actions. Throws rather than redirecting.
 *
 * Server actions are publicly reachable POST endpoints — reaching one does not
 * imply the caller ever rendered the page that hosts it, so every action needs
 * its own check regardless of what gates the page.
 */
export async function requireUserOrThrow() {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  return session.user
}

/**
 * Route handlers. Returns the user, or null so the caller can shape its own
 * 401 Response — a redirect would be wrong for a fetch client.
 */
export async function getUserOrNull() {
  const session = await getSession()
  return session?.user ?? null
}

/**
 * The /admin area. Signed-out callers still redirect to /login; a signed-in
 * non-admin gets a 404 rather than a 403, so the area's existence is not
 * confirmed to an account that cannot use it.
 *
 * Every /admin page calls this for itself. Hiding the nav entry (see
 * src/app/(app)/layout.js) is presentation, not a control — the URL is
 * guessable and a Client Component cannot enforce anything.
 */
export async function requireAdmin() {
  const user = await requireUser()
  if (!isAdminEmail(user.email, process.env.SUPER_ADMIN_EMAILS)) notFound()
  return user
}

/**
 * For deciding whether to *render* something admin-only, where a 404 would be
 * wrong — the sidebar, mainly. Never use it as the gate on the data itself.
 */
export async function isCurrentUserAdmin() {
  const session = await getSession()
  return isAdminEmail(session?.user?.email, process.env.SUPER_ADMIN_EMAILS)
}
