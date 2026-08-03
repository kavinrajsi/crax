import { requireUser } from "@/lib/dal"
import { createOAuthState } from "@/lib/oauth-flow"

/**
 * Starts the "Connect LinkedIn" OAuth dance from Profile → Integrations.
 * Mirrors the Facebook start route: reached by a plain browser link, so
 * requireUser()'s redirect to /login is right here — this request is
 * same-site, unlike the callback's return leg.
 */
export async function GET(request) {
  const user = await requireUser()

  const state = createOAuthState(user.email, process.env.LINKEDIN_CLIENT_SECRET)
  const redirectUri = new URL("/api/linkedin/oauth/callback", request.url).toString()

  const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization")
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("state", state)
  // r_marketing_leadgen_automation: read lead form responses + manage
  // leadNotifications subscriptions. r_ads: list the member's ad accounts so
  // the callback knows which sponsored accounts to connect.
  authorizeUrl.searchParams.set("scope", "r_marketing_leadgen_automation r_ads")

  return Response.redirect(authorizeUrl.toString())
}
