import { sql } from "@/lib/db"
import { AutomationRulesList } from "@/components/automation-rules-list"

export const dynamic = "force-dynamic"

export default async function AutomationPage() {
  const [rules, templates] = await Promise.all([
    sql`SELECT * FROM public.automation_rules ORDER BY created_at DESC`,
    sql`SELECT id, name FROM public.email_templates ORDER BY name ASC`,
  ])

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Automation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          If-then rules that run automatically when CRM events occur — no manual follow-up needed.
        </p>
      </div>
      <AutomationRulesList initialRules={rules} templates={templates} />
    </div>
  )
}
