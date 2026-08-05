import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { requireUser } from "@/lib/dal"
import { fetchCampaignPerformance } from "@/lib/google-ads"
import { GoogleBackfillCard } from "@/components/lead-backfill"

export const dynamic = "force-dynamic"

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export default async function AdsPage() {
  await requireUser()

  const { configured, campaigns } = await fetchCampaignPerformance()

  const totalCost = campaigns.reduce((s, c) => s + c.cost, 0)
  const maxCost = Math.max(...campaigns.map((c) => c.cost), 1)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Google Ads</h1>
        <p className="text-sm text-muted-foreground mt-1">Campaign performance — last 30 days</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaigns by Spend</CardTitle>
              <CardDescription className="mt-1">Clicks, impressions, and conversions per campaign</CardDescription>
            </div>
            {configured && <Badge variant="secondary" className="text-xs">{CURRENCY.format(totalCost)} total</Badge>}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!configured && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Google Ads isn&apos;t connected yet — set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
              GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN, and GOOGLE_ADS_CUSTOMER_ID to enable this page.
            </p>
          )}
          {configured && campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No campaign activity in the last 30 days.</p>
          )}
          {configured && campaigns.map((c) => {
            const pct = (c.cost / maxCost) * 100
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-40 shrink-0 text-right truncate" title={c.name}>
                  {c.name}
                </span>
                <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                  <div className="h-full rounded-lg bg-primary/50" style={{ width: `${pct}%` }} />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium">
                    {CURRENCY.format(c.cost)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums text-right">
                  {c.clicks.toLocaleString()} clicks
                </span>
                <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums text-right">
                  {c.conversions.toLocaleString()} conv.
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Gated on the same `configured` flag as the chart above: the backfill
          rides the same GOOGLE_ADS_* credentials, so offering it on an
          unconfigured account would only ever produce a 409. */}
      {configured && <GoogleBackfillCard />}
    </div>
  )
}
