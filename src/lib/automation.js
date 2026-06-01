import { sql } from "@/lib/db"

function matchesFilter(filter, context) {
  if (!filter || Object.keys(filter).length === 0) return true
  if (filter.to_status  && context.toStatus  !== filter.to_status)  return false
  if (filter.from_status && context.fromStatus !== filter.from_status) return false
  if (filter.to_stage   && context.toStage   !== filter.to_stage)   return false
  if (filter.from_stage && context.fromStage !== filter.from_stage) return false
  return true
}

function interpolate(text, contact) {
  return (text ?? "")
    .replace(/\{\{name\}\}/g,    contact.name    ?? "")
    .replace(/\{\{email\}\}/g,   contact.email   ?? "")
    .replace(/\{\{company\}\}/g, contact.company ?? "")
}

async function executeAction(rule, context) {
  const { action_type, action_config: cfg } = rule
  const contactId = context.contactId ?? null

  if (action_type === "create_task" && contactId) {
    const daysOut = cfg.due_days ?? 3
    const dueAt = new Date(Date.now() + daysOut * 86400000).toISOString()
    await sql`
      INSERT INTO public.contact_activities
        (contact_id, author_email, type, title, body, due_at)
      VALUES
        (${contactId}, 'automation', 'task', ${cfg.title ?? "Follow up"}, ${cfg.body ?? null}, ${dueAt})
    `
  }

  if (action_type === "send_email" && contactId) {
    const [contact] = await sql`SELECT email, name, company FROM public.contact_us WHERE id = ${contactId}`
    if (!contact?.email) return
    const [template] = await sql`SELECT * FROM public.email_templates WHERE id = ${cfg.template_id}`
    if (!template) return
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return
    const subject = interpolate(cfg.subject_override ?? template.subject, contact)
    const body    = interpolate(template.body, contact)
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@crax.app" },
        personalizations: [{ to: [{ email: contact.email }] }],
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    })
    if (contactId) {
      await sql`
        INSERT INTO public.contact_activities
          (contact_id, author_email, type, title, body, completed_at)
        VALUES
          (${contactId}, 'automation', 'email', ${subject}, ${body}, NOW())
      `
    }
  }

  if (action_type === "add_tag" && contactId && cfg.tag) {
    await sql`
      INSERT INTO public.contact_tags (contact_id, tag)
      VALUES (${contactId}, ${cfg.tag})
      ON CONFLICT (contact_id, tag) DO NOTHING
    `
  }

  if (action_type === "update_contact_status" && contactId && cfg.status) {
    await sql`UPDATE public.contact_us SET status = ${cfg.status} WHERE id = ${contactId}`
    await sql`
      INSERT INTO public.contact_activities
        (contact_id, author_email, type, title, body, completed_at)
      VALUES
        (${contactId}, 'automation', 'status_change', 'Status changed',
         ${"Automation rule: status set to " + cfg.status}, NOW())
    `
  }
}

/**
 * Evaluate all active automation rules for a given trigger event.
 * Silently logs failures to automation_rule_runs — never throws to caller.
 *
 * @param {string} trigger - 'contact_status_changed' | 'deal_stage_changed' | 'contact_created' | 'activity_completed'
 * @param {object} context - { contactId, dealId, fromStatus, toStatus, fromStage, toStage, activityId }
 */
export async function evaluateRules(trigger, context) {
  let rules
  try {
    rules = await sql`
      SELECT * FROM public.automation_rules
      WHERE trigger_event = ${trigger} AND is_active = true
    `
  } catch {
    return
  }

  for (const rule of rules) {
    try {
      if (!matchesFilter(rule.trigger_filter, context)) continue
      await executeAction(rule, context)
      await sql`
        INSERT INTO public.automation_rule_runs
          (rule_id, contact_id, deal_id, trigger_event, result)
        VALUES
          (${rule.id}, ${context.contactId ?? null}, ${context.dealId ?? null}, ${trigger}, 'ok')
      `
    } catch (err) {
      try {
        await sql`
          INSERT INTO public.automation_rule_runs
            (rule_id, contact_id, deal_id, trigger_event, result, error_msg)
          VALUES
            (${rule.id}, ${context.contactId ?? null}, ${context.dealId ?? null},
             ${trigger}, 'error', ${err.message ?? "unknown error"})
        `
      } catch { /* ignore log failure */ }
    }
  }
}
