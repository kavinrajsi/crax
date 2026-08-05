import "server-only"
import { createNeonAuth } from "@neondatabase/neon-js/auth/next/server"

const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
})

/**
 * Next throws this out of `cookies().set()` when the caller is a Server
 * Component. Matched on the message because the adapter lets it propagate
 * unwrapped — there is no error code to key on.
 */
const COOKIE_WRITE_BLOCKED = /Cookies can only be modified/i

function isCookieWriteBlocked(error) {
  return COOKIE_WRITE_BLOCKED.test(String(error?.message ?? error))
}

/**
 * Keeps a rotating session token from 500ing a render.
 *
 * getSession() has a fast path (validate the signed session-data cookie, no
 * writes) and a slow path (fetch upstream, then persist whatever Set-Cookie
 * comes back). The slow path writes through next/headers' cookie store, which
 * throws in a Server Component — so every RSC calling getSession() 500s the
 * moment the upstream rotates the token. Almost every page here reaches it
 * through requireUser().
 *
 * This used to be fixed by patching the dependency on postinstall. That patch
 * was removed along with the scripts directory, so the guard lives here now.
 * It cannot be pushed any deeper: the failing write is `ctx.setCookie` in
 * @neondatabase/auth's adapter, `ctx` comes from an internal
 * createNextRequestContext, and only createNeonAuth is exported — there is no
 * seam to inject a safer cookie store through.
 *
 * The retry is worth one round trip because the upstream rotation is issued
 * once: the throw happens after the fetch succeeded, so the new token may
 * already be live and a second call can come back without a Set-Cookie to
 * persist. When it does not, returning an empty session is the right way to
 * lose — the caller redirects to /login, and /api/auth/[...path] persists the
 * rotated cookie on the next auth request, where writes are legal. A spurious
 * sign-out on token rotation is worth trading for never serving a 500.
 *
 * Dropping the write is safe in itself; only the throw was ever the problem.
 */
/* Captured before the wrapper below can shadow it. createNeonAuth returns a
   Proxy whose set trap writes straight to its own target and ignores the
   receiver, so assigning `getSession` onto anything with that Proxy in its
   prototype chain — Object.assign(Object.create(neonAuth), …) — silently
   overwrites the original instead of shadowing it, and the wrapper ends up
   calling itself. Reading the function out first, and interposing with a get
   trap rather than an assignment, keeps the two separate. */
const upstreamGetSession = neonAuth.getSession

async function getSession(...args) {
  try {
    return await upstreamGetSession(...args)
  } catch (error) {
    if (!isCookieWriteBlocked(error)) throw error

    try {
      return await upstreamGetSession(...args)
    } catch (retryError) {
      if (!isCookieWriteBlocked(retryError)) throw retryError

      console.warn(
        "[auth] session token rotated during a render — treating this request as signed out",
        { detail: String(retryError?.message ?? retryError) }
      )
      return { data: null, error: null }
    }
  }
}

/* Everything except getSession — handler(), signIn, signOut — passes straight
   through, so this stays a drop-in for the object createNeonAuth returns. */
export const auth = new Proxy(neonAuth, {
  get(target, prop, receiver) {
    return prop === "getSession" ? getSession : Reflect.get(target, prop, receiver)
  },
})
