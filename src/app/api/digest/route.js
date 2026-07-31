import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { getUserOrNull } from "@/lib/dal"
import { RESOLVED_STATUSES } from "@/lib/follow-up"

/**
 * Daily follow-up digest.
 *
 * The "needs attention" count on the dashboard only helps someone who already
 * opened the dashboard. 53 of 85 leads had never been worked, so nobody was.
 * This is the push half: a scheduled summary that arrives whether or not
 * anyone logs in.
 *
 * Delivery is a generic webhook (DIGEST_WEBHOOK_URL) posting {text}, which is
 * what Slack, Discord, Zapier, Make and n8n all accept. No provider SDK, no
 * account to create. If the variable is unset the digest is still computed and
 * returned in the response, so the endpoint is useful before delivery is wired
 * up and never fails merely because it has nowhere to send.
 *
 * Schedule lives in vercel.json. Vercel Cron authenticates with
 * `Authorization: Bearer $CRON_SECRET`; a signed-in user may also call it by
 * hand to preview.
 */

export const dynamic = "force-dynamic"

function authorize(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, reason: "CRON_SECRET is not set" }
  return {
    ok: request.headers.get("authorization") === `Bearer ${secret}`,
    reason: "bad or missing bearer token",
  }
}

export async function GET(request) {
  /* Either the scheduler with the shared secret, or a signed-in human
     previewing it. Anything else is refused — this endpoint reports how many
     leads exist and how old they are, which is business data. */
  const cron = authorize(request)
  if (!cron.ok && !(await getUserOrNull())) {
    console.error("[digest] refused", { reason: cron.reason })
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let stats
  try {
    const [row] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE cu.created_at > NOW() - INTERVAL '24 hours')::int AS arrived_today,
        COUNT(*) FILTER (WHERE cu.status <> ALL(${RESOLVED_STATUSES}))::int AS open_total,
        COUNT(*) FILTER (
          WHERE cu.status <> ALL(${RESOLVED_STATUSES})
            AND NOT EXISTS(SELECT 1 FROM public.contact_notes      n WHERE n.contact_id = cu.id)
            AND NOT EXISTS(SELECT 1 FROM public.contact_activities a WHERE a.contact_id = cu.id)
        )::int AS needs_attention,
        MIN(cu.created_at) FILTER (
          WHERE cu.status <> ALL(${RESOLVED_STATUSES})
            AND NOT EXISTS(SELECT 1 FROM public.contact_notes      n WHERE n.contact_id = cu.id)
            AND NOT EXISTS(SELECT 1 FROM public.contact_activities a WHERE a.contact_id = cu.id)
        ) AS oldest_untouched
      FROM public.contact_us cu
      WHERE cu.email != ALL(${EXCLUDED_EMAILS})
    `
    stats = row
  } catch (error) {
    console.error("[digest] query failed", { error })
    return Response.json({ error: "Could not build digest" }, { status: 500 })
  }

  const oldestDays = stats.oldest_untouched
    ? Math.floor((Date.now() - new Date(stats.oldest_untouched).getTime()) / 86_400_000)
    : null

  const lines = [
    `*${stats.arrived_today}* new lead${stats.arrived_today === 1 ? "" : "s"} in the last 24h`,
    `*${stats.needs_attention}* of ${stats.open_total} open leads have never been worked`,
  ]
  if (oldestDays != null) lines.push(`Oldest untouched: *${oldestDays} days*`)
  const text = lines.join("\n")

  const webhookUrl = process.env.DIGEST_WEBHOOK_URL
  let delivered = false
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      delivered = response.ok
      if (!response.ok) {
        console.error("[digest] webhook rejected", { status: response.status })
      }
    } catch (error) {
      // A delivery failure must not fail the run — the numbers are still in
      // the response and the next schedule will try again.
      console.error("[digest] webhook unreachable", { error })
    }
  }

  return Response.json({
    ok: true,
    delivered,
    deliveryConfigured: Boolean(webhookUrl),
    text,
    stats: {
      arrivedToday: stats.arrived_today,
      openTotal: stats.open_total,
      needsAttention: stats.needs_attention,
      oldestUntouchedDays: oldestDays,
    },
  })
}
