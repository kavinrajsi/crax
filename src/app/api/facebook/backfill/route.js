import { getUserOrNull } from "@/lib/dal"
import { recordAudit } from "@/lib/audit"
import {
  listConnectedPages,
  fetchLeadForms,
  fetchFormLeads,
  upsertFacebookLead,
} from "@/lib/facebook-leads"

/**
 * Historical Facebook lead pull — the counterpart to the realtime webhook.
 *
 * The webhook only ever sees leads submitted after a Page was subscribed, so
 * anything collected before that is invisible to the CRM until this route
 * walks it: /{page_id}/leadgen_forms → /{form_id}/leads. Both writes go
 * through upsertFacebookLead(), so a backfilled contact is indistinguishable
 * from a webhook one, and re-running is safe — fb_lead_id already recorded
 * comes back as `duplicate` instead of a second contact.
 *
 * Two limits worth knowing before reading the counts:
 *
 *   1. Meta discards lead answers after 90 days. Older submissions are gone
 *      at the source; no endpoint returns them. `leadsCount` on a form (from
 *      Meta's own lifetime counter) will often exceed what GET returns here.
 *   2. Only Pages connected through Profile → Integrations are covered.
 *      getPageAccessToken()'s FB_PAGE_ACCESS_TOKEN fallback has no page_id to
 *      key on, so a manually-tokened Page has no row to enumerate — connect
 *      it via OAuth to back it up.
 *
 * Gated on any signed-in user, not on requireAdmin(). That is the same bar
 * src/app/api/contacts/import/route.js sets, which is the closer precedent —
 * both create contacts in bulk from an external source, and nothing here
 * reads or exposes data the caller could not already see on /data.
 *
 * GET  lists connected Pages and their forms, so a client knows what to loop
 *      over. Cheap: form metadata only, no lead bodies.
 * POST runs exactly one form (?form_id=&page_id=), walking every Graph page
 *      of that form's leads. One form per request keeps each call far under
 *      the platform's 300s ceiling — the real cost is round-trips, one per
 *      100 leads, not compute — and makes a stalled run resumable at form
 *      granularity instead of restarting the whole account.
 */

export async function GET() {
  const user = await getUserOrNull()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const pages = await listConnectedPages()
  if (pages.length === 0) {
    return Response.json({ connected: false, pages: [] })
  }

  const results = []
  for (const page of pages) {
    try {
      const { items, truncated } = await fetchLeadForms(page.page_id, page.access_token)
      results.push({
        pageId: page.page_id,
        pageName: page.page_name,
        truncated,
        forms: items.map((form) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          // Meta's lifetime counter — includes leads past the 90-day window
          // that POST can no longer retrieve. Treat as an upper bound.
          leadsCount: Number(form.leads_count ?? 0),
          createdTime: form.created_time,
        })),
      })
    } catch (error) {
      // A single Page whose token has gone stale must not hide the others.
      console.error("[facebook-backfill] could not list forms", { pageId: page.page_id, error })
      results.push({
        pageId: page.page_id,
        pageName: page.page_name,
        truncated: false,
        forms: [],
        error: "Could not list forms for this Page",
      })
    }
  }

  return Response.json({ connected: true, pages: results })
}

export async function POST(request) {
  const user = await getUserOrNull()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const formId = searchParams.get("form_id")
  const pageId = searchParams.get("page_id")
  if (!formId || !pageId) {
    return Response.json({ error: "form_id and page_id are required" }, { status: 400 })
  }

  const pages = await listConnectedPages()
  const page = pages.find((row) => row.page_id === pageId)
  if (!page) {
    // Not 404-by-form: the caller may well have a valid form id, but without a
    // stored token for its Page there is nothing to authenticate the walk with.
    return Response.json({ error: "That Page is not connected" }, { status: 404 })
  }

  try {
    const { items: leads, truncated } = await fetchFormLeads(formId, page.access_token)

    const counts = { fetched: leads.length, imported: 0, matched: 0, duplicate: 0, skipped: 0, failed: 0 }

    for (const lead of leads) {
      try {
        const result = await upsertFacebookLead(lead, {
          leadgenId: lead.id,
          pageId,
          formId: lead.form_id ?? formId,
        })
        if (result.skipped) counts.skipped += 1
        else if (result.duplicate) counts.duplicate += 1
        else if (result.isNew) counts.imported += 1
        else counts.matched += 1
      } catch (error) {
        // One bad lead must not lose the rest of the form — same rule as the
        // webhook's per-lead catch.
        counts.failed += 1
        console.error("[facebook-backfill] failed to import lead", { leadId: lead.id, formId, error })
      }
    }

    // Bulk writes attributed to a person, unlike the webhook's SYSTEM_ACTOR —
    // someone chose to run this, and the counts are the interesting part.
    await recordAudit(user, "contact.backfilled", {
      table: "contact_us",
      after: { source: "facebook-lead-ads", pageId, formId, truncated, ...counts },
    })

    return Response.json({ ok: true, formId, pageId, truncated, ...counts })
  } catch (error) {
    console.error("[facebook-backfill] form walk failed", { formId, pageId, error })
    return Response.json({ error: "Could not fetch leads for this form" }, { status: 502 })
  }
}
