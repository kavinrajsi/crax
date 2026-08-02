import Link from "next/link"
import { UsersIcon, ShieldCheckIcon, KeyRoundIcon, ActivityIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireAdmin } from "@/lib/dal"
import { sql } from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"
import { formatDate, timeAgo } from "@/lib/table-utils"
import { LOG_PAGE_LIMIT } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * Every account that can sign in, and how much each has done.
 *
 * The rows come from `neon_auth."user"`, which Neon Auth maintains in this same
 * database — there is no separate users table in `public`, and nothing here
 * writes to `neon_auth`. Reads only.
 *
 * Quoting matters in that schema and is fatal if dropped: `user` is a reserved
 * word, and `createdAt` / `emailVerified` / `userId` are camelCase identifiers
 * that Postgres would otherwise fold to lower case.
 *
 * Sign-in recency comes from `neon_auth.session`, not from audit_logs: the
 * session table is written by the auth service on every sign-in, while
 * `auth.login` rows only exist for sign-ins since the audit trail was added.
 * Rows there are pruned as sessions expire, so "never" in that column means
 * "no live session", not "never signed in".
 */

export default async function AdminUsersPage() {
  await requireAdmin()

  const [users, [totals]] = await Promise.all([
    sql`
      SELECT u.id,
             u.name,
             u.email,
             /* emailVerified is deliberately not selected. Neon Auth is
                configured with sendVerificationEmailOnSignUp and
                sendVerificationEmailOnSignIn both false and
                requireEmailVerification false, and neon_auth.verification is
                empty — no verification email is ever sent, so the column
                cannot become true for anyone. Showing it put an "Unverified"
                badge on every row that no action could ever clear. */
             u."createdAt"     AS created_at,
             u.banned,
             s.last_session,
             a.events,
             a.last_event
      FROM neon_auth."user" u
      LEFT JOIN (
        SELECT "userId" AS user_id, MAX("createdAt") AS last_session
        FROM neon_auth.session
        GROUP BY "userId"
      ) s ON s.user_id = u.id
      /* audit_logs has no user-id foreign key — it records the address that
         acted. Lower-cased on both sides because the three sources of an
         address in this app do not agree on casing. */
      LEFT JOIN (
        SELECT lower(actor_email) AS actor_email,
               COUNT(*)::int      AS events,
               MAX(created_at)    AS last_event
        FROM public.audit_logs
        GROUP BY lower(actor_email)
      ) a ON a.actor_email = lower(u.email)
      ORDER BY u."createdAt" DESC
    `,
    sql`
      SELECT (SELECT COUNT(*)::int FROM neon_auth."user")                          AS users,
             /* Live sessions, which is a fact that changes. It replaced a
                "Verified Emails" card that read 0 permanently. */
             (SELECT COUNT(*)::int FROM neon_auth.session
               WHERE "expiresAt" > now())                                        AS active_sessions,
             (SELECT COUNT(*)::int FROM public.audit_logs)                         AS events
    `,
  ])

  const admins = users.filter((u) => isAdminEmail(u.email, process.env.SUPER_ADMIN_EMAILS)).length

  const stats = [
    { key: "users", label: "All Users", icon: UsersIcon, value: totals.users },
    { key: "admins", label: "Super Admins", icon: ShieldCheckIcon, value: admins },
    { key: "sessions", label: "Active Sessions", icon: KeyRoundIcon, value: totals.active_sessions },
    { key: "events", label: "Recorded Events", icon: ActivityIcon, value: totals.events },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">All Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every account in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">neon_auth.user</code>. Open a row
          for that user&apos;s own log, or see{" "}
          <Link href="/logs" className="underline underline-offset-4">
            Audit Logs
          </Link>{" "}
          for every user at once. This page is read-only.
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last session</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead>Last event</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const admin = isAdminEmail(u.email, process.env.SUPER_ADMIN_EMAILS)
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {u.name || "—"}
                      </Link>
                      <div className="flex gap-1.5 pt-1">
                        {admin && <Badge variant="secondary">Super admin</Badge>}
                        {u.banned && <Badge variant="destructive">Banned</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.last_session ? timeAgo(u.last_session) : "No live session"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{u.events ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.last_event ? timeAgo(u.last_event) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Per-user logs show the most recent {LOG_PAGE_LIMIT} events for that address. The audit
        trail only holds what the app has written since it was added, so an account that predates it
        can legitimately show zero.
      </p>
    </div>
  )
}
