import { sql } from "@/lib/db"
import { readOAuthState, htmlRedirect } from "@/lib/oauth-flow"
import { LINKEDIN_API_VERSION } from "@/lib/linkedin-leads"

const FETCH_TIMEOUT_MS = 8000

/**
 * Completes the "Connect LinkedIn" dance — see oauth/start/route.js.
 * Exchanges the code for an access token + refresh token, lists the
 * member's sponsored ad accounts, upserts one linkedin_connections row per
 * account, and best-effort creates a leadNotifications subscription for
 * each (LinkedIn's Lead Sync webhooks are subscribed via API, not the
 * developer portal — the counterpart of Facebook's subscribed_apps call).
 *
 * Carries both OAuth lessons from the Facebook flow via oauth-flow.js:
 * trusts the signed state instead of requireUser(), and returns
 * htmlRedirect() rather than an HTTP 3xx.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const profileUrl = new URL("/profile", request.url)

  const email = readOAuthState(state, process.env.LINKEDIN_CLIENT_SECRET)
  if (!email) {
    profileUrl.searchParams.set("li_error", "state")
    return htmlRedirect(profileUrl.toString())
  }
  if (!code) {
    profileUrl.searchParams.set("li_error", "denied")
    return htmlRedirect(profileUrl.toString())
  }

  const redirectUri = new URL("/api/linkedin/oauth/callback", request.url).toString()

  try {
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData?.error_description ?? `token exchange responded ${tokenResponse.status}`)
    }
    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token ?? null
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 0) * 1000).toISOString()

    const accountsResponse = await fetch("https://api.linkedin.com/rest/adAccounts?q=search", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Linkedin-Version": LINKEDIN_API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const accountsData = await accountsResponse.json()
    if (!accountsResponse.ok) {
      throw new Error(accountsData?.message ?? `adAccounts responded ${accountsResponse.status}`)
    }
    const accounts = accountsData?.elements ?? []

    const webhookUrl = new URL("/api/linkedin/webhook", request.url).toString()

    for (const account of accounts) {
      const accountUrn = `urn:li:sponsoredAccount:${account.id}`
      await sql`
        INSERT INTO public.linkedin_connections
          (account_urn, account_name, access_token, refresh_token, expires_at, connected_by_email)
        VALUES (${accountUrn}, ${account.name ?? accountUrn}, ${accessToken}, ${refreshToken}, ${expiresAt}, ${email})
        ON CONFLICT (account_urn) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          connected_by_email = EXCLUDED.connected_by_email,
          updated_at = now()
      `

      /* Best-effort, like Facebook's subscribed_apps call: an account that
         can't be subscribed yet (Lead Sync access still under review)
         shouldn't lose the row above or block the other accounts. LinkedIn
         validates the webhook URL with a challengeCode GET during this
         call, so the webhook route must already be deployed. */
      try {
        const subResponse = await fetch("https://api.linkedin.com/rest/leadNotifications", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Linkedin-Version": LINKEDIN_API_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: webhookUrl,
            owner: { sponsoredAccount: accountUrn },
            leadType: "SPONSORED",
          }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (!subResponse.ok) {
          const subData = await subResponse.json().catch(() => null)
          throw new Error(subData?.message ?? `leadNotifications responded ${subResponse.status}`)
        }
      } catch (error) {
        console.error("[linkedin-oauth] lead notification subscription failed", {
          accountUrn,
          error: String(error?.message ?? error),
        })
      }
    }

    profileUrl.searchParams.set("li_connected", String(accounts.length))
  } catch (error) {
    console.error("[linkedin-oauth] callback failed", { email, error })
    profileUrl.searchParams.set("li_error", "exchange")
  }

  return htmlRedirect(profileUrl.toString())
}
