import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { verifyOAuthState, GRAPH_API_VERSION } from "@/lib/facebook-leads"

const FETCH_TIMEOUT_MS = 8000

async function graphFetch(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Graph API responded ${response.status}`)
  }
  return data
}

/**
 * Completes the "Connect Facebook" dance — see oauth/start/route.js.
 * Exchanges the authorization code for a long-lived user token, lists every
 * Page the user manages via /me/accounts (each entry already carries that
 * Page's own long-lived Page Access Token — no separate exchange needed for
 * those), and upserts one row per Page into facebook_page_connections.
 */
export async function GET(request) {
  const user = await requireUser()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const profileUrl = new URL("/profile", request.url)

  if (!verifyOAuthState(state, user.email, process.env.FB_APP_SECRET)) {
    profileUrl.searchParams.set("fb_error", "state")
    return Response.redirect(profileUrl.toString())
  }
  if (!code) {
    profileUrl.searchParams.set("fb_error", "denied")
    return Response.redirect(profileUrl.toString())
  }

  const redirectUri = new URL("/api/facebook/oauth/callback", request.url).toString()
  const appId = process.env.FB_APP_ID
  const appSecret = process.env.FB_APP_SECRET

  try {
    const { access_token: shortLivedToken } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token` +
        `?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}&code=${code}`
    )

    const { access_token: userToken } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token` +
        `?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}` +
        `&fb_exchange_token=${shortLivedToken}`
    )

    // Needed so a later deauthorize/data-deletion callback from Meta (which
    // only carries this numeric ID, never an email or page_id) can find the
    // rows to remove — see src/app/api/facebook/deauthorize/route.js.
    const { id: fbUserId } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=id&access_token=${userToken}`
    )

    const { data: pages } = await graphFetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?access_token=${userToken}`
    )

    for (const page of pages ?? []) {
      await sql`
        INSERT INTO public.facebook_page_connections
          (page_id, page_name, access_token, connected_by_email, fb_user_id)
        VALUES (${page.id}, ${page.name}, ${page.access_token}, ${user.email}, ${fbUserId})
        ON CONFLICT (page_id) DO UPDATE SET
          page_name = EXCLUDED.page_name,
          access_token = EXCLUDED.access_token,
          connected_by_email = EXCLUDED.connected_by_email,
          fb_user_id = EXCLUDED.fb_user_id,
          updated_at = now()
      `
    }

    profileUrl.searchParams.set("fb_connected", String(pages?.length ?? 0))
  } catch (error) {
    console.error("[facebook-oauth] callback failed", { email: user.email, error })
    profileUrl.searchParams.set("fb_error", "exchange")
  }

  return Response.redirect(profileUrl.toString())
}
