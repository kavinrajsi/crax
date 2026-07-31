import Link from "next/link"
import { MailIcon, GlobeIcon, AlarmClockIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { requireUser } from "@/lib/dal"
import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { sourceDomain } from "@/lib/table-utils"
import { RESOLVED_STATUSES, STALE_AFTER_DAYS } from "@/lib/follow-up"

export const dynamic = "force-dynamic"


export default async function DashboardPage() {
  const user = await requireUser()
  const firstName = (user.name ?? user.email).split(" ")[0]

  const [contactRows, sourceRows, staleRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'New')::int AS new_count
        FROM public.contact_us
        WHERE email != ALL(${EXCLUDED_EMAILS})`,
    // Must carry the same EXCLUDED_EMAILS filter as the total above, or the two
    // cards count different populations and never reconcile.
    sql`SELECT source_url, COUNT(*)::int AS cnt
        FROM public.contact_us
        WHERE source_url IS NOT NULL AND source_url <> ''
          AND email != ALL(${EXCLUDED_EMAILS})
        GROUP BY source_url
        ORDER BY cnt DESC`,
    /* Open leads with no note or activity for STALE_AFTER_DAYS. Must match
       needsAttention() in lib/follow-up, which the /data filter uses — if the
       two disagree this card sends you to a list that does not match it. */
    sql`SELECT COUNT(*)::int AS stale
        FROM public.contact_us cu
        WHERE cu.email != ALL(${EXCLUDED_EMAILS})
          AND cu.status <> ALL(${RESOLVED_STATUSES})
          AND GREATEST(
                cu.created_at,
                COALESCE((SELECT MAX(created_at) FROM public.contact_notes      n WHERE n.contact_id = cu.id), cu.created_at),
                COALESCE((SELECT MAX(created_at) FROM public.contact_activities a WHERE a.contact_id = cu.id), cu.created_at)
              ) < NOW() - MAKE_INTERVAL(days => ${STALE_AFTER_DAYS})`,
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

  const staleCount = staleRows[0]?.stale ?? 0

  const stats = [
    { label: "Total Contacts",  value: contactTotal,      icon: MailIcon,  sub: `${contactNew} new` },
    { label: "Unique Sources",  value: domainList.length, icon: GlobeIcon, sub: "distinct domains" },
    {
      label: "Needs Attention",
      value: staleCount,
      icon: AlarmClockIcon,
      sub: `open, untouched ${STALE_AFTER_DAYS}+ days`,
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
            <ul>
              {domainList.map(([domain, count], i) => (
                <li key={domain}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm truncate">{domain}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div
                        className="h-1.5 rounded-full bg-primary/40"
                        style={{ width: `${Math.round((count / contactTotal) * 80)}px` }}
                      />
                      <Badge variant="secondary" className="text-xs tabular-nums">{count}</Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
