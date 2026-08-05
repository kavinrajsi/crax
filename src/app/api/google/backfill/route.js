import { getUserOrNull } from "@/lib/dal"
import { recordAudit } from "@/lib/audit"
import { fetchLeadFormSubmissions } from "@/lib/google-ads"
import { upsertGoogleLead, submissionToColumnData, resourceId } from "@/lib/google-leads"

/**
 * Historical Google Ads lead pull — the counterpart to the realtime webhook,
 * and the sibling of src/app/api/facebook/backfill/route.js.
 *
 * The webhook only sees leads submitted after a form asset had Lead delivery
 * → Webhook configured, so anything before that (or anything lost to a failed
 * delivery) never reached the CRM. This reads the same submissions back out of
 * the Reporting API's lead_form_submission_data resource and runs them through
 * upsertGoogleLead(), so a backfilled contact is indistinguishable from a
 * webhook one and re-running is safe.
 *
 * Three limits worth knowing before reading the counts:
 *
 *   1. Google expires lead form submission data — the query is scoped to
 *      LAST_30_DAYS because older rows are not retrievable. Same shape of
 *      constraint as Meta's 90 days, just shorter.
 *   2. This needs the Reporting API credentials (GOOGLE_ADS_* in .env), not
 *      the webhook key. An account with the webhook working but no Ads API
 *      access gets `{ configured: false }` here.
 *   3. Idempotency rests on lead_form_submission_data.id matching the
 *      `lead_id` the webhook sends. If Google ever diverges those two, a lead
 *      already taken by the webhook would not be caught by the google_lead_id
 *      guard — the email dedupe in upsertGoogleLead() is the backstop, and it
 *      appends a note to the existing contact instead of creating a second.
 *      Worth checking the `matched` count on a first run against a live form.
 *
 * Chunked by page token rather than by form: GAQL returns submissions across
 * all forms in one result set, so the natural unit is a page. POST with no
 * page_token starts a walk; the response's nextPageToken feeds the next call.
 *
 * Gated on any signed-in user for the same reason as the Facebook backfill —
 * src/app/api/contacts/import/route.js, the other bulk contact creator, sets
 * that bar rather than requireAdmin()'s.
 */

export async function POST(request) {
  const user = await getUserOrNull()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pageToken = searchParams.get("page_token")

  try {
    const { configured, submissions, nextPageToken } = await fetchLeadFormSubmissions({
      pageToken,
      singlePage: true,
    })

    if (!configured) {
      return Response.json({ configured: false, error: "Google Ads API is not configured" }, { status: 409 })
    }

    const counts = { fetched: submissions.length, imported: 0, matched: 0, duplicate: 0, skipped: 0, failed: 0 }

    for (const submission of submissions) {
      const leadId = String(submission.id ?? "")
      try {
        if (!leadId) {
          counts.skipped += 1
          continue
        }

        const result = await upsertGoogleLead({
          leadId,
          userColumnData: submissionToColumnData(submission),
          // Reporting rows carry full resource names; the webhook carries bare
          // ids. Both must produce the same source_url.
          campaignId: resourceId(submission.campaign),
          formId: resourceId(submission.asset),
          gclid: submission.gclid,
          rawPayload: JSON.stringify(submission),
        })

        if (result.skipped) counts.skipped += 1
        else if (result.duplicate) counts.duplicate += 1
        else if (result.isNew) counts.imported += 1
        else counts.matched += 1
      } catch (error) {
        // One bad submission must not lose the rest of the page — same rule as
        // the webhook's and the Facebook backfill's per-lead catch.
        counts.failed += 1
        console.error("[google-backfill] failed to import lead", { leadId, error })
      }
    }

    // Bulk writes attributed to a person, unlike the webhook's SYSTEM_ACTOR —
    // someone chose to run this, and the counts are the interesting part.
    await recordAudit(user, "contact.backfilled", {
      table: "contact_us",
      after: { source: "google-lead-form", ...counts },
    })

    // nextPageToken null means the walk is complete; a client loops until then.
    return Response.json({ ok: true, configured: true, nextPageToken: nextPageToken ?? null, ...counts })
  } catch (error) {
    console.error("[google-backfill] submission walk failed", { error })
    return Response.json({ error: "Could not fetch lead form submissions" }, { status: 502 })
  }
}
