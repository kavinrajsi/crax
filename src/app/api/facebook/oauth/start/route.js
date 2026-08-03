import { requireUser } from "@/lib/dal"
import { GRAPH_API_VERSION } from "@/lib/facebook-leads"
import { createOAuthState } from "@/lib/oauth-flow"

/**
 * Starts the "Connect Facebook" OAuth dance from Profile → Integrations.
 * Reached by a plain browser link (not fetch), so requireUser()'s redirect
 * to /login is the right behavior here — see the caller-shapes-its-own-401
 * caveat in src/lib/dal.js, which is about fetch clients, not this.
 */
export async function GET(request) {
  const user = await requireUser()

  const state = createOAuthState(user.email, process.env.FB_APP_SECRET)
  const redirectUri = new URL("/api/facebook/oauth/callback", request.url).toString()

  const authorizeUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`)
  authorizeUrl.searchParams.set("client_id", process.env.FB_APP_ID)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set(
    "scope",
    "pages_show_list,pages_read_engagement,leads_retrieval,business_management"
  )

  return Response.redirect(authorizeUrl.toString())
}
