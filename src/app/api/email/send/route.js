import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function POST(request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contactId, to, subject, body } = await request.json()

  if (!to || !subject || !body) {
    return Response.json({ error: "to, subject and body are required" }, { status: 400 })
  }

  const fromEmail = session.user.email
  const apiKey = process.env.SENDGRID_API_KEY

  if (!apiKey) {
    return Response.json({ error: "SENDGRID_API_KEY is not configured" }, { status: 503 })
  }

  // Send via SendGrid
  let providerId = null
  let status = "sent"

  try {
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: fromEmail },
        personalizations: [{ to: [{ email: to }] }],
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    })

    if (!sgRes.ok) {
      const err = await sgRes.text()
      console.error("SendGrid error:", err)
      status = "failed"
    } else {
      providerId = sgRes.headers.get("X-Message-Id") ?? null
    }
  } catch (err) {
    console.error("SendGrid fetch error:", err)
    status = "failed"
  }

  // Log the send
  await sql`
    INSERT INTO public.email_sends (contact_id, from_email, to_email, subject, body, provider_id, status)
    VALUES (${contactId ?? null}, ${fromEmail}, ${to}, ${subject}, ${body}, ${providerId}, ${status})
  `

  // Log email as contact activity + auto-create follow-up task
  if (contactId) {
    await sql`
      INSERT INTO public.contact_activities (contact_id, author_email, type, title, body, completed_at)
      VALUES (${contactId}, ${fromEmail}, 'email', ${subject}, ${body}, NOW())
    `
    if (status === "sent") {
      const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      await sql`
        INSERT INTO public.contact_activities
          (contact_id, author_email, type, title, body, due_at)
        VALUES
          (${contactId}, ${fromEmail}, 'task',
           ${"Follow up on: " + subject},
           'Auto-created after email send',
           ${dueAt})
      `
    }
  }

  if (status === "failed") {
    return Response.json({ error: "Email delivery failed. Logged but not delivered." }, { status: 502 })
  }

  return Response.json({ ok: true, providerId })
}
