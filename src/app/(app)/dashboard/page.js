import Link from "next/link"
import { MailIcon, GlobeIcon, ScrollTextIcon, CheckSquareIcon, PhoneIcon, CalendarIcon, AlertCircleIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { sql, EXCLUDED_EMAILS } from "@/lib/db"

export const dynamic = "force-dynamic"

function formatTimeAgo(iso) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(str) {
  return (str || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

function sourceDomain(url) {
  try { return new URL(url).hostname.replace("www.", "") }
  catch { return url || "unknown" }
}

export default async function DashboardPage() {
  const { data: session } = await auth.getSession()
  const firstName = (session?.user?.name ?? session?.user?.email ?? "there").split(" ")[0]

  const [contactRows, auditRows, sourceRows, recentLogs, upcomingTasks] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'New')::int AS new_count
        FROM public.contact_us
        WHERE email != ALL(${EXCLUDED_EMAILS})`,
    sql`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE action = 'login')::int AS logins
        FROM public.audit_logs`,
    sql`SELECT source_url, COUNT(*)::int AS cnt
        FROM public.contact_us
        WHERE source_url IS NOT NULL AND source_url <> ''
        GROUP BY source_url
        ORDER BY cnt DESC`,
    sql`SELECT actor_email, action, target_table, target_id, created_at
        FROM public.audit_logs
        ORDER BY created_at DESC
        LIMIT 8`,
    sql`SELECT ca.id, ca.type, ca.title, ca.due_at, ca.contact_id, cu.name AS contact_name
        FROM public.contact_activities ca
        JOIN public.contact_us cu ON cu.id = ca.contact_id
        WHERE ca.completed_at IS NULL
          AND ca.due_at IS NOT NULL
          AND ca.due_at <= NOW() + INTERVAL '7 days'
        ORDER BY ca.due_at ASC
        LIMIT 8`,
  ])

  const contactTotal = contactRows[0]?.total ?? 0
  const contactNew   = contactRows[0]?.new_count ?? 0
  const auditTotal   = auditRows[0]?.total ?? 0
  const loginCount   = auditRows[0]?.logins ?? 0

  // Roll up by domain
  const domainMap = {}
  for (const { source_url, cnt } of sourceRows) {
    const domain = sourceDomain(source_url)
    domainMap[domain] = (domainMap[domain] ?? 0) + cnt
  }
  const domainList = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])

  const stats = [
    { label: "Total Contacts",  value: contactTotal,      icon: MailIcon,        sub: `${contactNew} new` },
    { label: "Unique Sources",  value: domainList.length, icon: GlobeIcon,       sub: "distinct domains" },
    { label: "Audit Events",    value: auditTotal,        icon: ScrollTextIcon,  sub: `${loginCount} logins` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {firstName}.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex-row items-center justify-between pb-1">
                <CardDescription>{stat.label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                <span className="font-heading text-2xl font-semibold">{stat.value ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{stat.sub}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

        {/* Upcoming tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Tasks</CardTitle>
              <Badge variant={upcomingTasks.some(t => new Date(t.due_at) < new Date()) ? "destructive" : "secondary"}>
                {upcomingTasks.length}
              </Badge>
            </div>
            <CardDescription>Due within the next 7 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingTasks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No upcoming tasks.</p>
            ) : (
              <ul>
                {upcomingTasks.map((task, i) => {
                  const due = new Date(task.due_at)
                  const now = new Date()
                  const isOverdue = due < now
                  const diff = Math.round((due - now) / 86400000)
                  const dueLabel = isOverdue
                    ? `${Math.abs(diff)}d overdue`
                    : diff === 0 ? "Today"
                    : diff === 1 ? "Tomorrow"
                    : `${diff}d left`
                  const TypeIcon = { call: PhoneIcon, meeting: CalendarIcon, email: MailIcon, task: CheckSquareIcon }[task.type] ?? CheckSquareIcon
                  return (
                    <li key={task.id}>
                      {i > 0 && <Separator />}
                      <Link href={`/contacts/${task.contact_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                        <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-1 flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{task.title}</span>
                          <span className="text-xs text-muted-foreground truncate">{task.contact_name}</span>
                        </div>
                        <span className={`text-xs shrink-0 font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {isOverdue && <AlertCircleIcon className="h-3 w-3 inline mr-1" />}
                          {dueLabel}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent audit activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Badge variant="secondary">{recentLogs.length} events</Badge>
            </div>
            <CardDescription>Latest entries from audit_logs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentLogs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul>
                {recentLogs.map((row, i) => (
                  <li key={`${row.created_at}-${i}`}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">{initials(row.actor_email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-1 flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{row.actor_email}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.action}
                          {row.target_table ? ` · ${row.target_table}${row.target_id ? ` #${row.target_id}` : ""}` : ""}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(row.created_at)}
                      </span>
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
