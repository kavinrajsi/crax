"use client"

import { useState, useTransition } from "react"
import { Trash2Icon, MailIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EmailTemplateForm } from "@/components/email-template-form"
import { deleteTemplate } from "@/app/(app)/settings/email-templates/actions"

export function EmailTemplateList({ initialTemplates }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [isPending, startTransition] = useTransition()

  function handleCreated(template) {
    setTemplates((prev) => [template, ...prev])
  }

  function handleUpdated(updated) {
    setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
  }

  function handleDelete(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    startTransition(() => deleteTemplate(id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">{templates.length} template{templates.length !== 1 ? "s" : ""}</Badge>
        <EmailTemplateForm onSaved={handleCreated} />
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <MailIcon className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a reusable email template to speed up outreach.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-border overflow-hidden">
          {templates.map((template, i) => (
            <div key={template.id}>
              {i > 0 && <Separator />}
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <MailIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{template.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <EmailTemplateForm template={template} onSaved={handleUpdated} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(template.id)}
                    disabled={isPending}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
