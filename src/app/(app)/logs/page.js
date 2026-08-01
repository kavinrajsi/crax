import { sql } from "@/lib/db"
import { LogsView } from "@/components/logs-view"
import { LogInIcon, ShieldAlertIcon, ListIcon, UsersIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

/**
 * Every card must count something the app actually writes. The previous set
 * counted "login", "view_list" and "view_detail" — action names no code has
 * ever produced — so two of the four cards were reporting on nothing and would
 * have read 0 forever once the seed rows were cleared.
 *
 * The counts come from SQL over the whole table, not from the rows below. They
 * used to be computed from the fetched array, which was fine only because the
 * query was unbounded; bounding it without moving these would have quietly
 * turned "Total Events" into "events on this page".
 */
const statDef = [
  { key: "total",  label: "Total Events",       icon: ListIcon },
  { key: "logins", label: "Sign-ins",           icon: LogInIcon },
  { key: "failed", label: "Failed Sign-ins",    icon: ShieldAlertIcon, alert: true },
  { key: "actors", label: "Unique Actors",      icon: UsersIcon },
]

/**
 * How many rows reach the browser.
 *
 * This page shipped every row of audit_logs to a client component with no
 * LIMIT. That was harmless while the table held 28 fixture rows and had no
 * writer at all; as of the audit work there are 30 action types writing to it,
 * so it grows without bound and the page degrades with it.
 */
const LOG_LIMIT = 200

export default async function LogsPage() {
  await requireUser()

  /* `before` is deliberately not selected. It holds a full row snapshot, is the
     largest column by far, and LogsView renders only `after`. */
  const [logs, [counts]] = await Promise.all([
    sql`
      SELECT id, actor_email, actor_user_id, action, target_table, target_id,
             after, ip_address, user_agent, created_at
      FROM public.audit_logs
      ORDER BY created_at DESC
      LIMIT ${LOG_LIMIT}
    `,
    sql`
      SELECT COUNT(*)::int                                                        AS total,
             COUNT(*) FILTER (WHERE action = 'auth.login')::int                   AS logins,
             COUNT(*) FILTER (WHERE action = 'auth.login_failed')::int            AS failed,
             COUNT(DISTINCT actor_email) FILTER (WHERE actor_email IS NOT NULL)::int AS actors
      FROM public.audit_logs
    `,
  ])

  const stats = statDef.map(({ key, label, icon, alert }) => ({
    key, label, icon,
    value: counts[key],
    alert: Boolean(alert) && counts[key] > 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Changes and sign-ins recorded in <code className="text-xs bg-muted px-1 py-0.5 rounded">public.audit_logs</code> — {counts.total} events
          {counts.total > logs.length && `, showing the most recent ${logs.length}`}. Page views are not recorded.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ key, label, icon: Icon, value, alert }) => (
          <Card key={key} className={alert ? "border-destructive/40" : undefined}>
            <CardHeader className="flex-row items-center justify-between pb-1">
              <CardDescription>{label}</CardDescription>
              <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <span className={`font-heading text-2xl font-semibold ${alert ? "text-destructive" : ""}`}>
                {value}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <LogsView logs={logs} total={counts.total} />
    </div>
  )
}
