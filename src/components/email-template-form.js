"use client"

import { useState, useTransition } from "react"
import { PlusIcon, PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { createTemplate, updateTemplate } from "@/app/(app)/settings/email-templates/actions"

export function EmailTemplateForm({ template, onSaved }) {
  const editing = !!template
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(template?.name ?? "")
  const [subject, setSubject] = useState(template?.subject ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !body.trim()) return
    const fields = { name: name.trim(), subject: subject.trim(), body: body.trim() }
    startTransition(async () => {
      if (editing) {
        await updateTemplate(template.id, fields)
        onSaved?.({ ...template, ...fields })
      } else {
        const created = await createTemplate(fields)
        onSaved?.(created)
        setName(""); setSubject(""); setBody("")
      }
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
            <PencilIcon className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5 text-xs">
            <PlusIcon className="h-3.5 w-3.5" />
            New Template
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Template" : "New Email Template"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Template name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome email" disabled={isPending} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Subject <span className="text-destructive">*</span></Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Welcome to {{company}}!" disabled={isPending} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Body <span className="text-destructive">*</span></Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi {{name}},\n\nThank you for reaching out..."}
              rows={8}
              className="resize-none text-sm font-mono"
              disabled={isPending}
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{"{{name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{email}}"}</code>, <code className="bg-muted px-1 rounded">{"{{company}}"}</code> as placeholders.
            </p>
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!name.trim() || !subject.trim() || !body.trim() || isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
