import { NextResponse } from "next/server"

/**
 * Optimistic auth redirect — a UX layer, NOT the security boundary.
 *
 * Next 16 is explicit that this file must not be the authorization solution
 * (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:29`).
 * All it does is spare a logged-out visitor a render before bouncing them to
 * /login. The real checks live in `src/lib/dal.js` and run next to the data:
 * every page, every server action, every route handler. If you delete this
 * file, nothing becomes reachable that wasn't already.
 *
 * It deliberately only checks for cookie *presence*, never validity — verifying
 * a session here would mean a network round trip on every asset request, and
 * the docs warn against slow work in proxy.
 */

// `__Secure-` is dropped on plain http (localhost), so match the suffix.
const SESSION_COOKIE_SUFFIX = ".session_token"

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]

export function proxy(request) {
  const { pathname, search } = request.nextUrl

  /* Never redirect /api. A fetch client expects a 401 it can branch on, not a
     302 to an HTML login page it would then try to JSON.parse. Every route
     handler carries its own guard (getUserOrNull → 401); /api/contacts/submit
     is the intentionally public intake webhook. */
  if (pathname.startsWith("/api/")) return NextResponse.next()

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.endsWith(SESSION_COOKIE_SUFFIX) && c.value)

  if (hasSession) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  // Preserve where they were headed so login can send them back.
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Skip Next internals, the favicon, and anything with a file extension —
  // static assets must not pay for this, and redirecting them breaks the page.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
}
