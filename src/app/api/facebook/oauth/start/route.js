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
  /* pages_manage_ads is what /{page_id}/leadgen_forms checks, and only that
     endpoint — the live webhook never needed it, because Meta hands it a
     leadgen_id and leads_retrieval covers reading the answers behind one.
     Enumerating a Page's forms is a different permission, so the historical
     backfill (src/app/api/facebook/backfill/route.js) 403s with
     "(#200) Requires pages_manage_ads permission" on a token minted without
     it. Pages connected before this scope was added keep their old token and
     must be reconnected for the backfill to see their forms. */
  authorizeUrl.searchParams.set(
    "scope",
    "pages_show_list,pages_read_engagement,leads_retrieval,business_management,pages_manage_ads"
  )

  return Response.redirect(authorizeUrl.toString())
}
