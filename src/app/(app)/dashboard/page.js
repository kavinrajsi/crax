import { PageShell, PageHeader } from "@/components/page"
import Link from "next/link"
import { MailIcon, GlobeIcon, AlarmClockIcon, ArrowRightIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { requireUser } from "@/lib/dal"
import { sql } from "@/lib/db"
import { DEFAULT_CONTACT_STATUS } from "@/lib/contact-statuses"
import { sourceDomain } from "@/lib/table-utils"

export const dynamic = "force-dynamic"


/** localhost and development.* hosts: where test submissions come from. */
function isNonProductionHost(domain) {
  return (
    domain === "localhost" ||
    domain === "127.0.0.1" ||
    domain.endsWith(".localhost") ||
    domain.startsWith("development.")
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const firstName = (user.name ?? user.email).split(" ")[0]

  const [contactRows, sourceRows, staleRows, stageRows, statusRows, dailyRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = ${DEFAULT_CONTACT_STATUS})::int AS new_count
        FROM public.contact_us`,
    // Same view as the total above. These two cards once counted different
    // populations, because one carried the exclusion filter by hand and the
    // other did not; selecting from the view is what stops that recurring.
    sql`SELECT source_url, COUNT(*)::int AS cnt
        FROM public.contact_us
        WHERE source_url IS NOT NULL AND source_url <> ''
        GROUP BY source_url
        ORDER BY cnt DESC`,
    /* Open leads nobody has worked. Must match needsAttention() in
       lib/follow-up, which the /data filter uses — if the two disagree this
       card sends you to a list that does not match it. */
    sql`SELECT COUNT(*)::int AS stale
        FROM public.contact_us cu
        WHERE cu.status NOT IN (SELECT key FROM public.pipeline_stages WHERE resolved)
          AND NOT EXISTS(SELECT 1 FROM public.contact_notes n WHERE n.contact_id = cu.id)`,
    sql`SELECT key, color FROM public.pipeline_stages`,
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

  const contactTotal = contactRows[0]?.total ?? 0
  const contactNew   = contactRows[0]?.new_count ?? 0

  // Roll up by domain. Local and dev hosts are test submissions, not leads,
  // so they stay out of the breakdown (the rows themselves are kept).
  const domainMap = {}
  for (const { source_url, cnt } of sourceRows) {
    const domain = sourceDomain(source_url, "unknown")
    if (isNonProductionHost(domain)) continue
    domainMap[domain] = (domainMap[domain] ?? 0) + cnt
  }
  const domainList = Object.entries(domainMap)
    .sort((first, second) => second[1] - first[1])

  /* Bars are scaled against the largest domain, not contactTotal.
     contactTotal counts contacts with no source_url at all, so no bar could
     ever reach full width: the top domain rendered at 56 of 80px and
     everything below third place collapsed to 1px, which reads as identical.
     Guarding the divisor also keeps an empty database from producing
     `width: NaNpx`. */
  const maxDomainCount = domainList[0]?.[1] ?? 0
  const barWidth = (count) =>
    maxDomainCount > 0 ? Math.max(4, Math.round((count / maxDomainCount) * 80)) : 0

  const staleCount = staleRows[0]?.stale ?? 0

  // Every stage's colour, from the database, so custom stages are coloured too.
  const stageColors = Object.fromEntries(stageRows.map((stageRow) => [stageRow.key, stageRow.color]))

  // Contacts by status: bars scale against the largest status.
  const maxStatusCount = Math.max(...statusRows.map((statusRow) => statusRow.count), 1)

  // Last 30 days, with missing days filled in as zero.
  const dailyCounts = Object.fromEntries(dailyRows.map((dailyRow) => [dailyRow.day.toISOString().slice(0, 10), dailyRow.count]))
  const last30Days = []
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = new Date()
    day.setDate(day.getDate() - dayOffset)
    const dayKey = day.toISOString().slice(0, 10)
    last30Days.push({ date: dayKey, count: dailyCounts[dayKey] ?? 0 })
  }
  const maxDayCount = Math.max(...last30Days.map((dayEntry) => dayEntry.count), 1)
  const totalNewContacts = last30Days.reduce((total, dayEntry) => total + dayEntry.count, 0)

  const stats = [
    { label: "Total Contacts",  value: contactTotal,      icon: MailIcon,  sub: `${contactNew} new` },
    { label: "Unique Sources",  value: domainList.length, icon: GlobeIcon, sub: "distinct domains" },
    {
      label: "Needs Attention",
      value: staleCount,
      icon: AlarmClockIcon,
      sub: "open, never worked",
      href: "/data?attention=1",
      alert: staleCount > 0,
    },
  ]

  return (
    <PageShell>
      <PageHeader title="Dashboard" description={`Welcome back, ${firstName}.`} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.label}
              className={stat.alert ? "border-destructive/40" : undefined}
            >
              <CardHeader className="flex-row items-center justify-between pb-1">
                <CardDescription>{stat.label}</CardDescription>
                <Icon className={`h-4 w-4 ${stat.alert ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                <span className={`font-heading text-2xl font-semibold ${stat.alert ? "text-destructive" : ""}`}>
                  {stat.value ?? "—"}
                </span>
                {stat.href ? (
                  <Link href={stat.href} className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline">
                    {stat.sub}
                    <ArrowRightIcon className="size-3" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">{stat.sub}</span>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4">
        {/* Source breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts by Source</CardTitle>
            <CardDescription>Total submissions grouped by domain</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {domainList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No contacts with a source yet.
              </p>
            ) : (
              <ul>
                {domainList.map(([domain, count], index) => (
                  <li key={domain}>
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm truncate">{domain}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div
                          className="h-1.5 rounded-full bg-primary/40"
                          style={{ width: `${barWidth(count)}px` }}
                        />
                        <Badge variant="secondary" className="text-xs tabular-nums">{count}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Contacts by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Contacts by Status</CardTitle>
              <CardDescription>Distribution across CRM stages</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {statusRows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No contacts yet.</p>
              )}
              {statusRows.map((statusRow) => {
                const color = stageColors[statusRow.status] ?? "#64748b"
                const percent = (statusRow.count / maxStatusCount) * 100
                return (
                  <div key={statusRow.status} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0 text-right capitalize">{statusRow.status}</span>
                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg"
                        style={{ width: `${percent}%`, backgroundColor: `${color}50` }}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium">{statusRow.count}</span>
                    </div>
                    <span className="text-xs text-muted-foreground w-8 shrink-0 tabular-nums">{Math.round(percent)}%</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* New Contacts (30 days) */}
          <Card className="md:col-span-2">
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
                {last30Days.map(({ date, count }) => (
                  <div
                    key={date}
                    className="flex-1 rounded-t-sm bg-primary/50 hover:bg-primary/70 transition-colors cursor-default"
                    style={{
                      height: count > 0 ? `${Math.max((count / maxDayCount) * 100, 8)}%` : "2px",
                      opacity: count === 0 ? 0.2 : 1,
                    }}
                    title={`${date}: ${count} contact${count !== 1 ? "s" : ""}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">{last30Days[0]?.date}</span>
                <span className="text-[10px] text-muted-foreground">{last30Days[last30Days.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
