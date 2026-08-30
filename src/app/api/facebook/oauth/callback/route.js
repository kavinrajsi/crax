import { sql } from "@/lib/db"
import { GRAPH_API_VERSION } from "@/lib/facebook-leads"
import { readOAuthState, htmlRedirect } from "@/lib/oauth-flow"
import { encryptToken } from "@/lib/token-crypto"

const FETCH_TIMEOUT_MS = 8000

/* Secrets and tokens go in headers or the POST body, never the query string —
   query strings land in proxy logs and APM traces. Token exchange uses a POST
   form body; read calls send the token as a Bearer header. */
async function graphFetch(url, { method = "GET", accessToken, form } = {}) {
  const headers = {}
  const init = { method, headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    init.body = new URLSearchParams(form).toString()
  }
  const response = await fetch(url, init)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Graph API responded ${response.status}`)
  }
  return data
}

/* htmlRedirect (and the Brave anti-bounce-tracking story behind it) lives in
   src/lib/oauth-flow.js, shared with the LinkedIn callback. */

/**
 * Completes the "Connect Facebook" dance — see oauth/start/route.js.
 * Exchanges the authorization code for a long-lived user token, lists every
 * Page the user manages via /me/accounts (each entry already carries that
 * Page's own long-lived Page Access Token — no separate exchange needed for
 * those), and upserts one row per Page into facebook_page_connections.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const profileUrl = new URL("/profile", request.url)

  // Not requireUser() here — this request is the return leg of a redirect
  // through facebook.com, and a strict session cookie can fail to come back
  // on that leg. The state's signature (readOAuthState) is what proves who
  // started the flow; see its doc comment in facebook-leads.js.
  const email = readOAuthState(state, process.env.FB_APP_SECRET)
  if (!email) {
    profileUrl.searchParams.set("fb_error", "state")
    return htmlRedirect(profileUrl.toString())
  }
  if (!code) {
    profileUrl.searchParams.set("fb_error", "denied")
    return htmlRedirect(profileUrl.toString())
  }

  const redirectUri = new URL("/api/facebook/oauth/callback", request.url).toString()
  const appId = process.env.FB_APP_ID
  const appSecret = process.env.FB_APP_SECRET

  try {
    const { access_token: shortLivedToken } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`,
      { method: "POST", form: { client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code } }
    )

    const { access_token: userToken } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`,
      { method: "POST", form: { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken } }
    )

    // Needed so a later deauthorize/data-deletion callback from Meta (which
    // only carries this numeric ID, never an email or page_id) can find the
    // rows to remove — see src/app/api/facebook/deauthorize/route.js.
    const { id: fbUserId } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=id`,
      { accessToken: userToken }
    )

    const { data: pages } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`,
      { accessToken: userToken }
    )

    for (const page of pages ?? []) {
      await sql`
        INSERT INTO public.facebook_page_connections
          (page_id, page_name, access_token, connected_by_email, fb_user_id)
        VALUES (${page.id}, ${page.name}, ${encryptToken(page.access_token)}, ${email}, ${fbUserId})
        ON CONFLICT (page_id) DO UPDATE SET
          page_name = EXCLUDED.page_name,
          access_token = EXCLUDED.access_token,
          connected_by_email = EXCLUDED.connected_by_email,
          fb_user_id = EXCLUDED.fb_user_id,
          updated_at = now()
      `

      /* Configuring the App's webhook (Use cases → Webhooks → Page → leadgen)
         only says what the app listens for — each Page still has to be
         subscribed to this app separately, or leadgen events never fire for
         it. Best-effort: a page this app can't subscribe to (e.g. missing
         leads_retrieval before App Review finishes) shouldn't break
         connecting the rest, or lose the row already inserted above. */
      try {
        await graphFetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(page.id)}/subscribed_apps`,
          { method: "POST", accessToken: page.access_token, form: { subscribed_fields: "leadgen" } }
        )
      } catch (error) {
        console.error("[facebook-oauth] page webhook subscription failed", {
          pageId: page.id,
          error: String(error?.message ?? error),
        })
      }
    }

    profileUrl.searchParams.set("fb_connected", String(pages?.length ?? 0))
  } catch (error) {
    console.error("[facebook-oauth] callback failed", { email, error: String(error?.message ?? error) })
    profileUrl.searchParams.set("fb_error", "exchange")
  }

  return htmlRedirect(profileUrl.toString())
}
