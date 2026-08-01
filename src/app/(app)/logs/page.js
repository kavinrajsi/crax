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
 */
const statDef = [
  {
    key: "total",
    label: "Total Events",
    icon: ListIcon,
    compute: (rows) => rows.length,
  },
  {
    key: "logins",
    label: "Sign-ins",
    icon: LogInIcon,
    compute: (rows) => rows.filter((r) => r.action === "auth.login").length,
  },
  {
    key: "failed",
    label: "Failed Sign-ins",
    icon: ShieldAlertIcon,
    compute: (rows) => rows.filter((r) => r.action === "auth.login_failed").length,
    alert: true,
  },
  {
    key: "actors",
    label: "Unique Actors",
    icon: UsersIcon,
    compute: (rows) => new Set(rows.map((r) => r.actor_email).filter(Boolean)).size,
  },
]

export default async function LogsPage() {
  await requireUser()

  const logs = await sql`
    SELECT * FROM public.audit_logs ORDER BY created_at DESC
  `

  const stats = statDef.map(({ key, label, icon, compute, alert }) => {
    const value = compute(logs)
    return { key, label, icon, value, alert: Boolean(alert) && value > 0 }
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Changes and sign-ins recorded in <code className="text-xs bg-muted px-1 py-0.5 rounded">public.audit_logs</code> — {logs.length} events. Page views are not recorded.
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
      <LogsView logs={logs} />
    </div>
  )
}
