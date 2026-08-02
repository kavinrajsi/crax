import { sql } from "@/lib/db"
import { parseSignedRequest } from "@/lib/facebook-leads"

/**
 * Meta calls this (POST, form-encoded `signed_request`) whenever someone
 * removes this app's access from their Facebook account settings. Required
 * by Meta for any app using Facebook Login, regardless of whether this app
 * has a matching connection for that user.
 *
 * Deletes every Page connection tied to that Facebook user — fb_user_id is
 * captured during the OAuth callback specifically so this lookup works;
 * without it there would be no way to map this payload's numeric user_id
 * back to a row (page_id and connected_by_email alone don't reach it).
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
  console.error("[facebook-deauthorize] app deauthorized", {
    fbUserId: payload.user_id,
    removedPages: removed.map((r) => r.page_id),
  })

  return Response.json({ ok: true })
}
