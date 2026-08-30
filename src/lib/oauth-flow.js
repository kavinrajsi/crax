import crypto from "node:crypto"

/**
 * Shared pieces of the "Connect <provider>" OAuth flows (Facebook, LinkedIn).
 * Extracted from facebook-leads.js / the Facebook callback once LinkedIn
 * became the second consumer — both flows carry the same two hard-won
 * lessons, and copies of security-sensitive code drift:
 *
 *  1. The callback trusts the signed state, not a live session read — the
 *     return leg of a redirect through the provider's domain is cross-site,
 *     and a strict session cookie can fail to come back on it even though
 *     the user never meaningfully left. The state's HMAC (keyed by a secret
 *     only this server holds) is what proves who started the flow. The
 *     *start* route still gates on a real session; that request is
 *     same-site, so the cookie is reliable there.
 *
 *  2. The callback navigates onward with an HTML page + script, not an
 *     HTTP 3xx — provider.com → callback → /profile is exactly the
 *     automatic-redirect-chain shape Brave Shields' anti-bounce-tracking
 *     strips cookies on. A script-driven navigation from a rendered page
 *     doesn't trip that heuristic.
 */

/** 10 minutes is generous for a browser round-trip through a provider's
 * OAuth dialog, short enough that a leaked/logged state value stops being
 * useful quickly. */
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Domain separation for the state HMAC.
 *
 * LINKEDIN_CLIENT_SECRET is reused across three trust domains (OAuth token
 * exchange, webhook X-LI-Signature verification, and this OAuth state), and
 * the LinkedIn webhook GET is a public HMAC-signing oracle: it returns
 * HMAC(clientSecret, attackerInput) for any input. Signing state with the raw
 * secret let that oracle forge state for any email. Deriving a purpose-bound
 * subkey means the oracle's output — HMAC over the *raw* secret — can never be
 * a valid state signature, because state is signed under a key the oracle
 * cannot compute. FB_APP_SECRET has the same reuse shape and benefits equally.
 */
function deriveStateKey(secret) {
  return crypto.createHmac("sha256", secret).update("crax:oauth-state:v1").digest()
}

/**
 * Signs a CSRF state value — HMAC over the initiating user's email and a
 * timestamp. No DB table needed for short-lived state.
 */
export function createOAuthState(email, secret) {
  const payload = `${email}:${Date.now()}`
  const sig = crypto.createHmac("sha256", deriveStateKey(secret)).update(payload).digest("hex")
  return Buffer.from(`${payload}:${sig}`).toString("base64url")
}

/**
 * Verifies a state value came from createOAuthState() and is unexpired,
 * returning the email it was signed for — or null if invalid/tampered/stale.
 */
export function readOAuthState(state, secret) {
  if (!state) return null
  let decoded
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8")
  } catch {
    return null
  }
  const parts = decoded.split(":")
  if (parts.length !== 3) return null
  const [email, ts, sig] = parts

  const payload = `${email}:${ts}`
  const expected = crypto.createHmac("sha256", deriveStateKey(secret)).update(payload).digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  const sigBuf = Buffer.from(sig, "hex")
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) return null

  return Date.now() - Number(ts) <= OAUTH_STATE_MAX_AGE_MS ? email : null
}

/** A real HTML page that navigates onward via script — see lesson 2 above. */
export function htmlRedirect(url) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
      `<script>window.location.replace(${JSON.stringify(url)})</script>` +
      `<p>Redirecting…</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}
