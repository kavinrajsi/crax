import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogsView } from "@/components/logs-view"
import { requireAdmin } from "@/lib/dal"
import { sql } from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"
import { LOG_PAGE_LIMIT } from "@/lib/audit"
import { formatDate, timeAgo } from "@/lib/table-utils"

export const dynamic = "force-dynamic"

/**
 * One user's log, separately from /logs.
 *
 * Same LogsView the combined page renders, so the two cannot drift into
 * showing different columns for the same row. The difference is the WHERE
 * clause and the counts beside it.
 *
 * Matched on `lower(actor_email)`, because audit_logs records the address that
 * acted and has no foreign key to `neon_auth."user"`. A consequence worth
 * knowing: if an account changes its email, its earlier events stay under the
 * old address and stop appearing here.
 */


export default async function AdminUserLogPage({ params }) {
  await requireAdmin()
  const { id } = await params

  /* Parameterised, and the column is a uuid — a non-uuid id makes Postgres
     raise rather than match, so it is caught below rather than 500ing. */
  let users
  try {
    users = await sql`
      /* emailVerified omitted — see the note in ../page.js. Neon Auth never
         sends a verification email, so it is false for everyone forever. */
      SELECT id, name, email,
             "createdAt" AS created_at, banned, "banReason" AS ban_reason
      FROM neon_auth."user"
      WHERE id = ${id}
    `
  } catch {
    notFound()
  }

  const user = users?.[0]
  if (!user) notFound()

  const [logs, [counts], [session]] = await Promise.all([
    /* `before` is deliberately not selected — a full row snapshot, the largest
       column by far, and LogsView renders only `after`. Same call as /logs. */
    sql`
      SELECT id, actor_email, actor_user_id, action, target_table, target_id,
             after, ip_address, user_agent, created_at
      FROM public.audit_logs
      WHERE lower(actor_email) = lower(${user.email})
      ORDER BY created_at DESC
      LIMIT ${LOG_PAGE_LIMIT}
    `,
    sql`
      SELECT COUNT(*)::int                                             AS total,
             COUNT(*) FILTER (WHERE action = 'auth.login')::int        AS logins,
             COUNT(*) FILTER (WHERE action = 'auth.login_failed')::int AS failed,
             MAX(created_at)                                           AS last_event
      FROM public.audit_logs
      WHERE lower(actor_email) = lower(${user.email})
    `,
    sql`
      SELECT MAX("createdAt") AS last_session
      FROM neon_auth.session
      WHERE "userId" = ${user.id}
    `,
  ])

  const admin = isAdminEmail(user.email, process.env.SUPER_ADMIN_EMAILS)

  const facts = [
    { key: "joined", label: "Joined", value: formatDate(user.created_at) },
    {
      key: "session",
      label: "Last session",
      value: session?.last_session ? timeAgo(session.last_session) : "No live session",
    },
    { key: "events", label: "Recorded Events", value: counts.total },
    { key: "logins", label: "Sign-ins", value: counts.logins },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to All Users
        </Link>

        <h1 className="font-heading text-2xl font-semibold tracking-tight mt-2">
          {user.name || user.email}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          {admin && <Badge variant="secondary">Super admin</Badge>}
          {user.banned && <Badge variant="destructive">Banned{user.ban_reason ? `: ${user.ban_reason}` : ""}</Badge>}
        </div>

        <p className="text-sm text-muted-foreground mt-2">
          Events recorded for this address
          {counts.total > logs.length && `, showing the most recent ${logs.length}`}.
          {counts.failed > 0 && ` ${counts.failed} failed sign-in${counts.failed === 1 ? "" : "s"}.`}
          {" "}Page views are not recorded.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {facts.map(({ key, label, value }) => (
          <Card key={key}>
            <CardHeader className="pb-1">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="font-heading text-lg font-semibold">{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events recorded for {user.email}. The audit trail only holds what the app has written
            since it was added, so this is empty rather than wrong for an account that has not
            changed anything since.
          </CardContent>
        </Card>
      ) : (
        <LogsView logs={logs} total={counts.total} />
      )}
    </div>
  )
}
