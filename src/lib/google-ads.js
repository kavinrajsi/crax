import { OAuth2Client } from "google-auth-library"

/**
 * Google Ads Reporting (GAQL) — campaign performance, read-only. Unrelated
 * to src/lib/google-leads.js: that module handles inbound lead-form
 * webhooks with no auth surface, this one calls the Ads API and needs a
 * full OAuth2 credential set (client id/secret, developer token, refresh
 * token, customer id).
 *
 * There is no official Node/JS client for the Ads API — Google only ships
 * one for Java/.NET/PHP/Python/Ruby/Perl — so this calls the documented
 * REST `:search` endpoint directly and uses google-auth-library (Google's
 * own package) purely for the OAuth2 access-token refresh.
 */

// Bump when Google sunsets this version — check
// https://developers.google.com/google-ads/api/docs/release-notes first.
const API_VERSION = "v25"

const FETCH_TIMEOUT_MS = 8000

/**
 * Ceiling on nextPageToken hops in one search() walk. Same reasoning as
 * MAX_PAGES in src/lib/facebook-leads.js: a cursor that fails to advance
 * should end as a reported truncation, not as a route that runs until the
 * platform kills it.
 */
const MAX_PAGES = 100

/** Strips everything but digits — customer IDs get pasted with dashes from the Ads UI. */
function digitsOnly(value) {
  return (value ?? "").replace(/\D/g, "")
}

/** True once every required env var is set. Callers use this to fail closed with a clear state rather than a half-configured request. */
export function isGoogleAdsConfigured() {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  )
}

/**
 * Exchanges the standing refresh token for a short-lived access token.
 * OAuth2Client caches and re-refreshes internally, but this module has no
 * long-lived instance to cache it on (route handlers are stateless), so
 * every call here does one refresh — acceptable at this feature's
 * request volume.
 */
async function getAccessToken() {
  const client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN })
  const { token } = await client.getAccessToken()
  if (!token) throw new Error("Google Ads OAuth refresh returned no access token")
  return token
}

/**
 * Runs a GAQL query and returns every row, following nextPageToken.
 *
 * Until this existed, callers took `data.results` from the first response and
 * logged a warning if a nextPageToken was present — so an account with more
 * campaigns than one page silently rendered a partial list. Anything that
 * queries the Ads API should go through here.
 *
 * `pageToken` resumes a walk a caller stopped earlier; `maxPages: 1` fetches a
 * single page and hands back `nextPageToken` so the caller can drive its own
 * loop across requests.
 *
 * A non-null `nextPageToken` in the result means "more rows exist" and nothing
 * more — whether that is the safety ceiling or a caller who asked to stop is
 * something only the caller knows, so it interprets it rather than being told.
 */
async function search(query, { pageToken = null, maxPages = MAX_PAGES } = {}) {
  const customerId = digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID)
  const loginCustomerId = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
  const accessToken = await getAccessToken()

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  }
  // Only a manager (MCC) account needs this — the queried customerId must
  // be the child account, never the manager itself, or the query returns
  // zero rows with no error.
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId

  const rows = []
  let token = pageToken
  let page = 0

  do {
    const response = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(token ? { query, pageToken: token } : { query }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      // Google's error body can include the customer ID and token hints in
      // error.details[].errors[] — logged for debugging, never forwarded to
      // the client.
      const errorBody = await response.text()
      console.error("[google-ads] search request failed", { status: response.status, errorBody })
      throw new Error(`Google Ads API responded ${response.status}`)
    }

    const data = await response.json()
    rows.push(...(data.results ?? []))
    token = data.nextPageToken ?? null
    page += 1
  } while (token && page < maxPages)

  return { rows, nextPageToken: token }
}

/**
 * Campaign performance aggregated over the last 30 days, one row per
 * campaign. Omitting segments.date from the SELECT (while still filtering
 * on it) makes the API sum metrics across the range instead of returning
 * one row per campaign per day — a day-by-day series isn't what the
 * dashboard renders today.
 */
const CAMPAIGN_PERFORMANCE_QUERY = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    metrics.clicks,
    metrics.impressions,
    metrics.cost_micros,
    metrics.conversions
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY metrics.cost_micros DESC
`

/**
 * Fetches and shapes campaign performance for the connected account.
 * Returns `{ configured: false }` rather than throwing when env vars are
 * missing, so callers (a server page, a route handler) can render a
 * "not configured" state instead of a broken page.
 */
export async function fetchCampaignPerformance() {
  if (!isGoogleAdsConfigured()) return { configured: false, campaigns: [] }

  // This walk never stops early by choice, so a token left over means it hit
  // MAX_PAGES with rows still waiting — the one case where the list is short.
  const { rows, nextPageToken } = await search(CAMPAIGN_PERFORMANCE_QUERY)
  if (nextPageToken) {
    console.error("[google-ads] campaign results truncated — hit MAX_PAGES with more results waiting")
  }

  // REST responses are camelCase regardless of the query's snake_case field names.
  const campaigns = rows.map((row) => ({
    id: row.campaign?.id,
    name: row.campaign?.name ?? "(unnamed campaign)",
    status: row.campaign?.status,
    clicks: Number(row.metrics?.clicks ?? 0),
    impressions: Number(row.metrics?.impressions ?? 0),
    costMicros: Number(row.metrics?.costMicros ?? 0),
    cost: Number(row.metrics?.costMicros ?? 0) / 1e6,
    conversions: Number(row.metrics?.conversions ?? 0),
  }))

  return { configured: true, campaigns }
}

/**
 * Every lead form submission the API still holds.
 *
 * `lead_form_submission_data` is a resource without metrics, so no metrics.*
 * column may appear alongside it. Scoped to LAST_30_DAYS because Google
 * expires submissions — asking for more returns nothing extra.
 *
 * Fields reference:
 * https://developers.google.com/google-ads/api/fields/v25/lead_form_submission_data
 */
const LEAD_SUBMISSION_QUERY = `
  SELECT
    lead_form_submission_data.id,
    lead_form_submission_data.asset,
    lead_form_submission_data.campaign,
    lead_form_submission_data.ad_group,
    lead_form_submission_data.ad_group_ad,
    lead_form_submission_data.gclid,
    lead_form_submission_data.submission_date_time,
    lead_form_submission_data.lead_form_submission_fields,
    lead_form_submission_data.custom_lead_form_submission_fields
  FROM lead_form_submission_data
  WHERE segments.date DURING LAST_30_DAYS
`

/**
 * Lead form submissions for the connected account — the read side of what
 * src/app/api/google/webhook/route.js receives as pushes, and what makes a
 * backfill possible at all. Note this rides the Reporting API credential set
 * (GOOGLE_ADS_* env vars), not the webhook key, and returns
 * `{ configured: false }` rather than throwing when those are missing.
 *
 * `singlePage` fetches one page and hands back nextPageToken so a caller can
 * spread a long walk across separate requests.
 */
export async function fetchLeadFormSubmissions({ pageToken = null, singlePage = false } = {}) {
  if (!isGoogleAdsConfigured()) return { configured: false, submissions: [], nextPageToken: null }

  const { rows, nextPageToken } = await search(LEAD_SUBMISSION_QUERY, {
    pageToken,
    maxPages: singlePage ? 1 : MAX_PAGES,
  })

  const submissions = rows.map((row) => row.leadFormSubmissionData).filter(Boolean)

  return { configured: true, submissions, nextPageToken }
}
