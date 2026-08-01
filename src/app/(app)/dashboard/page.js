import Link from "next/link"
import { MailIcon, GlobeIcon, AlarmClockIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { requireUser } from "@/lib/dal"
import { sql } from "@/lib/db"
import { sourceDomain } from "@/lib/table-utils"
import { RESOLVED_STATUSES } from "@/lib/follow-up"

export const dynamic = "force-dynamic"


export default async function DashboardPage() {
  const user = await requireUser()
  const firstName = (user.name ?? user.email).split(" ")[0]

  const [contactRows, sourceRows, staleRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'New')::int AS new_count
        FROM public.visible_contacts`,
    // Same view as the total above. These two cards once counted different
    // populations, because one carried the exclusion filter by hand and the
    // other did not; selecting from the view is what stops that recurring.
    sql`SELECT source_url, COUNT(*)::int AS cnt
        FROM public.visible_contacts
        WHERE source_url IS NOT NULL AND source_url <> ''
        GROUP BY source_url
        ORDER BY cnt DESC`,
    /* Open leads nobody has worked. Must match needsAttention() in
       lib/follow-up, which the /data filter uses — if the two disagree this
       card sends you to a list that does not match it. */
    sql`SELECT COUNT(*)::int AS stale
        FROM public.visible_contacts cu
        WHERE cu.status <> ALL(${RESOLVED_STATUSES})
          AND NOT EXISTS(SELECT 1 FROM public.contact_notes      n WHERE n.contact_id = cu.id)
          AND NOT EXISTS(SELECT 1 FROM public.contact_activities a WHERE a.contact_id = cu.id)`,
  ])

  const contactTotal = contactRows[0]?.total ?? 0
  const contactNew   = contactRows[0]?.new_count ?? 0

  // Roll up by domain
  const domainMap = {}
  for (const { source_url, cnt } of sourceRows) {
    const domain = sourceDomain(source_url, "unknown")
    domainMap[domain] = (domainMap[domain] ?? 0) + cnt
  }
  const domainList = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {firstName}.</p>
      </div>

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
                  <Link href={stat.href} className="text-xs text-primary hover:underline w-fit">
                    {stat.sub} →
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
                {domainList.map(([domain, count], i) => (
                  <li key={domain}>
                    {i > 0 && <Separator />}
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

      </div>
    </div>
  )
}
