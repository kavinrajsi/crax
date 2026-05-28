import { sql } from "@/lib/db"
import { LogsView } from "@/components/logs-view"
import { LogInIcon, EyeIcon, ListIcon, UsersIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"

export const dynamic = "force-dynamic"

const statDef = [
  {
    key: "total",
    label: "Total Events",
    icon: ListIcon,
    compute: (rows) => rows.length,
  },
  {
    key: "logins",
    label: "Logins",
    icon: LogInIcon,
    compute: (rows) => rows.filter((r) => r.action === "login").length,
  },
  {
    key: "views",
    label: "View Events",
    icon: EyeIcon,
    compute: (rows) =>
      rows.filter((r) => r.action === "view_list" || r.action === "view_detail").length,
  },
  {
    key: "actors",
    label: "Unique Actors",
    icon: UsersIcon,
    compute: (rows) => new Set(rows.map((r) => r.actor_email).filter(Boolean)).size,
  },
]

export default async function LogsPage() {
  const logs = await sql`
    SELECT * FROM public.audit_logs ORDER BY created_at DESC
  `

  const stats = statDef.map(({ key, label, icon, compute }) => ({
    key,
    label,
    icon,
    value: compute(logs),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete activity trail from <code className="text-xs bg-muted px-1 py-0.5 rounded">public.audit_logs</code> — {logs.length} events
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ key, label, icon: Icon, value }) => (
          <Card key={key}>
            <CardHeader className="flex-row items-center justify-between pb-1">
              <CardDescription>{label}</CardDescription>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="font-heading text-2xl font-semibold">{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <LogsView logs={logs} />
    </div>
  )
}
