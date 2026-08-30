import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sql } from "@/lib/db"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

const STATUS_COLORS = Object.fromEntries(
  CONTACT_STATUSES.map((s) => [s.key, s.color])
)

export default async function AnalyticsPage() {
  await requireUser()

  const [statusRows, dailyRows] = await Promise.all([
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM public.contact_us
      GROUP BY status
      ORDER BY count DESC
    `,
    sql`
      SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS count
      FROM public.contact_us
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `,
  ])

  // Contact status max for bar scaling
  const maxStatusCount = Math.max(...statusRows.map((r) => r.count), 1)

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Contact and activity insights</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  )
}
