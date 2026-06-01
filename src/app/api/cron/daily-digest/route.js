import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const overdueTasks = await sql`
    SELECT
      ca.id,
      ca.contact_id,
      ca.author_email,
      ca.title,
      ca.due_at,
      cu.name  AS contact_name
    FROM public.contact_activities ca
    JOIN public.contact_us cu ON cu.id = ca.contact_id
    WHERE ca.type = 'task'
      AND ca.completed_at IS NULL
      AND ca.due_at < NOW()
      AND ca.author_email NOT IN ('system', 'automation', 'webhook')
    ORDER BY ca.author_email, ca.due_at ASC
  `

  if (!overdueTasks.length) {
    return Response.json({ ok: true, sent: 0, message: "No overdue tasks" })
  }

  // Group by author email
  const byAuthor = {}
  for (const task of overdueTasks) {
    if (!byAuthor[task.author_email]) byAuthor[task.author_email] = []
    byAuthor[task.author_email].push(task)
  }

  const apiKey   = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@crax.app"
  let sent = 0

  for (const [authorEmail, tasks] of Object.entries(byAuthor)) {
    if (!apiKey || !authorEmail) continue

    const taskList = tasks.map((t) => {
      const dueDate = new Date(t.due_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      return `• ${t.title} (${t.contact_name ?? "Unknown contact"}) — was due ${dueDate}`
    }).join("\n")

    const count   = tasks.length
    const subject = `[Crax] You have ${count} overdue task${count > 1 ? "s" : ""}`
    const body    = `Hi,\n\nYou have ${count} overdue task${count > 1 ? "s" : ""} in your CRM:\n\n${taskList}\n\nLog in to review and complete them.\n\n— Crax CRM`

    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { email: fromEmail },
          personalizations: [{ to: [{ email: authorEmail }] }],
          subject,
          content: [{ type: "text/plain", value: body }],
        }),
      })
      if (res.ok) sent++
      else console.error("Digest email failed for", authorEmail, await res.text())
    } catch (err) {
      console.error("Digest email error:", err)
    }
  }

  return Response.json({ ok: true, sent, totalTasks: overdueTasks.length })
}
