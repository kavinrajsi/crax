import crypto from "node:crypto"
import { sql } from "@/lib/db"
import { parseSignedRequest } from "@/lib/facebook-leads"

/**
 * Meta's Data Deletion Request callback (POST, form-encoded `signed_request`)
 * — required for any app using Facebook Login. Meta expects the exact JSON
 * shape below in response: a status-check URL plus a confirmation code.
 *
 * Deletion happens synchronously right here (same fb_user_id lookup as
 * deauthorize/route.js), so the GET status page below doesn't need to track
 * anything — by the time Meta or the user checks it, it's already done.
 */
export async function POST(request) {
  const form = await request.formData()
  const payload = parseSignedRequest(form.get("signed_request"), process.env.FB_APP_SECRET)

  if (!payload?.user_id) {
    return Response.json({ error: "Invalid signed_request" }, { status: 400 })
  }

  const removed = await sql`
    DELETE FROM public.facebook_page_connections WHERE fb_user_id = ${payload.user_id} RETURNING page_id
  `
  console.error("[facebook-data-deletion] deletion requested", {
    fbUserId: payload.user_id,
    removedPages: removed.map((r) => r.page_id),
  })

  const confirmationCode = crypto.randomUUID()
  const statusUrl = new URL("/api/facebook/data-deletion", request.url)
  statusUrl.searchParams.set("id", confirmationCode)

  return Response.json({ url: statusUrl.toString(), confirmation_code: confirmationCode })
}

/** The status page Meta's response URL points at. Deletion is synchronous
 * (see POST above), so this just confirms completion — it doesn't look up
 * `id` against anything stored. */
export async function GET() {
  return Response.json({ status: "complete", message: "Data associated with this request has been deleted." })
}
