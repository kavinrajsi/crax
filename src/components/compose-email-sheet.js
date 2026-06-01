"use client"

import { useState, useTransition } from "react"
import { MailIcon, ChevronDownIcon, SendIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function interpolate(text, contact) {
  return text
    .replace(/\{\{name\}\}/g, contact.name ?? "")
    .replace(/\{\{email\}\}/g, contact.email ?? "")
    .replace(/\{\{company\}\}/g, contact.company ?? "")
}

function TemplatePicker({ templates, onSelect }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <ChevronDownIcon className="h-3.5 w-3.5" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No templates yet. Create one in Settings → Email Templates.
          </p>
        ) : (
          <div className="flex flex-col gap-1 mt-2 max-h-72 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                className="text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                onClick={() => { onSelect(t); setOpen(false) }}
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ComposeEmailSheet({ contact, templates }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(contact.email ?? "")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [result, setResult] = useState(null) // null | 'ok' | 'error'
  const [isPending, startTransition] = useTransition()

  function handleTemplateSelect(template) {
    setSubject(interpolate(template.subject, contact))
    setBody(interpolate(template.body, contact))
  }

  function handleSend(e) {
    e.preventDefault()
    if (!to.trim() || !subject.trim() || !body.trim()) return

    startTransition(async () => {
      try {
        const res = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, to: to.trim(), subject: subject.trim(), body: body.trim() }),
        })
        const data = await res.json()
        setResult(res.ok ? "ok" : "error")
        if (res.ok) {
          setTimeout(() => {
            setOpen(false)
            setSubject("")
            setBody("")
            setTo(contact.email ?? "")
            setResult(null)
          }, 1500)
        }
      } catch {
        setResult("error")
      }
    })
  }

  function handleOpenChange(v) {
    setOpen(v)
    if (!v) { setResult(null); setSubject(""); setBody(""); setTo(contact.email ?? "") }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <MailIcon className="h-3.5 w-3.5" />
          Send Email
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle>Compose Email</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">To: {contact.name} &lt;{contact.email}&gt;</p>
        </SheetHeader>

        <form onSubmit={handleSend} className="flex flex-col gap-4 px-5 py-4 flex-1">
          {/* To */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" required disabled={isPending} />
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Subject</Label>
              <TemplatePicker templates={templates} onSelect={handleTemplateSelect} />
            </div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject…" required disabled={isPending} />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={12}
              className="resize-none text-sm flex-1"
              required
              disabled={isPending}
            />
          </div>

          <Separator />

          {/* Status + Send */}
          <div className="flex items-center gap-3">
            {result === "ok" && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircleIcon className="h-4 w-4" />
                Sent successfully
              </span>
            )}
            {result === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircleIcon className="h-4 w-4" />
                Failed to send
              </span>
            )}
            <Button
              type="submit"
              className="ml-auto gap-1.5"
              disabled={!to.trim() || !subject.trim() || !body.trim() || isPending || result === "ok"}
            >
              <SendIcon className="h-4 w-4" />
              {isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
