import { sql } from "@/lib/db"
import { SmeSubmissionsView } from "@/components/sme-submissions-view"
import { ListIcon, GaugeIcon, PhoneCallIcon, PresentationIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

const statDef = [
  { key: "total",         label: "Total Submissions", icon: ListIcon },
  { key: "quiz",          label: "Quiz",              icon: GaugeIcon },
  { key: "strategy_call", label: "Strategy Call",     icon: PhoneCallIcon },
  { key: "demo_call",     label: "Demo Call",         icon: PresentationIcon },
]

export default async function SmePage() {
  await requireUser()

  const [submissions, [counts]] = await Promise.all([
    sql`
      SELECT id, type, name, email, phone, source_url, details, created_at
      FROM public.sme_submissions
      ORDER BY created_at DESC
    `,
    sql`
      SELECT COUNT(*)::int                                     AS total,
             COUNT(*) FILTER (WHERE type = 'quiz')::int          AS quiz,
             COUNT(*) FILTER (WHERE type = 'strategy_call')::int AS strategy_call,
             COUNT(*) FILTER (WHERE type = 'demo_call')::int     AS demo_call
      FROM public.sme_submissions
    `,
  ])

  const stats = statDef.map(({ key, label, icon }) => ({
    key, label, icon, value: counts[key],
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">SME</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submissions from sme.searchmadarth.com, stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">public.sme_submissions</code> — {counts.total} records
        </p>
      </div>

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

      <SmeSubmissionsView submissions={submissions} />
    </div>
  )
}
