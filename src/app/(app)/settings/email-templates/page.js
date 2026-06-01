import { sql } from "@/lib/db"
import { EmailTemplateList } from "@/components/email-template-list"

export const dynamic = "force-dynamic"

export default async function EmailTemplatesPage() {
  const templates = await sql`SELECT * FROM public.email_templates ORDER BY created_at DESC`

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reusable templates for outbound emails. Use <code className="bg-muted px-1 rounded text-xs">{"{{name}}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{{email}}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{{company}}"}</code> as placeholders.
        </p>
      </div>
      <EmailTemplateList initialTemplates={templates} />
    </div>
  )
}
