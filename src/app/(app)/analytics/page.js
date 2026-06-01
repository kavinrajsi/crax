import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { sql, EXCLUDED_EMAILS } from "@/lib/db"

export const dynamic = "force-dynamic"

const STAGE_COLORS = {
  Qualification: "#6366f1",
  Proposal:      "#f59e0b",
  Negotiation:   "#3b82f6",
  "Closed-Won":  "#22c55e",
  "Closed-Lost": "#ef4444",
}

const STATUS_COLORS = {
  New:        "#3b82f6",
  "follow-up":"#f97316",
  win:        "#22c55e",
  closed:     "#64748b",
  rejected:   "#ef4444",
  fake:       "#a855f7",
}

function formatCurrency(v) {
  if (!v) return "₹0"
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`
  return `₹${Math.round(v)}`
}

export default async function AnalyticsPage() {
  const [statusRows, stageRows, dailyRows, activityRows] = await Promise.all([
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM public.contact_us
      WHERE email != ALL(${EXCLUDED_EMAILS})
      GROUP BY status
      ORDER BY count DESC
    `,
    sql`
      SELECT stage,
             COUNT(*)::int AS count,
             COALESCE(SUM(value), 0)::numeric AS total_value
      FROM public.deals
      GROUP BY stage
    `,
    sql`
      SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS count
      FROM public.contact_us
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND email != ALL(${EXCLUDED_EMAILS})
      GROUP BY day
      ORDER BY day ASC
    `,
    sql`
      SELECT type, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed
      FROM public.contact_activities
      GROUP BY type
    `,
  ])

  // Win rate
  const wonDeals  = stageRows.find((r) => r.stage === "Closed-Won")?.count ?? 0
  const lostDeals = stageRows.find((r) => r.stage === "Closed-Lost")?.count ?? 0
  const winRate   = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : null

  // Total pipeline value (excluding lost)
  const pipelineValue = stageRows
    .filter((r) => r.stage !== "Closed-Lost")
    .reduce((s, r) => s + parseFloat(r.total_value), 0)

  // Contact status max for bar scaling
  const maxStatusCount = Math.max(...statusRows.map((r) => r.count), 1)

  // Deal stage ordering
  const STAGE_ORDER = ["Qualification", "Proposal", "Negotiation", "Closed-Won", "Closed-Lost"]
  const stageMap = Object.fromEntries(stageRows.map((r) => [r.stage, r]))
  const maxStageCount = Math.max(...stageRows.map((r) => r.count), 1)

  // Last 30 days — fill missing days
  const dailyMap = Object.fromEntries(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), r.count]))
  const last30 = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    last30.push({ date: key, count: dailyMap[key] ?? 0 })
  }
  const maxDay = Math.max(...last30.map((d) => d.count), 1)
  const totalNewContacts = last30.reduce((s, d) => s + d.count, 0)

  // Activity completion
  const ACTIVITY_TYPES = ["call", "meeting", "email", "task"]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Sales pipeline and contact insights</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Pipeline Value</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{formatCurrency(pipelineValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">excl. Closed-Lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Win Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{winRate != null ? `${winRate}%` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{wonDeals} won · {lostDeals} lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>New Contacts (30d)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{totalNewContacts}</p>
            <p className="text-xs text-muted-foreground mt-0.5">last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Open Deals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {stageRows.filter((r) => r.stage !== "Closed-Won" && r.stage !== "Closed-Lost").reduce((s, r) => s + r.count, 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">across all active stages</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Deal Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Deal Funnel</CardTitle>
            <CardDescription>Deals by pipeline stage</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {STAGE_ORDER.map((stage) => {
              const row = stageMap[stage] ?? { count: 0, total_value: 0 }
              const color = STAGE_COLORS[stage] ?? "#64748b"
              const pct = maxStageCount > 0 ? (row.count / maxStageCount) * 100 : 0
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{stage}</span>
                  <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{ width: `${pct}%`, backgroundColor: `${color}50`, minWidth: row.count > 0 ? "4px" : "0" }}
                    />
                    {row.count > 0 && (
                      <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-medium gap-1.5">
                        <span>{row.count}</span>
                        {parseFloat(row.total_value) > 0 && (
                          <span className="text-muted-foreground">· {formatCurrency(parseFloat(row.total_value))}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Contact Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts by Status</CardTitle>
            <CardDescription>Distribution across CRM stages</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {statusRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts yet.</p>
            )}
            {statusRows.map((row) => {
              const color = STATUS_COLORS[row.status] ?? "#64748b"
              const pct = (row.count / maxStatusCount) * 100
              return (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 text-right capitalize">{row.status}</span>
                  <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg"
                      style={{ width: `${pct}%`, backgroundColor: `${color}50` }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium">{row.count}</span>
                  </div>
                  <span className="text-xs text-muted-foreground w-8 shrink-0 tabular-nums">{Math.round(pct)}%</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* New Contacts (30 days) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>New Contacts — Last 30 Days</CardTitle>
                <CardDescription className="mt-1">{totalNewContacts} contacts added</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">{totalNewContacts} total</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-px h-24 w-full">
              {last30.map(({ date, count }) => (
                <div
                  key={date}
                  className="flex-1 rounded-t-sm bg-primary/50 hover:bg-primary/70 transition-colors cursor-default"
                  style={{
                    height: count > 0 ? `${Math.max((count / maxDay) * 100, 8)}%` : "2px",
                    opacity: count === 0 ? 0.2 : 1,
                  }}
                  title={`${date}: ${count} contact${count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">{last30[0]?.date}</span>
              <span className="text-[10px] text-muted-foreground">{last30[last30.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Completion */}
        {activityRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Activity Completion</CardTitle>
              <CardDescription>Logged activities by type</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ACTIVITY_TYPES.map((type) => {
                const row = activityRows.find((r) => r.type === type) ?? { total: 0, completed: 0 }
                const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0 capitalize">{type}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500/50"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-16 text-right text-muted-foreground">
                      {row.completed}/{row.total} done
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
